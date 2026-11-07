import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  Ledger,
  account,
  quantize as q,
} from "../dist/src/economy-energy-ledger.js";
import {
  NationalLedger43,
  NATIONAL_C43,
} from "../dist/src/economy-round4-3-ledger.js";
import {
  POLICY43,
  FIXED42243,
  validate43,
  hydrogenPolicy43,
  effectiveTax43,
  lifeNeed43,
  iceQuote43,
} from "../dist/src/economy-round4-3-policy.js";
import { forecastWater43 } from "../dist/src/economy-round4-3-water.js";
import {
  createRound43Economy,
  simulateRound43Economy,
  tickRound43Economy,
  round43Snapshot,
  assertRound43Economy,
  orderIce43,
  waterTrade43,
  lifeWaterUse43,
  lifeOxygenUse43,
  iceSchedule43,
  icePlan43,
  produceIce43,
  monthlyOperatingCost422,
  orderHydrogen,
  pauseRound4,
  restartRound4,
} from "../dist/src/economy-round4-3-model.js";
import { simulateRound422Economy } from "../dist/src/economy-round4-2-2-model.js";
import { inputs43, lane43, hash43 } from "../scripts/econ-round4-3-inputs.mjs";
import {
  compact43,
  lifeMetrics43,
  metrics43,
  pair43,
} from "../scripts/econ-round4-3-analysis.mjs";
const d = inputs43(),
  { p, e, inputs, profile, config } = d,
  opts = {
    round4: profile.parameters,
    round41: lane43(profile.policy41, "self"),
    scenario: "E2-S",
    seed: "econ-1",
  },
  create = (over = {}) =>
    createRound43Economy(p, e, inputs, { ...opts, ...over });
let cached;
const full = () => (cached ??= simulateRound43Economy(p, e, inputs, opts));
const empty = () => ({
  waterQ: 0,
  byproductWaterQ: 0,
  hydrogenQ: 0,
  finiteByproductHQ: 0,
  byproductRateCapQ: 0,
  baseNeedHQ: 0,
  history: [],
  plants: [],
});
const water = (over = {}) => ({
  nowTick: 0,
  startTick: 0,
  readyTick: 0,
  months: 3,
  fraction: 0.5,
  requestOwner: "government",
  requestCapacityQ: 100,
  naturalCapacityQ: 0,
  candidateNatural: false,
  body: "earth",
  population: 0,
  growth: 0,
  litersPerDay: 0.5,
  boiloff: 0,
  owners: { government: empty(), private: empty() },
  ...over,
});
const tax = (extra = {}) =>
  effectiveTax43({
    body: "moon",
    month: 60,
    foundingMonth: 0,
    nationalRate: 0.2,
    sectorId: "outer",
    sectorRates: { outer: 0.1 },
    planetRates: {},
    holidayYears: 5,
    ...extra,
  });

test("43 adopts every422 value exactly and rejects silent rebalancing", () => {
  assert.deepEqual(hydrogenPolicy43(), FIXED42243);
  for (const [k, v] of Object.entries(FIXED42243))
    if (typeof v === "number")
      assert.throws(() => hydrogenPolicy43({ [k]: v + 0.001 }));
  assert.throws(() => hydrogenPolicy43({ boost: 0.1 }));
  assert.equal(hydrogenPolicy43({ enabled: false }).enabled, false);
});
test("43 ice ranges and integer timing cannot drift or mutate fixed life assumptions", () => {
  for (const x of [
    { iceOutputU: 199 },
    { iceGWhPerU: 0 },
    { iceCapitalScale: 1.1 },
    { iceMaintenanceScale: 0.1 },
    { iceBuildMonths: 3.5 },
    { holidayYears: 4 },
    { oxygenRecycle: 0.6 },
    { lifeGraceMonths: 13 },
    { unknown: 1 },
  ])
    assert.throws(() => validate43(x));
  assert.equal(
    validate43({ iceBuildMonths: 12, holidayYears: 10 }).holidayYears,
    10,
  );
});
test("43 one physical treasury preserves cash; private cash and physical inventories stay local", () => {
  const old = new Ledger();
  old.open(account("earth", "government"), 100);
  old.open(account("moon", "government"), 20);
  old.open(account("mars", "government"), 30);
  old.open(account("moon", "private"), 7);
  old.open(account("moon", "government", "alloy"), 9);
  const b = new NationalLedger43(old);
  assert.equal(b.get(NATIONAL_C43), 150);
  assert.equal(b.get(account("mars", "government")), 150);
  assert.equal(b.get(account("moon", "private")), 7);
  assert.equal(b.get(account("moon", "government", "alloy")), 9);
  assert.equal(
    Object.keys(b.balance).filter((k) => k.endsWith("/government/C")).length,
    1,
  );
  assert.equal(
    b.sum((k) => k.endsWith("/C")),
    157,
  );
  b.audit();
});
test("43 a cash-empty colony pays from the nation and fiscal tags reconcile exactly", () => {
  const old = new Ledger({ trace: true });
  old.open(account("earth", "government"), 100);
  old.open(account("moon", "government"), 0);
  old.open(account("moon", "household"), 0);
  const b = new NationalLedger43(old);
  b.move(
    account("moon", "government"),
    account("moon", "household"),
    70,
    "construction",
  );
  assert.equal(b.get(NATIONAL_C43), 30);
  assert.equal(b.fiscal43.moon.outQ, 70);
  assert.equal(b.trace.at(-1).fiscalTag43, "moon:construction");
  b.move(
    account("moon", "household"),
    account("moon", "government"),
    10,
    "tax",
  );
  assert.equal(b.fiscal43.moon.taxQ, 10);
  b.audit();
});
test("43 internal allocations cannot create spending or double count a treasury", () => {
  const b = new NationalLedger43(new Ledger());
  b.open(NATIONAL_C43, 100);
  assert.equal(
    b.move(
      account("earth", "government"),
      account("moon", "government"),
      80,
      "obsolete-grant",
    ),
    0,
  );
  assert.equal(b.get(NATIONAL_C43), 100);
  assert.equal(b.turnover["obsolete-grant"], undefined);
  assert.equal(b.totalFiscal43.moon.outQ, 0);
});
test("43 fiscal destination override labels shared-money SCU costs, then restores context", () => {
  const b = new NationalLedger43(new Ledger());
  b.open(NATIONAL_C43, 100);
  b.open(account("earth", "household"), 0);
  b.withBody43("mars", () =>
    b.move(
      account("earth", "government"),
      account("earth", "household"),
      10,
      "SCU-service",
    ),
  );
  assert.equal(b.fiscal43.mars.outQ, 10);
  assert.equal(b.fiscal43.earth.outQ, 0);
  assert.throws(() =>
    b.withBody43("moon", () => {
      throw Error("stop");
    }),
  );
  assert.equal(b.fiscalBodyOverride43, undefined);
});
test("43 treasury denies overdraft and audit catches hidden aliases or fabricated cash", () => {
  const b = new NationalLedger43(new Ledger());
  b.open(NATIONAL_C43, 1);
  assert.throws(() =>
    b.move(account("moon", "government"), account("moon", "private"), 2),
  );
  b.balance["moon/government/C"] = 0;
  b.expected["moon/government/C"] = 0;
  assert.throws(() => b.audit());
});
test("43 tax hierarchy is national then sector then planet, including explicit zero", () => {
  assert.equal(tax(), 0.1);
  assert.equal(tax({ sectorRates: {} }), 0.2);
  assert.equal(tax({ planetRates: { moon: 0 } }), 0);
  assert.equal(tax({ planetRates: { moon: 0.3 } }), 0.3);
  assert.equal(tax({ planetRates: { moon: null } }), 0.1);
  assert.throws(() => tax({ planetRates: { moon: 2 } }));
});
test("43 grouping all planets or separate sectors changes only inherited effective rates", () => {
  const common = {
    nationalRate: 0.2,
    sectorRates: { all: 0.1, earth: 0.3, moon: 0.05, mars: 0.08 },
    planetRates: { earth: 0.25 },
    holidayYears: 0,
    month: 120,
  };
  assert.equal(
    effectiveTax43({ ...common, body: "moon", sectorId: "all" }),
    0.1,
  );
  assert.equal(
    effectiveTax43({ ...common, body: "moon", sectorId: "moon" }),
    0.05,
  );
  assert.equal(
    effectiveTax43({ ...common, body: "earth", sectorId: "all" }),
    0.25,
  );
});
test("43 holiday ends at exact founding-relative0/60/120 boundaries and Earth is exempt", () => {
  assert.equal(tax({ month: 59 }), 0);
  assert.equal(tax({ month: 60 }), 0.1);
  assert.equal(tax({ foundingMonth: 24, month: 83 }), 0);
  assert.equal(tax({ foundingMonth: 24, month: 84 }), 0.1);
  assert.equal(tax({ holidayYears: 0, month: 0 }), 0.1);
  assert.equal(tax({ holidayYears: 10, month: 119 }), 0);
  assert.equal(tax({ holidayYears: 10, month: 120 }), 0.1);
  assert.equal(tax({ body: "earth", month: 0 }), 0.1);
});
test("43 tax defaults honestly preserve old zero colony rate after holiday", () => {
  assert.equal(config.tax.nationalRate, p.bodies.moon.taxRate);
  assert.equal(config.tax.nationalRate, p.bodies.mars.taxRate);
  assert.equal(
    config.tax.planetRates.earth,
    profile.parameters.earthTaxRate ?? p.earthTaxRate,
  );
});
test("43 person-to-U life units are physical and Earth demands zero", () => {
  assert.deepEqual(lifeNeed43("earth", 8893e6), { waterQ: 0, oxygenQ: 0 });
  assert.deepEqual(lifeNeed43("moon", 4000), { waterQ: 13334, oxygenQ: 12600 });
  assert.equal(lifeNeed43("moon", 4000, 0).oxygenQ, 25200);
  assert.throws(() => lifeNeed43("moon", -1));
});
test("43 construction has no free credit or material; failed order is atomic", () => {
  const s = create(),
    b = s.planets.moon,
    before = hash43(s.book.balance);
  assert.equal(orderIce43(s, b, "government", 1), false);
  assert.equal(hash43(s.book.balance), before);
  assert.equal(b.assets.filter((a) => a.kind === "iceMine43").length, 0);
  assert.equal(orderIce43(s, s.planets.earth, "government"), false);
});
test("43 ice capital and ongoing bill scales are independent positive mine-relative costs", () => {
  const a = iceQuote43({
      ...POLICY43,
      iceCapitalScale: 0.3,
      iceMaintenanceScale: 1,
    }),
    b = iceQuote43({
      ...POLICY43,
      iceCapitalScale: 1,
      iceMaintenanceScale: 0.3,
    });
  assert.ok(a.creditC > 0 && a.alloyU > 0);
  assert.ok(a.creditC < b.creditC);
  assert.ok(a.maintenanceCreditBasisC > b.maintenanceCreditBasisC);
  assert.ok(a.maintenanceAlloyBasisU > b.maintenanceAlloyBasisU);
});
test("43 paid government and private ice facilities wait for commissioning", () => {
  for (const owner of ["government", "private"]) {
    const s = create(),
      b = s.planets.moon;
    s.book.move(
      account("earth", "government", "alloy"),
      account("moon", owner, "alloy"),
      q(1000),
      "test-physical",
    );
    if (owner === "private")
      s.book.move(
        account("earth", "household"),
        account("moon", "private"),
        q(10000),
        "test-cash",
      );
    const before = s.book.get(account("moon", owner));
    const a = orderIce43(s, b, owner, 1);
    assert.ok(a);
    assert.ok(s.book.get(account("moon", owner)) < before);
    assert.equal(icePlan43(s, b, a, 0).units, 0);
    a.state = "active";
    assert.ok(icePlan43(s, b, a, a.completedMonth).units > 0);
  }
});
test("43 finite ice is shared once by owners and zero power produces nothing", () => {
  const book = new Ledger();
  book.open(account("moon", "ground", "ice43"), 100);
  const s = { book },
    b = { id: "moon", flow: { iceProducedU43: 0 } },
    plans = [
      { asset: { owner: "government", capacityU: 1 }, units: 1 },
      { asset: { owner: "private", capacityU: 1 }, units: 1 },
    ];
  produceIce43(s, b, { icePlans: plans, iceRatio: 0 });
  assert.equal(book.get(account("moon", "ground", "ice43")), 100);
  produceIce43(s, b, { icePlans: plans, iceRatio: 1 });
  assert.equal(book.get(account("moon", "ground", "ice43")), 0);
  assert.equal(
    book.sum((k) => k.endsWith("/water")),
    100,
  );
  assert.equal(book.turnover["finite-ice43"], book.turnover["ice-water43"]);
  book.audit();
});
test("43 cold ice restart pays the inherited mine charge and uses its restart profile", () => {
  const s = create(),
    b = s.planets.moon;
  s.book.move(
    account("earth", "government", "alloy"),
    account("moon", "government", "alloy"),
    q(1000),
    "test-physical",
  );
  const a = orderIce43(s, b, "government");
  s.month = a.completedMonth;
  a.state = "active";
  const full = icePlan43(s, b, a, s.month).units;
  pauseRound4(s, b, a);
  assert.equal(icePlan43(s, b, a, s.month).units, 0);
  const before = s.book.get(NATIONAL_C43);
  assert.equal(restartRound4(s, b, a), true);
  assert.ok(s.book.get(NATIONAL_C43) < before);
  assert.ok(icePlan43(s, b, a, s.month).units < full);
});
test("43 local water trade is paid and moves byproduct provenance without creating resources", () => {
  const s = create(),
    b = s.planets.moon;
  s.book.source(account("moon", "private", "water"), 1000, "test-water");
  b.h422.private.waterQ = 500;
  const before = s.book.sum((k) => k.endsWith("/C")),
    r = waterTrade43(s, b, "private", "government", 1);
  assert.equal(r.amountU, 1);
  assert.ok(r.cashC > 0);
  assert.equal(
    s.book.sum((k) => k.endsWith("/C")),
    before,
  );
  assert.equal(b.h422.private.waterQ, 0);
  assert.equal(b.h422.government.waterQ, 500);
  assert.equal(s.book.get(account("moon", "government", "water")), 1000);
});
test("43 water first serves life and oxygen inventory is consumed without oxygen sales", () => {
  const s = create(),
    b = s.planets.moon;
  for (const [resource, n] of [
    ["water", 1e6],
    ["oxygen", 1e6],
  ])
    s.book.source(account("moon", "government", resource), n, "test-resource");
  b.h422.government.waterQ = 1000;
  lifeWaterUse43(s, b);
  lifeOxygenUse43(s, b);
  assert.equal(b.flow.lifeWaterServedU, 666.667);
  assert.equal(b.flow.oxygenLifeServedU43, 630);
  assert.equal(b.flow.byproductLifeWaterU43, 1);
  assert.equal(s.book.turnover["oxygen-market43:C"], undefined);
});
test("43 forecast includes paid ice after commissioning, never opening-month free water", () => {
  const x = water({
    readyTick: 1,
    iceSchedule: [0, 1, 2, 3].map((tick) => ({
      tick,
      government: 100,
      private: 0,
    })),
  });
  assert.equal(forecastWater43(x).allowed, true);
  assert.equal(forecastWater43({ ...x, readyTick: 0 }).allowed, false);
  assert.equal(forecastWater43({ ...x, iceSchedule: [] }).allowed, false);
});
test("43 forecast reserves ice water for life before industrial intake and obeys owner boundaries", () => {
  const x = water({
    body: "moon",
    population: 30,
    readyTick: 1,
    iceSchedule: [0, 1, 2, 3].map((tick) => ({
      tick,
      government: 100,
      private: 0,
    })),
  });
  assert.equal(forecastWater43(x).allowed, false);
  const y = water({
    readyTick: 1,
    iceSchedule: [0, 1, 2, 3].map((tick) => ({
      tick,
      government: 0,
      private: 100,
    })),
  });
  assert.equal(forecastWater43(y).allowed, false);
});
test("43 forecast does not use natural intake for life and then also promise it to a new plant", () => {
  const x = water({
    body: "moon",
    population: 30,
    naturalCapacityQ: 100,
    candidateNatural: true,
  });
  const r = forecastWater43(x);
  assert.equal(r.allowed, true);
  assert.ok(r.maxNaturalIntakeQ <= 100);
  assert.equal(r.forecast[0].lifeWaterQ.government, 0);
});
test("43 forecast is read-only and rejects fabricated ice quanta", () => {
  const x = water({ iceSchedule: [{ tick: 0, government: 100, private: 0 }] });
  const before = hash43(x);
  forecastWater43(x);
  assert.equal(hash43(x), before);
  assert.throws(() =>
    forecastWater43({
      ...x,
      iceSchedule: [{ tick: 0, government: -1, private: 0 }],
    }),
  );
});
test("43 water gate records a full fixed12-month approval before any new electrolyzer payment", () => {
  const x = full();
  for (const b of Object.values(x.state.planets))
    for (const a of b.assets.filter((a) => a.waterApproval422)) {
      assert.equal(a.waterApproval422.months, 12);
      assert.equal(a.waterApproval422.fraction, 0.72);
      assert.equal(a.waterApproval422.operatingMonthsChecked, 12);
      assert.ok(a.waterApproval422.minimumCoverage >= 0.72);
    }
  assert.ok(x.state.planets.moon.assets.some((a) => a.kind === "electrolyzer"));
});
test("43 E2-S survives with national support and finite ice after grace, with paired water/H/O books", () => {
  const x = full();
  assertRound43Economy(x.state);
  for (const id of ["moon", "mars"]) {
    const m = lifeMetrics43(x.rows.slice(1), id);
    assert.equal(m.water.below99Months, 0);
    assert.equal(m.oxygen.below99Months, 0);
    assert.equal(m.water.eligibleMonths, 228);
    if (id === "moon") assert.ok(x.state.planets[id].total.iceProducedU43 > 0);
    assert.ok(x.rows.at(-1).round43.bodies[id].iceRemainingU > 0);
  }
  assert.ok(x.rows.at(-1).treasuryC > 0);
});
test("43 monthly minimum does not hide a bad month in annual average; grace expires after row12", () => {
  const rows = Array.from({ length: 24 }, (_, i) => ({
    month: i + 1,
    round43: { bodies: { moon: { foundingMonth: 0 } } },
    planets: {
      moon: {
        flow: {
          lifeWaterDemandU: 100,
          lifeWaterServedU: i === 12 ? 98 : 100,
          oxygenLifeDemandU43: 100,
          oxygenLifeServedU43: 100,
        },
      },
    },
  }));
  assert.equal(lifeMetrics43(rows, "moon").water.below99Months, 1);
  rows[12].planets.moon.flow.lifeWaterServedU = 99;
  assert.equal(lifeMetrics43(rows, "moon").water.below99Months, 0);
});
test("43 whole water and oxygen conservation detects silent new storage fabrication", () => {
  const s = create();
  s.book.source(account("moon", "government", "oxygen"), 1, "unapproved-test");
  assert.throws(() => assertRound43Economy(s), /oxygen custody/);
});
test("43 national operating reserve values all government facilities instead of triple-counting cash", () => {
  const x = full(),
    s = x.state,
    values = ["earth", "moon", "mars"].map((id) =>
      monthlyOperatingCost422(s, s.planets[id], "government"),
    );
  assert.ok(values[0] > 0);
  assert.equal(values[0], values[1]);
  assert.equal(values[1], values[2]);
  assert.equal(
    Object.keys(s.book.balance).filter((k) => k === "nation/government/C")
      .length,
    1,
  );
});
test("43 actual national cash reconciles all bodies fiscal ledgers, and budget17 uses national tax retention", () => {
  const x = full(),
    r = metrics43(x, p, e, profile, POLICY43, FIXED42243, config, {
      scenario: "E2-S",
      seed: "econ-1",
      lane: "self",
    }),
    last = x.rows.at(-1),
    f = Object.values(last.round43.cumulativeFiscal);
  assert.equal(
    Math.round(
      (r.national.endingTreasuryC - r.national.initialTreasuryC) * 1000,
    ),
    f.reduce((n, a) => n + a.inQ - a.outQ, 0),
  );
  assert.equal(r.bodies.moon.firstPositiveFiscalYear, null);
  assert.ok(r.bodies.moon.netFiscalC < 0);
  const sum = (a) => a.reduce((n, x) => n + x, 0),
    rows = x.rows.slice(1);
  assert.equal(
    r.budgetRatio17,
    sum(rows.slice(192, 204).map((r) => r.round43.nationalBudgetC)) /
      sum(rows.slice(0, 12).map((r) => r.round43.nationalBudgetC)),
  );
});
test("43 no-ice case is a diagnostic and never receives a fabricated lunar water source", () => {
  const x = simulateRound43Economy(p, e, inputs, {
    ...opts,
    round43: { iceEnabled: false },
    months: 24,
  });
  assert.equal(x.state.planets.moon.total.iceProducedU43, 0);
  assert.equal(x.rows.at(-1).round43.bodies.moon.iceRemainingU, 1e6);
  assert.ok(
    x.state.planets.moon.flow.lifeWaterServedU <
      x.state.planets.moon.flow.lifeWaterDemandU,
  );
});
test("43 H-CUT prep removes60000C grants but keeps paid material requests and original months", () => {
  const x = simulateRound43Economy(p, e, inputs, {
    ...opts,
    scenario: "H-CUT-CONTROL",
    cut: {
      body: "earth",
      startMonth: 60,
      durationMonths: 9,
      inventoryLossFraction: 1,
      enabled: false,
      fundedColonyFixture: true,
    },
    months: 26,
  });
  assert.equal(
    x.state.book.turnover["cut-fixture-explicit-funding:C"],
    undefined,
  );
  assert.equal(
    x.state.events422.filter(
      (e) =>
        e.event === "explicit-paid-cut-fixture-request" &&
        e.requestedAlloyU === 5500 &&
        e.requestedHydrogenU === 200,
    ).length,
    2,
  );
  assert.ok(
    x.state.shipmentHistory.every(
      (t) => t.goodsPaymentC >= 0 && t.servicesC > 0,
    ),
  );
});
test("43 does not peek at future H-CUT while approving ice or water; country money never goes negative", () => {
  const cut = {
    body: "moon",
    startMonth: 60,
    durationMonths: 6,
    inventoryLossFraction: 1,
    enabled: true,
    fundedColonyFixture: true,
  };
  const a = simulateRound43Economy(p, e, inputs, {
      ...opts,
      scenario: "H-CUT",
      cut,
      months: 66,
    }),
    b = simulateRound43Economy(p, e, inputs, {
      ...opts,
      scenario: "H-CUT-CONTROL",
      cut: { ...cut, enabled: false },
      months: 66,
    });
  assert.equal(
    hash43(compact43(a.rows.slice(0, 61))),
    hash43(compact43(b.rows.slice(0, 61))),
  );
  assert.ok(
    a.rows
      .slice(61)
      .every((r) => r.planets.moon.flow.hydrogenElectrolysisU === 0),
  );
  assert.ok(a.rows.every((r) => r.treasuryC >= 0));
});
test("43 legacy structure control exactly replays immutable422 with adopted hydrogen values", () => {
  for (const enabled of [false, true]) {
    const opt = { ...opts, round422: { ...FIXED42243, enabled }, months: 30 };
    const a = simulateRound43Economy(p, e, inputs, {
        ...opt,
        round43: { enabled: false },
      }),
      b = simulateRound422Economy(p, e, inputs, opt);
    assert.equal(hash43(a.rows), hash43(b.rows));
  }
});
test("43 baseline source, presets, geology and all prior economic outputs remain byte-identical", () => {
  const m = JSON.parse(
    fs.readFileSync("docs/econ-sim/round4-3/preservation-manifest.json"),
  );
  assert.equal(Object.keys(m.files).length, 1465);
  for (const [path, h] of Object.entries(m.files))
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex"),
      h,
      path,
    );
});

test("43 zero treasury stalls discretionary construction without inventing colony debt or cash", () => {
  const s = create({
    tax43: {
      nationalRate: 0,
      sectorRates: {},
      planetRates: { earth: 0 },
      sectors: { earth: "all", moon: "all", mars: "all" },
    },
  });
  s.book.move(
    NATIONAL_C43,
    account("earth", "household"),
    s.book.get(NATIONAL_C43),
    "test-national-exhaustion",
  );
  for (let i = 0; i < 12; i++) tickRound43Economy(s);
  assert.equal(s.book.get(NATIONAL_C43), 0);
  assert.equal(s.debtC, 0);
  assert.equal(
    s.planets.moon.assets.filter((a) => a.kind === "iceMine43").length,
    0,
  );
  assertRound43Economy(s);
});
test("43 oxygen inventory pays existing positive liquefaction power and never earns oxygen sales", () => {
  const x = full();
  assert.ok(x.state.planets.moon.total.oxygenLiquefactionGWh > 0);
  assert.equal(x.state.book.turnover["oxygen-vented"], undefined);
  assert.equal(x.state.book.turnover["oxygen-sale"], undefined);
  assert.ok(x.state.book.turnover["life-oxygen43"] > 0);
});
test("43 explicit nonzero national tax affects the country only after a colony holiday", () => {
  const common = {
      nationalRate: 0.25,
      sectorRates: {},
      planetRates: { earth: 0.25 },
      sectors: { earth: "all", moon: "all", mars: "all" },
    },
    a = create({ tax43: common, round43: { holidayYears: 0 } }),
    b = create({ tax43: common, round43: { holidayYears: 5 } });
  tickRound43Economy(a);
  tickRound43Economy(b);
  assert.ok(a.book.fiscal43.moon.taxQ > 0);
  assert.equal(b.book.fiscal43.moon.taxQ, 0);
  assert.ok(a.book.fiscal43.mars.taxQ > 0);
});
test("43 five-axis LHS stratifies four continuous axes, covers integer time, and rounds only new ice axes", async () => {
  const { lhs43, rounded43 } = await import(
    "../scripts/econ-round4-3-calibrate.mjs"
  );
  const a = lhs43(config);
  assert.equal(a.length, 32);
  for (const [k, [lo, hi]] of Object.entries(config.ranges)) {
    for (const c of a) assert.ok(c.policy[k] >= lo && c.policy[k] <= hi);
    if (k !== "iceBuildMonths")
      assert.equal(
        new Set(a.map((c) => Math.floor(((c.policy[k] - lo) / (hi - lo)) * 32)))
          .size,
        32,
      );
    else assert.ok(a.every((c) => Number.isInteger(c.policy[k])));
  }
  const p = rounded43(a[0].policy);
  for (const k of ["holidayYears", "oxygenRecycle", "lifeGraceMonths"])
    assert.equal(p[k], POLICY43[k]);
  assert.deepEqual(hydrogenPolicy43(), FIXED42243);
});

test("43 relief donor reserve uses independent ice maintenance rather than its capital scale", async () => {
  const { maintenanceNeed43, protectedExport43 } = await import(
    "../dist/src/economy-round4-3-model.js"
  );
  const s = create({
      round43: { iceCapitalScale: 0.3, iceMaintenanceScale: 1 },
    }),
    b = s.planets.moon;
  s.book.move(
    account("earth", "government", "alloy"),
    account("moon", "government", "alloy"),
    q(1000),
    "test-physical",
  );
  const a = orderIce43(s, b, "government");
  s.month = a.completedMonth;
  a.state = "active";
  const own = maintenanceNeed43(b, s.e, s.r, s.month, "government"),
    r = protectedExport43(s, b, "government", 100, s.r41);
  assert.ok(own > (a.alloyBasisU * s.r.upkeep_moon) / 12);
  assert.ok(
    r.reserveQ >=
      Math.ceil(
        own * Math.max(s.r41.enterMonths, s.r41.donorReserveMonths) * 1000 -
          1e-7,
      ),
  );
});

test("43 explicit water/oxygen life power precedes city brownout", () => {
  const x = simulateRound43Economy(p, e, inputs, {
    ...opts,
    scenario: "E8",
    months: 40,
  });
  const r = x.rows[38];
  assert.ok(r.planets.moon.cityUtilization < 0.8);
  for (const id of ["moon", "mars"]) {
    const f = r.planets[id].flow;
    assert.ok(f.oxygenLifeServedU43 / f.oxygenLifeDemandU43 >= 0.99);
    assert.ok(f.lifeWaterServedU / f.lifeWaterDemandU >= 0.99);
  }
  assert.ok(r.planets.moon.flow.iceProducedU43 > 0);
  assertRound43Economy(x.state);
});

test("43 sector grouping reaches actual planet tax ledger with separate and shared sectors", () => {
  const common = {
      nationalRate: 0.2,
      sectorRates: { all: 0.1, earth: 0.3, moon: 0.05, mars: 0.08 },
      planetRates: { earth: 0.25 },
    },
    a = create({
      tax43: { ...common, sectors: { earth: "all", moon: "all", mars: "all" } },
      round43: { holidayYears: 0 },
    }),
    b = create({
      tax43: {
        ...common,
        sectors: { earth: "earth", moon: "moon", mars: "mars" },
      },
      round43: { holidayYears: 0 },
    });
  tickRound43Economy(a);
  tickRound43Economy(b);
  assert.equal(a.book.fiscal43.moon.taxQ, 3750);
  assert.equal(b.book.fiscal43.moon.taxQ, 1875);
  assert.equal(a.book.fiscal43.mars.taxQ, 938);
  assert.equal(b.book.fiscal43.mars.taxQ, 750);
  assert.equal(a.book.fiscal43.earth.taxQ, b.book.fiscal43.earth.taxQ);
});

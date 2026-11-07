import test from "node:test";
import assert from "node:assert/strict";
import {
  inputs431,
  lane431,
  hash431,
} from "../scripts/econ-round4-3-1-inputs.mjs";
import {
  createRound431Economy,
  tickRound431Economy,
  simulateRound431Economy,
  fillReserve431,
  drawReserve431,
  availableStock431,
  waterTrade43,
  lifeWaterUse43,
  oxygenPlans431,
  orderLifeInfrastructure431,
} from "../dist/src/economy-round4-3-1-model.js";
import { simulateRound43Economy } from "../dist/src/economy-round4-3-model.js";
import {
  FIXED43_431,
  LIFE431,
  validate431,
  fixed43_431,
  tax431,
  reserveTarget431,
  oxygenQuote431,
  tankQuote431,
  lifeRequired431,
} from "../dist/src/economy-round4-3-1-policy.js";
import { lifeNeed43 } from "../dist/src/economy-round4-3-policy.js";
import { NATIONAL_C43 } from "../dist/src/economy-round4-3-ledger.js";
import { account, quantize as q } from "../dist/src/economy-energy-ledger.js";
import {
  metrics431,
  pair431,
  compact431,
} from "../scripts/econ-round4-3-1-analysis.mjs";
import { compact43 } from "../scripts/econ-round4-3-analysis.mjs";
import { forecastWater431 } from "../dist/src/economy-round4-3-1-water.js";
const d = inputs431(),
  opts = {
    round4: d.profile.parameters,
    round41: lane431(d.profile.policy41, "self"),
    round43: d.policy43,
    tax43: { ...d.config.tax, colonyFactor: 0.5 },
    seed: "econ-1",
    scenario: "E2-S",
  };
const create = (over = {}) =>
  createRound431Economy(d.p, d.e, d.inputs, { ...opts, ...over });
let cached;
const full = () =>
  (cached ??= simulateRound431Economy(d.p, d.e, d.inputs, opts));
const tax = (over = {}) =>
  tax431({ body: "moon", month: 60, nationalRate: 0.25, ...over });
test("431 frozen ice and reserve values, no search permitted", () => {
  assert.equal(FIXED43_431.iceOutputU, 750);
  assert.equal(FIXED43_431.iceCapitalScale, 0.79);
  assert.equal(FIXED43_431.iceMaintenanceScale, 0.66);
  assert.equal(FIXED43_431.iceGWhPerU, 0.0018);
  assert.equal(FIXED43_431.iceBuildMonths, 6);
  assert.equal(LIFE431.reserveMonths, 6);
  assert.equal(validate431(), LIFE431);
  assert.throws(() => validate431({ reserveMonths: 5 }));
  assert.throws(() => fixed43_431({ iceOutputU: 800 }));
});
for (const [factor, expected] of [
  [0, 0],
  [0.5, 0.125],
  [1, 0.25],
])
  test("431 tax comparison " + factor, () =>
    assert.equal(tax({ colonyFactor: factor }), expected),
  );
test("431 holiday exact month boundary and delayed foundation", () => {
  assert.equal(tax({ month: 59 }), 0);
  assert.equal(tax({ month: 60 }), 0.125);
  assert.equal(tax({ foundingMonth: 12, month: 71 }), 0);
  assert.equal(tax({ foundingMonth: 12, month: 72 }), 0.125);
});
test("431 hierarchical sector and planet overrides including explicit zero", () => {
  assert.equal(tax({ sectorId: "s", sectorRates: { s: 0.18 } }), 0.18);
  assert.equal(tax({ sectorId: "s", sectorRates: { s: 0 } }), 0);
  assert.equal(
    tax({
      sectorId: "s",
      sectorRates: { s: 0.18 },
      planetRates: { moon: 0.07 },
    }),
    0.07,
  );
  assert.equal(tax({ planetRates: { moon: 0 } }), 0);
  assert.equal(tax({ planetRates: { moon: null } }), 0.125);
});
test("431 terraformed data slot has national default, no terraforming model", () => {
  assert.equal(tax({ terraformed: true }), 0.25);
  assert.equal(tax({ body: "earth", month: 0 }), 0.25);
});
test("431 rejects malformed tax inputs", () => {
  for (const v of [-0.1, 1.1, NaN])
    assert.throws(() => tax({ nationalRate: v }));
  assert.throws(() => tax({ holidayYears: 0 }));
  assert.throws(() => tax({ colonyFactor: 0.3 }));
});
test("431 population-proportional targets use net integer demand, Earth exempt", () => {
  const n = lifeNeed43("moon", 200000),
    r = reserveTarget431("moon", 200000);
  assert.equal(r.waterQ, n.waterQ * 6);
  assert.equal(r.oxygenQ, n.oxygenQ * 6);
  assert.ok(reserveTarget431("moon", 210000).waterQ > r.waterQ);
  assert.deepEqual(reserveTarget431("earth", 9e9), { waterQ: 0, oxygenQ: 0 });
});
test("431 dedicated capacity and tanks have positive scaled capital costs", () => {
  const s = create(),
    quote = oxygenQuote431(s.e, 756000),
    tank = tankQuote431(s.e, 4000000, 3780000);
  assert.ok(quote.creditC > 0 && quote.alloyU > 0);
  assert.ok(tank.creditC > 0 && tank.alloyU > 0);
  assert.ok(quote.creditC < s.e.hydrogenModuleC);
  assert.throws(() => oxygenQuote431(s.e, 0));
});
for (const name of [
  "E0",
  "E2-S",
  "E5-M",
  "E5-M-L70-S12-D2",
  "H-CUT-moon-M12-L100",
])
  test("431 required life " + name, () =>
    assert.equal(lifeRequired431(name), true),
  );
for (const name of ["E4", "E5", "E5-X", "E6", "E11"])
  test("431 extreme life information " + name, () =>
    assert.equal(lifeRequired431(name), false),
  );
test("431 single actual treasury and no free reserves at construction", () => {
  const s = create();
  assert.equal(s.book.get(NATIONAL_C43), 100000000);
  for (const b of Object.values(s.planets)) {
    assert.equal(b.reserve431.waterQ, 0);
    assert.equal(b.reserve431.oxygenQ, 0);
  }
  assert.ok(
    !Object.keys(s.book.balance).some((k) =>
      /^(earth|moon|mars)\/government\/C$/.test(k),
    ),
  );
});
test("431 paid construction bonds exact materials and audits every tick", () => {
  const s = create();
  for (let i = 0; i < 15; i++) tickRound431Economy(s);
  for (const b of [s.planets.moon, s.planets.mars]) {
    assert.ok(b.assets.some((a) => a.kind === "lifeOxygen431"));
    assert.ok(b.assets.some((a) => a.kind === "lifeTank431"));
    assert.ok(b.total.dedicatedConstructionC431 > 0);
    assert.ok(b.total.reserveTankConstructionC431 > 0);
  }
  assert.ok(s.book.turnover["construction:life-oxygen431"] > 0);
});
test("431 reserves fill automatically from paid production and local purchases", () => {
  const x = full();
  for (const id of ["moon", "mars"]) {
    const z = x.rows.at(-1).round431[id].reserve;
    assert.equal(z.waterQ, z.waterTargetQ);
    assert.equal(z.oxygenQ, z.oxygenTargetQ);
    assert.ok(z.waterQ <= z.waterCapacityQ && z.oxygenQ <= z.oxygenCapacityQ);
  }
});
test("431 normal peaceful operation does not draw emergency reserve", () => {
  const x = full();
  for (const id of ["moon", "mars"])
    assert.ok(
      x.rows
        .slice(60)
        .every(
          (r) =>
            r.planets[id].flow.waterReserveDrawU431 === 0 &&
            r.planets[id].flow.oxygenReserveDrawU431 === 0,
        ),
    );
});
test("431 reserved water cannot be sold through direct helper", () => {
  const s = structuredCloneState();
  const b = s.planets.moon,
    held = b.reserve431.waterQ,
    raw = s.book.get(account("moon", "government", "water"));
  waterTrade43(s, b, "government", "private", 1e9);
  assert.equal(b.reserve431.waterQ, held);
  assert.ok(s.book.get(account("moon", "government", "water")) >= held);
  assert.ok(s.book.get(account("moon", "government", "water")) <= raw);
});
function structuredCloneState() {
  const s = create();
  for (let i = 0; i < 55; i++) tickRound431Economy(s);
  return s;
}
test("431 withdrawal forbidden before ordinary water is exhausted", () => {
  const s = structuredCloneState();
  assert.ok(availableStock431(s, "moon", "government", "water") > 0);
  assert.throws(() => drawReserve431(s, s.planets.moon, "water", 100));
});
test("431 supply shortage draws exact reserve and later automatically refills", () => {
  const s = structuredCloneState(),
    b = s.planets.moon,
    free = q(availableStock431(s, "moon", "government", "water")),
    before = b.reserve431.waterQ;
  if (free)
    s.book.sink(
      account("moon", "government", "water"),
      free,
      "test-supply-loss",
    );
  const used = drawReserve431(s, b, "water", 1000);
  assert.equal(used.usedQ, 1000);
  assert.equal(b.reserve431.waterQ, before - 1000);
  s.book.source(
    account("moon", "government", "water"),
    1000,
    "test-restored-supply",
  );
  assert.equal(fillReserve431(s, b, "water"), 1000);
  assert.equal(b.reserve431.waterQ, before);
});
test("431 H-CUT blocks ordinary H electrolysis and leaves paid dedicated O2 operating", () => {
  const x = simulateRound431Economy(d.p, d.e, d.inputs, {
    ...opts,
    cut: {
      body: "moon",
      startMonth: 60,
      durationMonths: 12,
      inventoryLossFraction: 1,
      fundedColonyFixture: true,
      enabled: true,
    },
    months: 80,
  });
  const rows = x.rows.slice(61, 73);
  assert.ok(rows.every((r) => r.planets.moon.flow.hydrogenElectrolysisU === 0));
  assert.ok(rows.every((r) => r.planets.moon.flow.dedicatedOxygenU431 > 0));
  assert.ok(
    rows.every(
      (r) =>
        r.planets.moon.flow.oxygenLifeServedU43 /
          r.planets.moon.flow.oxygenLifeDemandU43 >=
        0.99,
    ),
  );
});
test("431 dedicated water/H/O has exact mass and positive power, no oxygen sales", () => {
  const x = full(),
    turn = x.state.book.turnover;
  assert.equal(turn["electrolysis-water"], turn["electrolysis-hydrogen"]);
  assert.equal(turn["electrolysis-water"], turn["electrolysis-oxygen"]);
  for (const id of ["moon", "mars"]) {
    const b = x.state.planets[id];
    assert.ok(b.total.dedicatedPowerGWh431 > 0);
    assert.equal(b.total.dedicatedOxygenU431, b.total.dedicatedWaterU431);
    assert.ok(b.total.dedicatedMaintenanceC431 > 0);
  }
  assert.ok(!Object.keys(turn).some((k) => /oxygen.*sale/.test(k)));
});
test("431 post-grace peace life ≥99% every month rather than annual mean", () => {
  const x = full();
  for (const id of ["moon", "mars"])
    for (const r of x.rows.slice(13)) {
      const f = r.planets[id].flow;
      assert.ok(f.lifeWaterServedU / f.lifeWaterDemandU >= 0.99);
      assert.ok(f.oxygenLifeServedU43 / f.oxygenLifeDemandU43 >= 0.99);
    }
});
test("431 actual tax collection starts after60 months and changes treasury ledger", () => {
  const x = full(),
    a = x.rows[60].round43.cumulativeFiscal.moon.taxQ,
    b = x.rows[61].round43.cumulativeFiscal.moon.taxQ;
  assert.equal(a, 0);
  assert.ok(b > 0);
  assert.equal(x.rows[60].round43.bodies.moon.taxRate, 0.125);
});
test("431 model disabled reproduces immutable43 rounded exact path", () => {
  const a = simulateRound431Economy(d.p, d.e, d.inputs, {
      ...opts,
      round431: { enabled: false },
      months: 24,
    }),
    b = simulateRound43Economy(d.p, d.e, d.inputs, { ...opts, months: 24 });
  assert.equal(hash431(compact43(a.rows)), hash431(compact43(b.rows)));
});
test("431 snapshots contain reserve quantities, not a duplicate treasury", () => {
  const x = full();
  assert.ok(
    x.rows.every((r) =>
      Object.values(r.planets).every((b) => b.governmentC === null),
    ),
  );
  assert.notEqual(hash431(compact431(x.rows)), hash431(compact43(x.rows)));
});
test("431 result metadata and nonempty pass groups retain lane/tax/enabled", () => {
  const x = full(),
    job = { scenario: "E2-S", lane: "self", stage: "final", taxMode: "half" },
    r = metrics431(x, d, job, "econ-1", true);
  assert.equal(r.enabled, true);
  assert.equal(r.lane, "self");
  assert.equal(r.taxMode, "half");
  assert.equal(r.passed, true);
  assert.ok(r.bodies.moon.reserve.firstFill.water.month > 0);
  assert.ok(r.bodies.moon.taxC > 0);
});
test("431 changed population releases excess reserve to working stock without consuming it", () => {
  const s = structuredCloneState(),
    b = s.planets.moon;
  b.population /= 2;
  tickRound431Economy(s);
  const target = reserveTarget431("moon", b.population);
  assert.ok(b.flow.waterReserveReleasedU431 > 0);
  assert.ok(b.flow.oxygenReserveReleasedU431 > 0);
  assert.ok(b.reserve431.waterQ <= target.waterQ);
  assert.ok(b.reserve431.oxygenQ <= target.oxygenQ);
});
test("431 sector override collects actual tax while explicit planet0 stays0", () => {
  const t = {
    ...d.config.tax,
    colonyFactor: 0.5,
    sectors: { earth: "core", moon: "colony", mars: "colony" },
    sectorRates: { colony: 0.18 },
    planetRates: { mars: 0 },
  };
  const s = create({ tax43: t });
  s.month = 60;
  tickRound431Economy(s);
  assert.equal(
    s.book.fiscal43.moon.taxQ,
    q((d.p.bodies.moon.annualGDP * 0.18) / 12),
  );
  assert.equal(s.book.fiscal43.mars.taxQ, 0);
});
test("431 an unfunded colony cannot create free dedicated capacity or tanks", () => {
  const s = create(),
    cash = s.book.get(NATIONAL_C43);
  s.book.withBody43("earth", () =>
    s.book.sink(NATIONAL_C43, cash, "test-no-cash"),
  );
  const b = s.planets.moon;
  orderLifeInfrastructure431(s, b, lifeNeed43("moon", b.population));
  assert.equal(
    b.assets.filter((a) => ["lifeOxygen431", "lifeTank431"].includes(a.kind))
      .length,
    0,
  );
});
test("431 current-month recovered water settles before emergency life reserve withdrawal", () => {
  const s = create({
    cut: {
      body: "earth",
      startMonth: 60,
      durationMonths: 9,
      inventoryLossFraction: 1,
      fundedColonyFixture: true,
      enabled: false,
    },
    trace: true,
  });
  let checked = 0;
  for (let m = 0; m < 100; m++) {
    tickRound431Economy(s);
    for (const id of ["moon", "mars"]) {
      const generated = s.book.trace.findIndex(
        (t) =>
          t.tag === "reduction-water" &&
          t.to === account(id, "government", "water"),
      );
      const life = s.book.trace.findIndex(
        (t) =>
          t.tag === "life-water43" &&
          t.from === account(id, "government", "water"),
      );
      if (generated >= 0 && life >= 0) {
        checked++;
        assert.ok(
          generated < life,
          "Current recovered water must precede life shortage decision",
        );
      }
    }
    s.book.trace.length = 0;
  }
  assert.ok(checked > 0, "fixture must actually recover colony water");
});

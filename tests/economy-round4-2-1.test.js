import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  POLICY421,
  validate421,
  marginal421,
  splitWork421,
  safeSpend421,
  restart421,
} from "../dist/src/economy-round4-2-1-policy.js";
import {
  simulateRound421Economy,
  createRound421Economy,
  tickRound421Economy,
  strip421Rows,
  industryPlan421,
  industryPlans421,
  monthlyOperatingCost421,
  orderHydrogen,
  assert421Economy,
} from "../dist/src/economy-round4-2-1-model.js";
import {
  simulateRound42Economy,
  strip42Rows,
} from "../dist/src/economy-round4-2-model.js";
import { process42 } from "../dist/src/economy-round4-2-policy.js";
import { restartProfile } from "../dist/src/economy-round4-facilities.js";
import {
  inputs421,
  lane421,
  hash421,
} from "../scripts/econ-round4-2-1-inputs.mjs";
import { account } from "../dist/src/economy-energy-ledger.js";
const { p, e, inputs, profile, config } = inputs421(),
  opt = {
    round4: profile.parameters,
    round41: lane421(profile.policy41, "self"),
    scenario: "E0",
    seed: "econ-1",
  },
  pol = validate421(),
  a = {
    baseProcessU: 1000,
    fastProcessU: 1000,
    rawWorkU: 4000,
    maxHydrogenU: 85,
    oreU: 1e6,
    yieldFraction: 0.25,
    assistedBoost: 0.15,
    alloyPrice: 2.3,
    hydrogenPrice: 0.1,
    processGWhPerU: 0.001,
    powerPrice: 0.01,
    baseOperatingC: 50,
  };
const run = simulateRound421Economy(p, e, inputs, { ...opt, round421: pol });
test("421 regression: old b below assisted15% was not a net boost; new full-H capacity is net of assist", () => {
  assert.ok(
    process42({ smeltMode: "hydrogenReduction" }, { ...pol, boost: 0.11 })
      .capacityFactor < 1.15,
  );
  const x = splitWork421({ ...a, availableHydrogenU: 1e6 }, pol);
  assert.ok(
    Math.abs(x.marginal.capacity / (a.baseProcessU * 1.15) - (1 + pol.boost)) <
      1e-12,
  );
  assert.ok(x.processU >= 1000 * 1.15 * (1 + pol.boost) - 0.01);
});
test("421 reference profile only, exact fixed values and removed switching axes rejected", () => {
  assert.equal(profile.id, "R41-rounded");
  for (const key of [
    "switchDays",
    "switchC",
    "switchOutput",
    "enterMonths",
    "exitRatio",
  ])
    assert.throws(() => validate421({ [key]: 1 }));
  for (const x of [
    { boost: 0.049 },
    { boost: 0.251 },
    { hydrogenPerAlloyU: NaN },
    { cashReserveMonths: 0 },
    { cashReserveMonths: 7 },
    { rampSpeed: 0.2 },
    { lifeLitersPerPersonDay: 0.4 },
    { waterIntakeCostShare: 0 },
  ])
    assert.throws(() => validate421(x));
  assert.equal(pol.hydrogenPerAlloyU, 1.06);
});
test("421 p* deducts incremental electricity and O/M, with the conventional assisted H credit", () => {
  const m = marginal421(a, pol);
  assert.ok(m.deltaHydrogenU > 0);
  assert.ok(m.extraOperatingC > 0);
  assert.ok(
    Math.abs(
      m.breakEvenC -
        (m.deltaAlloyU * a.alloyPrice - m.extraOperatingC) / m.deltaHydrogenU,
    ) < 1e-12,
  );
  assert.equal(
    marginal421({ ...a, hydrogenPrice: m.breakEvenC + 1e-10 }, pol).profitable,
    false,
  );
  assert.equal(
    marginal421({ ...a, hydrogenPrice: m.breakEvenC - 1e-10 }, pol).profitable,
    true,
  );
});
test("421 no ore means no fabricated net gain or reduction demand", () => {
  const x = splitWork421({ ...a, oreU: 600, availableHydrogenU: 1e6 }, pol);
  assert.equal(x.reductionProcessU, 0);
  assert.equal(x.processU, 600);
  assert.equal(x.marginal.deltaAlloyU, 0);
});
test("421 zero H uses the complete unassisted baseline, with no transition penalty or H debt", () => {
  const x = splitWork421({ ...a, availableHydrogenU: 0 }, pol);
  assert.equal(x.processU, a.baseProcessU);
  assert.equal(x.hydrogenU, 0);
  assert.equal(x.reductionTime, 0);
});
test("421 partial H preserves the remaining time conventional assist and never spends H twice", () => {
  const m = marginal421(a, pol),
    hc = m.conventional.hydrogenU;
  for (const H of [
    0,
    0.005,
    1,
    hc - 0.001,
    hc,
    hc + 1,
    100,
    200,
    m.hydrogenU,
    m.hydrogenU + 1,
  ]) {
    const x = splitWork421({ ...a, availableHydrogenU: H }, pol);
    assert.ok(x.hydrogenU <= H + 1e-8);
    assert.ok(x.reductionTime >= 0 && x.reductionTime <= 1);
    assert.ok(x.processU >= a.baseProcessU - 1e-8);
    if (H >= hc) assert.ok(x.processU >= m.conventional.processU - 0.01);
    if (H <= hc) assert.equal(x.reductionTime, 0);
  }
});
test("421 uneconomic quote falls back to the old conventional assist rule, not locked reduction", () => {
  const x = splitWork421(
    { ...a, hydrogenPrice: 100, availableHydrogenU: 1e6 },
    pol,
  );
  assert.equal(x.reductionTime, 0);
  assert.equal(x.hydrogenU, 0);
  assert.equal(x.processU, a.baseProcessU);
});
test("421 reserve is a transaction-time nominal-cash floor with conservative integer rounding", () => {
  assert.deepEqual(safeSpend421(1000, 100, 3, 800), {
    floorC: 300,
    spendC: 700,
    allowed: false,
    blocked: true,
  });
  assert.equal(safeSpend421(300, 100, 3, 0).allowed, true);
  assert.equal(safeSpend421(299.999, 100, 3, 0.001).spendC, 0);
  assert.throws(() => safeSpend421(100, NaN, 3, 10));
  const q = safeSpend421(1000.001, 100.0001, 3, 900);
  assert.ok(1000.001 - q.spendC >= q.floorC);
});
test("421 extra speed keeps the96h heater and mining recovery unchanged", () => {
  const plant = { restartMonth: 0 },
    r = run.state.r,
    x = restartProfile(plant, r, 0),
    y = restart421(plant, r, 0, pol);
  assert.equal(y.heaterHours, 96);
  assert.equal(x.mineFactor, y.mineFactor);
  assert.ok(y.smeltFactor > x.smeltFactor);
});
test("421 adapter OFF exactly retains full core4.2 settlements in both lanes, including paid cut preparation", () => {
  for (const lane of ["self", "relief"])
    for (const body of [null, "moon", "mars"]) {
      const cut = body
          ? {
              body,
              startMonth: 60,
              durationMonths: 6,
              inventoryLossFraction: 1,
              fundedColonyFixture: true,
            }
          : null,
        o = {
          ...opt,
          months: 72,
          round41: lane421(profile.policy41, lane),
          cut,
          scenario: body ? "H-CUT-test" : "E5-M",
        };
      const old = simulateRound42Economy(p, e, inputs, {
          ...o,
          round42: { enabled: false },
          adapterControl: true,
        }),
        now = simulateRound421Economy(p, e, inputs, {
          ...o,
          round421: { enabled: false },
          adapterControl: true,
        });
      assert.equal(
        hash421(strip421Rows(now.rows)),
        hash421(strip42Rows(old.rows)),
      );
    }
});
test("421 actual blended recipes conserve water, ore oxygen and owned-H provenance, no self sales", () => {
  assert421Economy(run.state);
  assert.ok(run.state.book.turnover["reduction-hydrogen"] > 0);
  assert.equal(
    run.state.book.turnover["reduction-hydrogen"],
    run.state.book.turnover["reduction-water"],
  );
  assert.equal(run.state.book.turnover["smelter-mode-switch:C"] ?? 0, 0);
  for (const b of Object.values(run.state.planets)) {
    for (const a of b.assets) {
      assert.equal("smeltMode" in a, false);
      assert.equal("smeltTarget" in a, false);
      assert.equal("switches421" in a, false);
    }
    const h = b.h421.private;
    assert.equal(
      h.producedQ,
      h.ownQ + h.usedOwnQ + h.soldOwnQ + h.lostOwnQ + h.exportedOwnQ,
    );
    assert.equal(b.flow.governmentSelfSalesC, 0);
  }
});
test("421 all37 old parameters, fusion fuel and canonical population remain unchanged", () => {
  for (const [k, v] of Object.entries(profile.parameters))
    if (k !== "hydrogenPrice") assert.equal(run.state.r[k], v);
  assert.equal(run.state.r.hydrogenPrice, 0.4);
  assert.equal(run.state.fuelU, 2.5);
  assert.equal(p.bodies.earth.populationPersons, 8893e6);
  assert.equal(pol.rampSpeed, 0.13);
});
test("421 cash safety defers an actual electrolyzer atomically and allows it once funded", () => {
  const x = simulateRound421Economy(p, e, inputs, { ...opt, months: 48 }),
    s = x.state,
    b = s.planets.earth,
    owner = "government",
    cash = () => s.book.get(account(b.id, owner)) / 1000,
    floor = monthlyOperatingCost421(s, b, owner) * pol.cashReserveMonths,
    target = Math.ceil((floor + s.e.hydrogenModuleC / 2) * 1000) / 1000;
  s.book.move(
    account(b.id, owner),
    account(b.id, "household"),
    Math.round((cash() - target) * 1000),
    "test-escrow",
  );
  const n = b.assets.length,
    before = hash421(s.book.balance);
  assert.equal(orderHydrogen(s, b, owner), false);
  assert.equal(b.assets.length, n);
  assert.equal(hash421(s.book.balance), before);
  assert.ok(b.flow.cashInvestmentBlocked421 > 0);
  s.book.move(
    account(b.id, "household"),
    account(b.id, owner),
    Math.round(s.e.hydrogenModuleC * 3 * 1000),
    "test-funding",
  );
  assert.equal(orderHydrogen(s, b, owner), true);
  assert.ok(cash() + 0.001 >= floor);
  assert.ok(b.guards421[owner].minimumPostFloorC >= 0);
});
test("421 self-stock time allocation does not consult or manufacture cash", () => {
  const s = createRound421Economy(p, e, inputs, opt),
    b = s.planets.earth,
    plant = b.assets.find((a) => a.kind === "industry"),
    own = account(b.id, plant.owner),
    n = s.book.get(own);
  s.book.move(
    own,
    account(b.id, "household"),
    n,
    "test-operating-bill-already-paid",
  );
  b.hydrogenPrice = 0.01;
  const before = hash421(s.book.balance),
    plan = industryPlan421(s, b, { ...plant, cashFraction: 1 }, 0, {
      ore: { private: 1e9 },
      hydrogen: { private: 1e9 },
    });
  assert.ok(plan.reductionTime421 > 0.99);
  assert.equal(hash421(s.book.balance), before);
  assert.equal(s.book.get(own), 0);
});
test("421 paid H-CUT has zero local electrolysis in exact rows61–66; existing byproduct may remain", () => {
  const x = simulateRound421Economy(p, e, inputs, {
    ...opt,
    round421: pol,
    scenario: "H-CUT-mars-M6-L100",
    months: 72,
    cut: {
      body: "mars",
      startMonth: 60,
      durationMonths: 6,
      inventoryLossFraction: 1,
      fundedColonyFixture: true,
    },
  });
  assert.ok(
    x.rows
      .slice(61, 67)
      .every((r) => r.planets.mars.flow.hydrogenElectrolysisU === 0),
  );
  assert.equal(x.state.planets.mars.cutFundingC421, 60000);
  assert.ok(
    x.state.shipmentHistory.some(
      (t) =>
        t.resourceId === "hydrogen" && t.changedOwner && t.goodsPaymentC > 0,
    ),
  );
  assert421Economy(x.state);
});
test("421 paid preparation is identical through month60 whether the future cut is enabled or disabled", () => {
  const cut = {
      body: "moon",
      startMonth: 60,
      durationMonths: 9,
      inventoryLossFraction: 1,
      fundedColonyFixture: true,
    },
    o = { ...opt, round421: pol, months: 60 };
  const a = simulateRound421Economy(p, e, inputs, { ...o, cut }),
    b = simulateRound421Economy(p, e, inputs, {
      ...o,
      cut: { ...cut, enabled: false },
    });
  assert.equal(hash421(a.rows), hash421(b.rows));
});
test("421 audit rejects invented own hydrogen or water even when aggregate ledger looks unchanged", () => {
  const s = createRound421Economy(p, e, inputs, opt);
  s.planets.earth.h421.private.producedQ = 1;
  assert.throws(() => assert421Economy(s));
  s.planets.earth.h421.private.producedQ = 0;
  s.planets.earth.h421.private.waterQ = 1e12;
  assert.throws(() => assert421Economy(s));
});
test("421 every preexisting file including all4.2 output bytes is frozen", () => {
  const m = JSON.parse(
    fs.readFileSync("docs/econ-sim/round4-2-1/preservation-manifest.json"),
  );
  assert.equal(Object.keys(m.files).length, 1350);
  for (const [f, h] of Object.entries(m.files))
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"),
      h,
      f,
    );
});
test("421 20-year output cannot hide a bad final12-month window; zero controls stay undefined as ratios", async () => {
  const { compareProduction421 } = await import(
    "../scripts/econ-round4-2-1-analysis.mjs"
  );
  const off = Array(240).fill(100),
    on = [...off];
  on[0] += 20;
  on[239] -= 10;
  const x = compareProduction421(on, off);
  assert.equal(x.wholePeriod, true);
  assert.equal(x.all12MonthWindows, false);
  assert.equal(x.worstStartMonth, 229);
  assert.ok(x.worst12Ratio < 1);
  const z = compareProduction421(Array(24).fill(0), Array(24).fill(0));
  assert.equal(z.totalRatio, null);
  assert.equal(z.worst12Ratio, null);
  assert.equal(z.hasControlIndustry, false);
  assert.equal(z.zeroControlWindows, 13);
});
test("42132 LHS strata deterministic across all3 axes, rounded proposal remains within the requested ranges", async () => {
  const { lhs421, rounded421 } = await import(
    "../scripts/econ-round4-2-1-calibrate.mjs"
  );
  const a = lhs421(config);
  assert.deepEqual(a, lhs421(config));
  assert.equal(a.length, 32);
  for (const [k, [lo, hi]] of Object.entries(config.ranges)) {
    assert.equal(
      new Set(a.map((p) => Math.floor(((p[k] - lo) / (hi - lo)) * 32))).size,
      32,
    );
    for (const p of a) {
      const q = rounded421(p);
      assert.ok(q[k] >= lo && q[k] <= hi);
    }
  }
});
test("421 cash quote protects projected reduction O/M as well as extra electricity before a new H purchase", async () => {
  const { characteristics421 } = await import(
    "../dist/src/economy-round4-2-1-model.js"
  );
  const s = createRound421Economy(p, e, inputs, opt),
    source = s.planets.earth,
    plant = source.assets.find(
      (a) => a.kind === "industry" && a.owner === "private",
    ),
    b = { ...source, assets: [plant], hydrogenPrice: 0.01, powerPriceC: 0.01 };
  s.book.move(
    account("earth", "ground", "ore"),
    account("earth", "private", "ore"),
    100000000,
    "test-paid-upstream-ore",
  );
  const x = characteristics421(s, b, { ...plant, cashFraction: 1 }, 0),
    m = marginal421(
      {
        ...x,
        oreU: x.mineU + s.book.get(account("earth", "private", "ore")) / 1000,
      },
      pol,
    );
  assert.ok(m.profitable);
  const activity = 1 + ((m.capacityRatio - 1) * m.processU) / m.capacity,
    expected =
      (x.baseOperatingC * activity +
        m.hydrogenU * b.hydrogenPrice +
        (s.book.get(account("earth", "private", "hydrogen")) / 1000) *
          (((500 * s.r.hydrogenStorageKWhKgMonth) / 1e6) * b.powerPriceC +
            s.r.boiloffMonthly * b.hydrogenPrice) +
        (x.mineEnergyGWh +
          m.processU * x.processGWhPerU +
          x.fixedGWh +
          x.heaterGWh) *
          b.powerPriceC) *
      s.priceIndex;
  assert.ok(
    Math.abs(monthlyOperatingCost421(s, b, "private") - expected) <
      0.001 * b.alloyPrice * s.priceIndex,
  );
  assert.ok(activity > 1);
});

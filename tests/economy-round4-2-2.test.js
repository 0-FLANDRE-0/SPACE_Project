import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  POLICY422,
  validate422,
  marginal422,
  splitWork422,
  restart422,
  safeSpend422,
} from "../dist/src/economy-round4-2-2-policy.js";
import { forecastWater422 } from "../dist/src/economy-round4-2-2-water.js";
import {
  simulateRound422Economy,
  createRound422Economy,
  strip422Rows,
  industryPlan422,
  characteristics422,
  orderHydrogen,
  waterGate422,
  assert422Economy,
} from "../dist/src/economy-round4-2-2-model.js";
import {
  simulateRound421Economy,
  strip421Rows,
} from "../dist/src/economy-round4-2-1-model.js";
import { marginal421 } from "../dist/src/economy-round4-2-1-policy.js";
import { restartProfile } from "../dist/src/economy-round4-facilities.js";
import {
  inputs422,
  lane422,
  hash422,
} from "../scripts/econ-round4-2-2-inputs.mjs";
import {
  lhs422,
  rounded422,
  pairProduction422,
} from "../scripts/econ-round4-2-2-calibrate.mjs";
const { p, e, inputs, profile, config } = inputs422(),
  pol = validate422(),
  opt = {
    round4: profile.parameters,
    round41: lane422(profile.policy41, "self"),
    scenario: "E0",
    seed: "econ-1",
  },
  args = {
    baseProcessU: 1000,
    fastProcessU: 1000,
    rawWorkU: 4000,
    maxHydrogenU: 85,
    oreU: 600,
    yieldFraction: 0.25,
    assistedBoost: 0.15,
    alloyPrice: 2.3,
    hydrogenPrice: 0.1,
    processGWhPerU: 0.001,
    powerPrice: 0.01,
    baseOperatingC: 50,
  },
  run = simulateRound422Economy(p, e, inputs, { ...opt, round422: pol });
const empty = () => ({
    waterQ: 0,
    byproductWaterQ: 0,
    hydrogenQ: 0,
    finiteByproductHQ: 0,
    byproductRateCapQ: 0,
    baseNeedHQ: 0,
    history: [],
    plants: [],
  }),
  water = (over = {}) => ({
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
  }),
  hist = (q = 0) => [{ waterQ: q, baseHydrogenQ: 0, byproductHQ: 0 }],
  plant = (capacityQ, extra = {}) => ({
    capacityQ,
    completedTick: 0,
    active: true,
    natural: false,
    utilization: 1,
    ...extra,
  });
test("422 reproduces421 ore bottleneck and replaces it with true extra alloy at unchanged ore", () => {
  const old = marginal421(args, { ...pol, boost: 0.24 }),
    now = splitWork422({ ...args, availableHydrogenU: 1e6 }, pol);
  assert.equal(old.deltaAlloyU, 0);
  assert.equal(old.profitable, false);
  assert.ok(now.marginal.profitable);
  assert.ok(Math.abs(now.processU - 600) < 1e-8);
  assert.ok(Math.abs(now.yieldBonusAlloyU - 600 * 0.25 * 0.15) < 0.01);
});
test("422 yield is not an extra capacity coefficient at any searched value", () => {
  for (const y of [0.05, 0.15, 0.25]) {
    const x = marginal422({ ...args, oreU: 1e6 }, { ...pol, yieldBonus: y });
    assert.ok(Math.abs(x.capacity - args.baseProcessU * 1.15) < 1e-9);
    assert.equal(x.extraOperatingC, 0);
  }
});
test("422 actual-ore p* credits only actual conventional H, not a fictional nominal85U", () => {
  for (const y of [0.1, 0.15, 0.2]) {
    const q = { ...pol, yieldBonus: y, hydrogenPerAlloyU: 1 },
      m = marginal422(args, q);
    assert.equal(m.conventional.hydrogenU, 0);
    assert.ok(Math.abs(m.breakEvenC - (y * 2.3) / (1 + y)) < 1e-10);
    assert.equal(
      marginal422({ ...args, hydrogenPrice: m.breakEvenC + 1e-8 }, q)
        .profitable,
      false,
    );
  }
});
test("422 no H is the full old unassisted recipe with zero yield gain", () => {
  const x = splitWork422({ ...args, oreU: 2000, availableHydrogenU: 0 }, pol);
  assert.equal(x.processU, 1000);
  assert.equal(x.yieldBonusAlloyU, 0);
  assert.equal(x.hydrogenU, 0);
});
test("422 partial H never spends both recipes against the same quanta or creates ore capacity", () => {
  for (const ore of [0, 600, 2000])
    for (const H of [0, 0.001, 0.005, 1, 20, 30, 100, 400, 10000]) {
      const x = splitWork422(
        { ...args, oreU: ore, availableHydrogenU: H },
        pol,
      );
      assert.ok(x.hydrogenU <= H + 1e-8);
      assert.ok(x.processU <= Math.min(ore, 1150) + 1e-8);
      assert.ok(x.reductionTime >= 0 && x.reductionTime <= 1);
      assert.ok(x.reductionProcessU <= x.processU + 1e-8);
    }
});
test("422 expensive reduction falls back to unchanged conventional decisions", () => {
  const x = splitWork422(
    { ...args, hydrogenPrice: 100, availableHydrogenU: 1e6 },
    pol,
  );
  assert.equal(x.reductionTime, 0);
  assert.equal(x.yieldBonusAlloyU, 0);
  assert.equal(x.hydrogenU, 0);
});
test("422 the same ore workload has the same electricity and O/M, even with bonus alloy", () => {
  const s = createRound422Economy(p, e, inputs, opt),
    b = s.planets.earth,
    a = b.assets.find((a) => a.kind === "industry");
  b.hydrogenPrice = 0.01;
  const budget = () => ({ ore: { private: 0 }, hydrogen: { private: 1e9 } }),
    x = industryPlan422(s, b, a, 0, budget());
  const before = s.r422;
  s.r422 = { ...before, enabled: false };
  const old = industryPlan422(s, b, a, 0, budget());
  assert.ok(Math.abs(x.processU - old.processU) < 1e-8);
  assert.ok(Math.abs(x.energyGWh - old.energyGWh) < 1e-8);
  assert.equal(x.capacityRatio422, 1);
  assert.ok(x.alloyU > old.alloyU);
  s.r422 = before;
});
test("422 s shortens only smelter ramp and retains96h heat and mine recovery", () => {
  const a = { restartMonth: 0 },
    r = run.state.r,
    x = restartProfile(a, r, 0),
    y = restart422(a, r, 0, pol);
  assert.equal(x.mineFactor, y.mineFactor);
  assert.equal(y.heaterHours, 96);
  assert.ok(y.smeltFactor > x.smeltFactor);
});
test("422 strict5-axis validation rejects removed b, fractional gate horizons, and edits to fixed values", () => {
  for (const x of [
    { boost: 0.2 },
    { yieldBonus: 0.049 },
    { yieldBonus: 0.251 },
    { waterGateFraction: 0.49 },
    { waterGateMonths: 2 },
    { waterGateMonths: 13 },
    { waterGateMonths: 3.2 },
    { hydrogenPerAlloyU: NaN },
    { cashReserveMonths: 0 },
    { rampSpeed: 0.2 },
    { waterIntakeCostShare: 0 },
    { lifeLitersPerPersonDay: 0.1 },
  ])
    assert.throws(() => validate422(x));
  assert.equal(pol.hydrogenPerAlloyU, 1.06);
});
test("422 actual recipe alloy gain comes out of residue, conserving ore and reaction oxygen mass", () => {
  const t = run.state.book.turnover;
  assert.equal(t["smelting-ore"], t["smelting-alloy"] + t["smelting-residue"]);
  assert.equal(t["reduction-hydrogen"], t["reduction-water"]);
  assert.equal(
    t["reduction-hydrogen"] * 500 + t["reduction-ore-oxygen"] * 10000,
    t["reduction-water"] * 4500,
  );
  assert.ok(run.state.planets.earth.total.yieldBonusAlloyU > 0);
  assert422Economy(run.state);
});
test("422 identical baseline37 values, base yield, canonical populations, and fusion2.5 are preserved", () => {
  for (const [k, v] of Object.entries(profile.parameters))
    if (k !== "hydrogenPrice") assert.equal(run.state.r[k], v);
  assert.equal(run.state.r.hydrogenPrice, 0.4);
  assert.equal(run.state.fuelU, 2.5);
  assert.equal(
    run.state.tech.yieldFraction,
    createRound422Economy(p, e, inputs, opt).tech.yieldFraction,
  );
  assert.equal(p.bodies.earth.populationPersons, 8893e6);
  assert.equal(run.state.book.turnover["mining-hydrogen"] ?? 0, 0);
});
test("422 no water stock, source or known production cannot bootstrap a new electrolyzer", () => {
  const q = forecastWater422(water());
  assert.equal(q.allowed, false);
  assert.equal(q.minimumCoverage, 0);
  assert.equal(q.firstShortTick, 0);
});
test("422 water stock is consumed across the horizon, never counted fresh each month", () => {
  const a = water();
  a.owners.government.waterQ = 200;
  assert.equal(forecastWater422(a).allowed, false);
  a.owners.government.waterQ = 250;
  const q = forecastWater422(a);
  assert.equal(q.allowed, true);
  assert.equal(q.minimumCoverage, 0.5);
  a.fraction = 0.51;
  assert.equal(forecastWater422(a).allowed, false);
});
test("422 gate begins at completion, including older plants consumption during construction", () => {
  const a = water({ readyTick: 2 });
  a.owners.government.waterQ = 600;
  a.owners.government.plants = [plant(100)];
  const q = forecastWater422(a);
  assert.equal(q.allowed, false);
  assert.equal(q.operatingMonthsChecked, 3);
  assert.equal(q.forecast[0].operating, false);
  assert.equal(q.forecast[2].operating, true);
});
test("422 life support gets byproduct water before new industrial intake", () => {
  const a = water({ body: "moon", population: 30 });
  a.owners.government.waterQ = 300;
  a.owners.government.byproductWaterQ = 300;
  const q = forecastWater422(a);
  assert.equal(q.allowed, false);
  assert.equal(q.forecast[0].lifeWaterQ.government, 100);
  assert.equal(q.forecast[0].newDrawQ.government, 100);
  assert.equal(q.forecast[1].newDrawQ.government, 0);
});
test("422 one owner cannot pledge the other owners water stock", () => {
  const a = water();
  a.owners.private.waterQ = 1000;
  assert.equal(forecastWater422(a).allowed, false);
});
test("422 natural intake is shared once across owners and pending facility commitments", () => {
  const a = water({ naturalCapacityQ: 100, candidateNatural: true });
  a.owners.government.plants = [plant(80, { natural: true })];
  a.owners.private.plants = [plant(80, { natural: true })];
  const q = forecastWater422(a);
  assert.equal(q.allowed, false);
  assert.ok(q.maxNaturalIntakeQ <= 100);
  assert.ok(
    q.forecast.every(
      (m) => m.naturalIntakeQ.government + m.naturalIntakeQ.private <= 100,
    ),
  );
});
test("422 declared natural source can supply a new plant without inventing an ice mine or water import", () => {
  const q = forecastWater422(
    water({ naturalCapacityQ: 100, candidateNatural: true }),
  );
  assert.equal(q.allowed, true);
  assert.equal(q.minimumCoverage, 1);
  assert.equal(q.maxNaturalIntakeQ, 100);
});
test("422 pending older plants reserve water when they commission within the horizon", () => {
  const a = water();
  a.owners.government.waterQ = 500;
  a.owners.government.plants = [plant(150, { completedTick: 1 })];
  assert.equal(forecastWater422(a).allowed, false);
});
test("422 recorded water production is capped by actual H and its finite source budget", () => {
  const a = water({ readyTick: 1 });
  a.owners.government = { ...empty(), hydrogenQ: 200, history: hist(200) };
  assert.equal(forecastWater422(a).allowed, false);
  a.owners.government.hydrogenQ = 500;
  assert.equal(forecastWater422(a).allowed, true);
  a.owners.government.hydrogenQ = 0;
  a.owners.government.byproductRateCapQ = 200;
  a.owners.government.history = [
    { waterQ: 200, baseHydrogenQ: 0, byproductHQ: 200 },
  ];
  assert.equal(forecastWater422(a).allowed, false);
});
test("422 proposed plant H output is not credited to approve its own water supply", () => {
  const a = water({ months: 6 });
  a.owners.government.waterQ = 300;
  a.owners.government.history = hist(100);
  assert.equal(forecastWater422(a).allowed, false);
});
test("422 forecasting is read only and never retroactively removes an existing facility", () => {
  const a = water();
  a.owners.government.plants = [plant(100)];
  const before = structuredClone(a);
  forecastWater422(a);
  assert.deepEqual(a, before);
});
test("422 invalid water custody, forecast history or plant data fail closed", () => {
  const a = water();
  a.owners.government.byproductWaterQ = 1;
  assert.throws(() => forecastWater422(a));
  const b = water();
  b.owners.private.history = [
    { waterQ: NaN, baseHydrogenQ: 0, byproductHQ: 0 },
  ];
  assert.throws(() => forecastWater422(b));
});
test("422 actual dry-Moon construction is deferred without touching money; retries are one proposal", () => {
  const x = simulateRound422Economy(p, e, inputs, {
      ...opt,
      months: 40,
      scenario: "H-CUT-CONTROL",
      cut: {
        body: "earth",
        startMonth: 60,
        durationMonths: 9,
        inventoryLossFraction: 1,
        fundedColonyFixture: true,
        enabled: false,
      },
    }),
    s = x.state,
    b = s.planets.moon;
  assert.ok(b.waterProposals422.length > 0);
  const count = b.waterProposals422.length,
    proposal = b.pendingWater422.government,
    attempts = proposal.attempts,
    before = hash422(s.book.balance);
  assert.equal(orderHydrogen(s, b, "government", 2), false);
  assert.equal(orderHydrogen(s, b, "government", 2), false);
  assert.equal(hash422(s.book.balance), before);
  assert.equal(b.waterProposals422.length, count);
  assert.equal(proposal.attempts, attempts + 1);
  assert.ok(proposal.firstQuoteC > 0);
  assert.ok(proposal.latestQuoteC > 0);
});
test("422 public/control OFF retains independent421 full core rows in both fiscal lanes and H-CUT", () => {
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
          round41: lane422(profile.policy41, lane),
          months: 72,
          scenario: body ? "H-CUT-test" : "E5-M",
          cut,
          adapterControl: true,
        };
      const old = simulateRound421Economy(p, e, inputs, {
          ...o,
          round421: { enabled: false },
        }),
        now = simulateRound422Economy(p, e, inputs, {
          ...o,
          round422: { enabled: false },
        });
      assert.equal(
        hash422(strip422Rows(now.rows)),
        hash422(strip421Rows(old.rows)),
      );
    }
});
test("422 forecast does not peek at a future scheduled H-CUT: prefix0–60 remains identical", () => {
  const o = {
      ...opt,
      scenario: "H-CUT-moon-M9-L100",
      months: 60,
      round422: pol,
    },
    cut = {
      body: "moon",
      startMonth: 60,
      durationMonths: 9,
      inventoryLossFraction: 1,
      fundedColonyFixture: true,
    };
  const a = simulateRound422Economy(p, e, inputs, { ...o, cut }),
    b = simulateRound422Economy(p, e, inputs, {
      ...o,
      cut: { ...cut, enabled: false },
    });
  assert.equal(hash422(a.rows), hash422(b.rows));
});
test("422 local electrolysis is exactly zero for the six cut settlements and actual fuel recovers by fallback", () => {
  const x = simulateRound422Economy(p, e, inputs, {
    ...opt,
    months: 72,
    scenario: "H-CUT-mars-M6-L100",
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
  assert422Economy(x.state);
});
test("422 cash safety is the unchanged421 rule; own H is not a cash receipt", () => {
  assert.deepEqual(safeSpend422(1000, 100, 3, 800), {
    floorC: 300,
    spendC: 700,
    allowed: false,
    blocked: true,
  });
  for (const b of Object.values(run.state.planets)) {
    assert.equal(b.flow.governmentSelfSalesC, 0);
    const h = b.h422.private;
    assert.equal(
      h.producedQ,
      h.ownQ + h.usedOwnQ + h.soldOwnQ + h.lostOwnQ + h.exportedOwnQ,
    );
  }
});
test("422 recipe or water provenance tampering is detected", () => {
  const s = createRound422Economy(p, e, inputs, opt);
  s.planets.earth.total.yieldBonusAlloyU = 1;
  assert.throws(() => assert422Economy(s));
  s.planets.earth.total.yieldBonusAlloyU = 0;
  s.planets.earth.h422.private.waterQ = 1e12;
  assert.throws(() => assert422Economy(s));
});
test("422 five-axis deterministic LHS has32 continuous strata and all discrete gate horizons", () => {
  const a = lhs422(config);
  assert.deepEqual(a, lhs422(config));
  assert.equal(a.length, 32);
  for (const [k, [lo, hi]] of Object.entries(config.ranges)) {
    if (k === "waterGateMonths") {
      assert.equal(new Set(a.map((x) => x[k])).size, 10);
      assert.ok(a.every((x) => Number.isInteger(x[k])));
    } else
      assert.equal(
        new Set(a.map((x) => Math.floor(((x[k] - lo) / (hi - lo)) * 32))).size,
        32,
      );
    for (const x of a) {
      const r = rounded422(x);
      assert.ok(r[k] >= lo && r[k] <= hi);
      validate422(r);
    }
  }
});
test("422 all22912-month windows are strict and Earth >1 is now checked in the explicit uncut references", async () => {
  const { compareProduction422 } = await import(
      "../scripts/econ-round4-2-2-analysis.mjs"
    ),
    off = Array(240).fill(100),
    on = [...off];
  on[0] += 20;
  on[239] -= 10;
  const c = compareProduction422(on, off);
  assert.equal(c.wholePeriod, true);
  assert.equal(c.all12MonthWindows, false);
  assert.equal(c.worstStartMonth, 229);
  const r = {
    scenario: "E0",
    checks: {},
    productionPathQ: { earth: off, moon: off, mars: off },
  };
  pairProduction422(r, { productionPathQ: r.productionPathQ });
  assert.equal(r.checks.uncutProduction_earth, true);
  assert.equal(r.checks.earthStrictNetProduction, false);
});
test("422 all1406 preexisting files including previous reports remain byte identical", () => {
  const m = JSON.parse(
    fs.readFileSync("docs/econ-sim/round4-2-2/preservation-manifest.json"),
  );
  assert.equal(Object.keys(m.files).length, 1406);
  for (const [f, h] of Object.entries(m.files))
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"),
      h,
      f,
    );
});
test("422 funded natural-source construction records the full approved commissioning window", () => {
  const x = simulateRound422Economy(p, e, inputs, { ...opt, months: 60 }),
    s = x.state,
    b = s.planets.earth,
    n = b.assets.length;
  assert.equal(orderHydrogen(s, b, "government", 1), true);
  assert.equal(b.assets.length, n + 1);
  const a = b.assets.at(-1),
    w = a.waterApproval422;
  assert.ok(w.minimumCoverage >= w.fraction);
  assert.equal(w.months, pol.waterGateMonths);
  assert.equal(w.operatingMonthsChecked, w.months);
  assert.equal(w.requestCapacityQ, Math.round(a.capacityU * 1000));
});

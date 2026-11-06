import crypto from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inputs42, hash42, lane42 } from "../scripts/econ-round4-2-inputs.mjs";
import {
  POLICY42,
  validate42,
  validateCut42,
  mode42,
  process42,
  breakEven42,
  switchCost42,
  restart42,
  lifeWater42,
  reductionHydrogenQ42,
  reductionMass42,
  rollingSwitches42,
} from "../dist/src/economy-round4-2-policy.js";
import {
  createRound42Economy,
  tickRound42Economy,
  simulateRound42Economy,
  strip42Rows,
  assert42Economy,
  updateModes42,
  industryPlan42,
} from "../dist/src/economy-round4-2-model.js";
import { simulateRound41Economy } from "../dist/src/economy-round4-1-model.js";
import {
  restartProfile,
  restartCharge,
} from "../dist/src/economy-round4-facilities.js";
import { account } from "../dist/src/economy-energy-ledger.js";
import { lhs42, rounded42 } from "../scripts/econ-round4-2-calibrate.mjs";
import {
  financial42,
  maxSwitches42,
  metrics42,
} from "../scripts/econ-round4-2-analysis.mjs";
const data = inputs42(),
  { p, e, inputs, profiles, config } = data,
  profile = profiles[3],
  r = profile.parameters,
  opt = { round4: r, round41: profile.policy41, scenario: "E0" },
  policy = {
    ...POLICY42,
    boost: 0.25,
    hydrogenPerAlloyU: 0.9,
    enterMonths: 1,
    lifeLitersPerPersonDay: 0.1,
  };
const full = simulateRound42Economy(p, e, inputs, { ...opt, round42: policy });
const plant = {
  id: "smelter",
  creditBasisC: 39000,
  mineCreditC: 14500,
  kind: "industry",
  state: "active",
  smeltMode: "conventional",
};
test("42 public OFF delegates immutable4.1 for all5 frozen profiles and both fiscal lanes", () => {
  for (const b of profiles)
    for (const lane of ["self", "relief"]) {
      const o = {
          round4: b.parameters,
          round41: lane42(b.policy41, lane),
          scenario: "E5-M",
          months: 72,
        },
        a = simulateRound41Economy(p, e, inputs, o),
        b42 = simulateRound42Economy(p, e, inputs, {
          ...o,
          round42: { enabled: false },
        });
      assert.equal(hash42(a.rows), hash42(b42.rows));
    }
});
test("42 separate adapter disabled reproduces old settlements rather than masking a copied-kernel drift", () => {
  for (const scenario of ["E0", "E2-S", "E5-X", "E6-R", "E11-M"]) {
    const o = { ...opt, scenario, months: 100 },
      a = simulateRound41Economy(p, e, inputs, o),
      b = simulateRound42Economy(p, e, inputs, {
        ...o,
        round42: { enabled: false },
        adapterControl: true,
      });
    assert.equal(hash42(a.rows), hash42(strip42Rows(b.rows)), scenario);
  }
});
test("42 rejects nonfinite inputs, unapproved axis ranges and bad cut protocols", () => {
  for (const [k, v] of [
    ["boost", NaN],
    ["rampSpeed", 0.9],
    ["enterMonths", 0],
    ["exitRatio", 1],
    ["switchDays", 0],
    ["switchOutput", 1],
    ["waterIntakeCostShare", -1],
    ["enabled", "yes"],
  ])
    assert.throws(() => validate42({ [k]: v }));
  for (const x of [
    { body: "sun" },
    { durationMonths: 0 },
    { startMonth: 59 },
    { inventoryLossFraction: 0.2 },
    { fundedColonyFixture: "yes" },
  ])
    assert.throws(() =>
      validateCut42({
        body: "moon",
        durationMonths: 6,
        startMonth: 60,
        inventoryLossFraction: 1,
        fundedColonyFixture: true,
        ...x,
      }),
    );
});
test("42 exact entry and strict lower exit use the same owned plus funded-market cover, with a dead band", () => {
  const z = {
      month: 12,
      availableU: 300,
      requiredU: 100,
      baseAlloyU: 100,
      alloyPrice: 2.3,
      hydrogenPrice: 0.1,
    },
    v = validate42();
  assert.equal(mode42(plant, z, v, r).target, "hydrogenReduction");
  assert.equal(
    mode42(plant, { ...z, availableU: 299.999 }, v, r).changed,
    false,
  );
  const a = { ...plant, smeltMode: "hydrogenReduction" };
  assert.equal(
    mode42(a, { ...z, availableU: 150 }, v, r).target,
    "hydrogenReduction",
  );
  assert.equal(
    mode42(a, { ...z, availableU: 149.999 }, v, r).target,
    "conventional",
  );
});
test("42 switching becomes target mode for next monthly decision; no repeated entry or cost within the same month", () => {
  const s = createRound42Economy(p, e, inputs, { ...opt, round42: policy }),
    b = s.planets.earth,
    a = b.assets.find((a) => a.kind === "industry");
  s.book.move(
    account("earth", "government", "hydrogen"),
    account("earth", "private", "hydrogen"),
    s.book.get(account("earth", "government", "hydrogen")),
    "test-explicit-manual-transfer",
  );
  b.hydrogenPrice = 0.02;
  updateModes42(s, b);
  const before = hash42(s.book.balance),
    events = s.events42.length;
  updateModes42(s, b);
  assert.equal(hash42(s.book.balance), before);
  assert.equal(s.events42.length, events);
  assert.equal(a.modeDecisionMonth42, 0);
});
test("42 an uneconomic high-H quote never enters despite ample H, and equality fails the strict economic test", () => {
  const v = validate42(),
    z = {
      month: 0,
      availableU: 1e9,
      requiredU: 100,
      baseAlloyU: 1000,
      alloyPrice: 2.3,
      hydrogenPrice: 10,
    };
  assert.equal(mode42(plant, z, v, r).changed, false);
  const c = switchCost42(plant, r, v) / (12 * z.baseAlloyU),
    be = breakEven42(v, z.alloyPrice, c);
  assert.equal(
    mode42(plant, { ...z, hydrogenPrice: be }, v, r).profitable,
    false,
  );
});
test("42 reference break-even matches the specified b/(1+b) formula without adding carbon costs", () => {
  for (const b of [0.1, 0.15, 0.25])
    assert.ok(
      Math.abs(
        breakEven42({ ...POLICY42, boost: b }, 2.3) - (b * 2.3) / (1 + b),
      ) < 1e-12,
    );
  assert.ok(
    switchCost42(plant, r, POLICY42) <
      restartCharge({ ...plant, state: "paused" }, r).creditC,
  );
});
test("42 switch penalty is a short month fraction, not a cold96h restart or free full throughput", () => {
  const v = validate42(),
    x = process42(
      { ...plant, smeltMode: "switching", smeltTarget: "hydrogenReduction" },
      v,
    );
  assert.ok(
    Math.abs(
      x.capacityFactor -
        (1 + v.boost) * (1 - (v.switchDays / 30) * (1 - v.switchOutput)),
    ) < 1e-12,
  );
  assert.equal(process42(plant, v).capacityFactor, 1);
});
test("42 speed shortens only restart ramp, preserving mining recovery and96 heater hours", () => {
  const a = { ...plant, restartMonth: 0, smeltMode: "hydrogenReduction" },
    v = validate42(),
    base = restartProfile(a, r, 0),
    fast = restart42(a, r, 0, v);
  assert.equal(fast.heaterHours, 96);
  assert.equal(base.heaterHours, fast.heaterHours);
  assert.equal(fast.mineFactor, base.mineFactor);
  assert.ok(fast.smeltFactor > base.smeltFactor);
  assert.deepEqual(
    restart42({ ...a, smeltMode: "conventional" }, r, 0, v),
    base,
  );
});
test("42 integer reaction includes ore oxygen in residue:500kg H +4000kg O =4500kg water", () => {
  for (const n of [0, 5, 1000, 1000000]) {
    const x = reductionMass42(n);
    assert.equal(x.waterQ, n);
    assert.equal(x.hydrogenQ * 500 + x.residueOxygenQ * 10000, x.waterQ * 4500);
  }
  assert.throws(() => reductionMass42(1));
  for (const alloyQ of [1, 17, 812000]) {
    const n = reductionHydrogenQ42(alloyQ, policy);
    assert.equal(n % 5, 0);
    assert.ok(
      n >= alloyQ * policy.hydrogenPerAlloyU &&
        n < alloyQ * policy.hydrogenPerAlloyU + 5,
    );
  }
});
test("42 new alloy uses reduction H only, replacing assisted H; actual partial backup retains conventional output", () => {
  const a = full.state.book.turnover;
  assert.equal(a["reduction-hydrogen"], a["reduction-water"]);
  assert.ok(a["reduction-hydrogen"] > 0);
  assert.ok(full.state.planets.earth.total.reductionOwnHydrogenU > 0);
  assert.ok(full.state.planets.earth.total.conventionalFallbackAlloyU >= 0);
  assert42Economy(full.state);
});
test("42 Earth has no life-water requirement; colonial net makeup is an explicit input", () => {
  assert.equal(lifeWater42("earth", 8893e6, policy), 0);
  assert.equal(
    lifeWater42("moon", 200000, { ...policy, lifeLitersPerPersonDay: 0.1 }),
    (200000 * 0.1 * 30) / 4500,
  );
  const x = full.state.planets.earth;
  assert.equal(x.total.lifeWaterDemandU, 0);
  assert.ok(x.total.waterRecycledU > 0);
  assert.ok(x.total.waterRecycleAvoidedC > 0);
});
test("42 water allocation and source pools conserve exact quanta and never credit oxygen sales", () => {
  const s = full.state;
  for (const b of Object.values(s.planets)) {
    const pools = Object.values(b.h42).reduce((n, a) => n + a.waterQ, 0);
    assert.equal(
      Math.round(b.total.reductionWaterU * 1000),
      pools +
        Math.round((b.total.lifeWaterServedU + b.total.waterRecycledU) * 1000),
    );
    for (const owner of ["private", "government"]) {
      const a = b.h42[owner];
      assert.equal(
        a.producedQ,
        a.ownQ + a.usedOwnQ + a.soldOwnQ + a.lostOwnQ + a.exportedOwnQ,
      );
      assert.ok(a.ownQ <= s.book.get(account(b.id, owner, "hydrogen")));
    }
  }
  assert.equal(s.book.turnover["oxygen-sale:C"] ?? 0, 0);
});
test("42 owned H/own use never becomes market revenue or an automatic government reserve sale", () => {
  const s = full.state,
    privateH = s.planets.earth.h42.private;
  assert.ok(privateH.usedOwnQ > 0);
  assert.equal(s.book.trace, null);
  assert.equal(
    Object.values(s.planets).reduce(
      (n, b) => n + b.flow.governmentSelfSalesC,
      0,
    ),
    0,
  );
  assert.equal(s.planets.earth.h42.government.soldOwnQ, 0);
});
test("42 ledger tampering, water fabrication and provenance inflation fail inherited or added audits", () => {
  const s = createRound42Economy(p, e, inputs, opt);
  s.planets.earth.h42.private.producedQ = 1;
  assert.throws(() => assert42Economy(s));
  s.planets.earth.h42.private.producedQ = 0;
  s.planets.earth.h42.private.waterQ = 1e12;
  assert.throws(() => assert42Economy(s));
});
test("42 rolling twelve-month switch counts include decommissioned-asset history, not just survivors", () => {
  const x = [
    { body: "earth", asset: "a", month: 0, changed: true },
    { body: "earth", asset: "a", month: 6, changed: true },
    { body: "earth", asset: "a", month: 11, changed: true },
    { body: "earth", asset: "a", month: 12, changed: true },
  ];
  assert.equal(maxSwitches42(x), 3);
  assert.equal(rollingSwitches42(x, 12), 3);
});
test("42 H-CUT loss/production window starts at tick60 and covers exactly6 settlements", () => {
  const o = {
      ...opt,
      scenario: "H-CUT-mars-M6-L100",
      round42: policy,
      cut: {
        body: "mars",
        startMonth: 60,
        durationMonths: 6,
        inventoryLossFraction: 1,
        fundedColonyFixture: true,
      },
    },
    x = simulateRound42Economy(p, e, inputs, o),
    rows = x.rows.filter((r) => r.month > 60 && r.month <= 66);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.planets.mars.flow.hydrogenElectrolysisU === 0));
  assert.ok(x.rows[60].planets.mars.flow.hydrogenElectrolysisU >= 0);
  assert.equal(x.state.book.turnover["cut-hydrogen-loss"] > 0, true);
  assert.ok(x.state.planets.mars.assets.some((a) => a.kind === "industry"));
  assert.equal(x.state.planets.mars.cutFundingC42, 60000);
  assert.ok(
    x.state.shipmentHistory.some(
      (s) =>
        s.resourceId === "hydrogen" && s.changedOwner && s.goodsPaymentC > 0,
    ),
  );
});
test("42 all old37 parameters, canonical populations, units and normal fusion2.5 remain unchanged", () => {
  assert.equal(full.state.fuelU, 2.5);
  for (const [k, v] of Object.entries(r))
    if (k !== "hydrogenPrice") assert.equal(full.state.r[k], v);
  assert.equal(full.state.r.hydrogenPrice, 0.4);
  assert.equal(p.bodies.earth.populationPersons, 8893e6);
  assert.equal(full.state.e.industryMix, e.industryMix);
});
test("42 LHS uses all64 strata on each new axis, is deterministic, and rounding stays bounded", () => {
  const a = lhs42(config),
    b = lhs42(config);
  assert.deepEqual(a, b);
  assert.equal(a.length, 64);
  for (const [k, [lo, hi]] of Object.entries(config.ranges)) {
    assert.equal(
      new Set(a.map((p) => Math.floor(((p[k] - lo) / (hi - lo)) * 64))).size,
      64,
    );
    for (const p of a) {
      const q = rounded42(p, config);
      assert.ok(q[k] >= lo && q[k] <= hi);
    }
  }
});
test("42 finance is read-only: observed cost and payback do not guarantee entrant sales or self-cash", () => {
  const before = hash42(full.state.book.balance),
    m = metrics42(full, p, e, profile, policy, config, {
      scenario: "E0",
      seed: "econ-1",
      lane: "self",
    });
  assert.equal(hash42(full.state.book.balance), before);
  assert.ok(Number.isFinite(m.bodies.earth.price));
  assert.ok(Number.isFinite(m.bodies.earth.observedCost));
  assert.equal(m.checks.hydrogenMargin, m.legacyChecks.hydrogenMargin);
  const f0 = financial42(
    p,
    e,
    { ...r, hydrogenPrice: 0.4 },
    { utilization: 0, price: 0.4 },
  );
  assert.equal(f0.paybackYears, null);
});
test("42 every previously tracked file retains its baseline bytes; no game or old report changed", () => {
  const m = JSON.parse(
    fs.readFileSync("docs/econ-sim/round4-2/preservation-manifest.json"),
  );
  for (const [f, h] of Object.entries(m.files))
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"),
      h,
      f,
    );
});

test("42 loss of H has a complete conventional dispatch backup without a second assisted-H recipe", () => {
  const s = createRound42Economy(p, e, inputs, { ...opt, round42: policy }),
    b = s.planets.earth,
    asset = b.assets.find((a) => a.kind === "industry"),
    budget = (h) => ({ ore: { private: 1e9 }, hydrogen: { private: h } }),
    conv = industryPlan42(
      s,
      b,
      { ...asset, smeltMode: "conventional" },
      0,
      budget(0),
    ),
    none = industryPlan42(
      s,
      b,
      { ...asset, smeltMode: "hydrogenReduction" },
      0,
      budget(0),
    ),
    some = industryPlan42(
      s,
      b,
      { ...asset, smeltMode: "hydrogenReduction" },
      0,
      budget(100),
    );
  assert.equal(none.processU, conv.processU);
  assert.equal(none.hydrogenU, 0);
  assert.equal(none.reductionProcessU42, 0);
  assert.ok(some.processU >= conv.processU);
  assert.ok(some.processU <= conv.processU * (1 + policy.boost));
  assert.ok(some.hydrogenU <= 100);
  assert.ok(some.desiredHydrogenU > some.hydrogenU);
});

test("42 passive per-owner cost observer leaves all projected physical and financial paths identical", async () => {
  const { compact42, observedIndustry42 } = await import(
      "../scripts/econ-round4-2-analysis.mjs"
    ),
    x = simulateRound42Economy(p, e, inputs, {
      ...opt,
      round42: policy,
      capture42: true,
    });
  assert.equal(hash42(compact42(x.rows)), hash42(compact42(full.rows)));
  const f = observedIndustry42(x, p);
  assert.ok(f.investmentC > 0);
  assert.equal(f.governmentSelfSalesC, 0);
  assert.ok(f.rows.some((r) => r.hydrogenU > 0));
  assert.ok(f.rows.some((r) => r.powerGWh > 0));
});

import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  inputs43,
  read43,
  write43,
  lane43,
  hash43,
} from "./econ-round4-3-inputs.mjs";
import { simulateRound43Economy } from "../dist/src/economy-round4-3-model.js";
import { simulateRound422Economy } from "../dist/src/economy-round4-2-2-model.js";
import { simulateRound41Economy } from "../dist/src/economy-round4-1-model.js";
import { compact422 } from "./econ-round4-2-2-analysis.mjs";
import { compact43, compareProduction43 } from "./econ-round4-3-analysis.mjs";
const root = "docs/econ-sim/round4-3",
  { p, e, inputs, profile, hydrogenPolicy, config } = inputs43(),
  choices = read43(root + "/candidates.json").choices,
  final = read43(root + "/final-runs.json"),
  survival = read43(root + "/survival-runs.json"),
  controls = read43(root + "/no-cut-controls.json"),
  cuts = read43(root + "/h-cut.json"),
  all = [...final, ...survival, ...controls, ...cuts],
  replays = [],
  prefixChecks = [],
  legacy = [];
for (const [path, sha] of Object.entries(
  read43(root + "/run-source-manifest.json").source,
))
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex"),
    sha,
    "formal source changed: " + path,
  );
const controlRows = new Map();
function replay(r) {
  const x = simulateRound43Economy(p, e, inputs, {
    round4: profile.parameters,
    round41: lane43(profile.policy41, r.lane),
    round422: { ...hydrogenPolicy, enabled: r.enabled },
    round43: r.policy,
    tax43: config.tax,
    scenario: r.scenario,
    baseScenario43: r.baseScenario,
    seed: r.seed,
    cut:
      r.scenario === "H-CUT-CONTROL"
        ? {
            body: "earth",
            startMonth: 60,
            durationMonths: 9,
            inventoryLossFraction: 1,
            fundedColonyFixture: true,
            enabled: false,
          }
        : r.cut,
    adapterControl: true,
  });
  assert.equal(hash43(compact43(x.rows)), r.pathHash);
  replays.push({
    id: r.id,
    lane: r.lane,
    enabled: r.enabled,
    scenario: r.scenario,
    seed: r.seed,
    pathHash: r.pathHash,
  });
  return x;
}
for (const r of [
  ...final.filter((r) => ["E0", "E2-S"].includes(r.scenario)),
  ...controls,
  ...survival.filter((r) => r.seed === config.seeds[0]),
]) {
  const x = replay(r);
  if (r.stage === "control")
    controlRows.set([r.id, r.lane, r.enabled, r.seed].join("/"), x.rows);
}
for (const r of cuts.filter(
  (r) =>
    r.seed === config.seeds[0] &&
    r.cut.durationMonths === 9 &&
    r.cut.inventoryLossFraction === 1,
)) {
  const x = replay(r),
    control = controlRows.get([r.id, r.lane, r.enabled, r.seed].join("/"));
  assert.equal(
    hash43(compact43(x.rows.slice(0, 61))),
    hash43(compact43(control.slice(0, 61))),
  );
  prefixChecks.push({
    id: r.id,
    lane: r.lane,
    enabled: r.enabled,
    body: r.cut.body,
    month0Through60Exact: true,
  });
}
let productionChecks = 0,
  waterApprovals = 0,
  lifeAudits = 0,
  fiscalYears = 0,
  guards = 0;
for (const r of all) {
  const delta = Math.round(
      (r.national.endingTreasuryC - r.national.initialTreasuryC) * 1000,
    ),
    net = Object.values(r.bodies).reduce(
      (n, b) => n + Math.round(b.cashContributionC * 1000),
      0,
    );
  assert.equal(delta, net);
  assert.equal(r.national.negativeMonths, 0);
  for (const id of ["earth", "moon", "mars"]) {
    const b = r.bodies[id];
    assert.ok(
      Math.abs(b.oxygenProducedU - b.oxygenServedU - b.oxygenStockU) < 0.001,
    );
    assert.ok(
      b.iceUsedFraction === null ||
        (b.iceUsedFraction >= 0 && b.iceUsedFraction <= 1),
    );
    for (const a of b.annualFiscal) {
      assert.equal(
        Math.round(a.netTaxC * 1000),
        Math.round(a.taxC * 1000) - Math.round(a.spendingC * 1000),
      );
      assert.equal(
        Math.round(a.cashNetC * 1000),
        Math.round(a.inflowC * 1000) - Math.round(a.spendingC * 1000),
      );
      fiscalYears++;
    }
    assert.equal(
      Math.round(b.taxC * 1000),
      b.annualFiscal.reduce((n, a) => n + Math.round(a.taxC * 1000), 0),
    );
    assert.equal(
      Math.round(b.spendingC * 1000),
      b.annualFiscal.reduce((n, a) => n + Math.round(a.spendingC * 1000), 0),
    );
    if (r.policy.iceEnabled && id !== "earth") {
      assert.equal(
        r.checks["lifeWater_" + id],
        b.life.water.eligibleMonths > 0 && b.life.water.below99Months === 0,
      );
      assert.equal(
        r.checks["lifeOxygen_" + id],
        b.life.oxygen.eligibleMonths > 0 && b.life.oxygen.below99Months === 0,
      );
      lifeAudits += 2;
    }
    for (const a of b.waterApprovals) {
      assert.equal(a.months, 12);
      assert.equal(a.fraction, 0.72);
      assert.equal(a.operatingMonthsChecked, 12);
      assert.ok(a.minimumCoverage >= 0.72);
      assert.ok(a.requestCapacityQ > 0);
      waterApprovals++;
    }
    for (const g of Object.values(b.guards))
      if (g.minimumPostFloorC !== null) {
        assert.ok(g.minimumPostFloorC >= -1e-7);
        guards++;
      }
  }
  if (r.enabled && r.stage !== "cut") {
    const off = all.find(
      (o) =>
        o.id === r.id &&
        o.stage === r.stage &&
        o.lane === r.lane &&
        !o.enabled &&
        o.seed === r.seed &&
        o.scenario === r.scenario,
    );
    assert.deepEqual(off.policy, r.policy);
    for (const id of ["earth", "moon", "mars"]) {
      assert.deepEqual(
        compareProduction43(r.productionPathQ[id], off.productionPathQ[id]),
        r.productionComparison[id],
      );
      productionChecks++;
    }
  }
  if (r.cut?.enabled) {
    assert.equal(r.cut.electrolysisU, 0);
    if (r.enabled) {
      const off = cuts.find(
        (o) =>
          o.id === r.id &&
          o.lane === r.lane &&
          !o.enabled &&
          o.seed === r.seed &&
          o.scenario === r.scenario,
      );
      assert.equal(
        r.cut.passesOld95,
        off.cut.producedQ > 0 &&
          BigInt(r.cut.producedQ) * 100n >= BigInt(off.cut.producedQ) * 95n,
      );
    }
  }
}
// Reuse only rounded422 archived worlds with exactly matching seeds, lanes and H modes.
const oldFinal = read43("docs/econ-sim/round4-2-2/final-runs.json").filter(
    (r) => r.id === "R422-rounded",
  ),
  oldControl = read43("docs/econ-sim/round4-2-2/no-cut-controls.json").filter(
    (r) => r.id === "R422-rounded",
  ),
  oldCuts = read43("docs/econ-sim/round4-2-2/h-cut.json").filter(
    (r) => r.id === "R422-rounded",
  );
for (const r of [
  ...oldFinal.filter((r) => ["E0", "E2-S"].includes(r.scenario)),
  ...oldControl,
  ...oldCuts.filter(
    (r) => r.cut.durationMonths === 9 && r.cut.inventoryLossFraction === 1,
  ),
]) {
  const x = simulateRound422Economy(p, e, inputs, {
    round4: profile.parameters,
    round41: lane43(profile.policy41, r.lane),
    round422: { ...hydrogenPolicy, enabled: r.enabled },
    scenario: r.scenario,
    seed: r.seed,
    cut:
      r.scenario === "H-CUT-CONTROL"
        ? {
            body: "earth",
            startMonth: 60,
            durationMonths: 9,
            inventoryLossFraction: 1,
            fundedColonyFixture: true,
            enabled: false,
          }
        : r.cut,
    adapterControl: true,
  });
  assert.equal(hash43(compact422(x.rows)), r.pathHash);
  legacy.push({
    scenario: r.scenario,
    lane: r.lane,
    enabled: r.enabled,
    seed: r.seed,
    pathHash: r.pathHash,
    bodies: Object.fromEntries(
      ["earth", "moon", "mars"].map((id) => [
        id,
        {
          minimumGovernmentC: Math.min(
            ...x.rows.map((row) => row.planets[id].governmentC),
          ),
          endingGovernmentC: x.rows.at(-1).planets[id].governmentC,
          firstCashAtOrBelow1Month:
            x.rows.find((row) => row.planets[id].governmentC <= 1)?.month ??
            null,
          month60C: x.rows[60].planets[id].governmentC,
        },
      ]),
    ),
  });
}
write43(root + "/legacy-verification.json", {
  reusedArchivedRecords: oldFinal.length + oldControl.length + oldCuts.length,
  independentlyReplayed: legacy.length,
  scope:
    "R422-rounded same seeds/lane/H mode; allE0/E2-S/control plus9-month loss100% eachbody. Other archived worlds reused but not all independently rerun.",
  records: legacy,
});
const benchmark = {
    round41: [],
    round422: [],
    round43Peace: [],
    round43Colony: [],
    round43Stress: [],
  },
  sample = choices.at(-1).policy;
for (let i = 0; i < 15; i++)
  for (const [key, fn, scenario] of [
    ["round41", simulateRound41Economy, "E0"],
    ["round422", simulateRound422Economy, "E0"],
    ["round43Peace", simulateRound43Economy, "E0"],
    ["round43Colony", simulateRound43Economy, "E2-S"],
    ["round43Stress", simulateRound43Economy, "E5-X"],
  ]) {
    const at = performance.now();
    fn(p, e, inputs, {
      round4: profile.parameters,
      round41: lane43(profile.policy41, "self"),
      round422: hydrogenPolicy,
      round43: sample,
      tax43: config.tax,
      scenario,
      seed: config.seeds[i % 5],
    });
    benchmark[key].push(performance.now() - at);
  }
const result = {
  replayExecutions: replays.length,
  legacyReplayExecutions: legacy.length,
  replays,
  prefixChecks,
  productionChecks,
  cutIntegerChecks: cuts.filter((r) => r.enabled).length,
  waterApprovals,
  lifeAudits,
  fiscalYears,
  guards,
  integrityFailures: 0,
  formalSourcesUnchanged: true,
  performanceExecutions: 75,
  performance: Object.fromEntries(
    Object.entries(benchmark).map(([k, a]) => {
      const s = [...a].sort((a, b) => a - b);
      return [k, { rawMs: a, p50Ms: s[7], p95Ms: s[14], samples: a.length }];
    }),
  ),
};
write43(root + "/verification.json", result);
console.log(
  JSON.stringify({
    ...result,
    replays: replays.length,
    prefixChecks: prefixChecks.length,
  }),
);

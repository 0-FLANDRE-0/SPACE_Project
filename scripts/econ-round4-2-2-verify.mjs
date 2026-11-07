import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  inputs422,
  read422,
  write422,
  lane422,
  hash422,
} from "./econ-round4-2-2-inputs.mjs";
import { simulateRound422Economy } from "../dist/src/economy-round4-2-2-model.js";
import { simulateRound421Economy } from "../dist/src/economy-round4-2-1-model.js";
import { simulateRound42Economy } from "../dist/src/economy-round4-2-model.js";
import { simulateRound41Economy } from "../dist/src/economy-round4-1-model.js";
import {
  compact422,
  compareProduction422,
} from "./econ-round4-2-2-analysis.mjs";
const root = "docs/econ-sim/round4-2-2",
  { p, e, inputs, profile, config } = inputs422(),
  final = read422(root + "/final-runs.json"),
  controls = read422(root + "/no-cut-controls.json"),
  cuts = read422(root + "/h-cut.json"),
  choices = read422(root + "/candidates.json").choices,
  replays = [],
  prefixChecks = [];
let productionChecks = 0,
  guardRecords = 0,
  waterApprovals = 0,
  waterProposals = 0,
  waterRetries = 0;
const controlRows = new Map();
for (const c of choices)
  for (const lane of ["self", "relief"])
    for (const enabled of [false, true])
      for (const seed of config.seeds)
        for (const scenario of ["E0", "H-CUT-CONTROL"]) {
          const r = (scenario === "E0" ? final : controls).find(
              (r) =>
                r.id === c.id &&
                r.lane === lane &&
                r.enabled === enabled &&
                r.seed === seed &&
                r.scenario === scenario,
            ),
            cut =
              scenario === "E0"
                ? null
                : {
                    body: "earth",
                    startMonth: 60,
                    durationMonths: 9,
                    inventoryLossFraction: 1,
                    fundedColonyFixture: true,
                    enabled: false,
                  },
            x = simulateRound422Economy(p, e, inputs, {
              round4: profile.parameters,
              round41: lane422(profile.policy41, lane),
              round422: { ...c.policy, enabled },
              scenario,
              seed,
              cut,
              adapterControl: true,
            });
          assert.equal(hash422(compact422(x.rows)), r.pathHash);
          replays.push({
            id: c.id,
            lane,
            enabled,
            seed,
            scenario,
            exact: true,
            pathHash: r.pathHash,
          });
          if (scenario === "H-CUT-CONTROL" && seed === config.seeds[0])
            controlRows.set([c.id, lane, enabled].join("/"), x.rows);
        }
for (const c of choices)
  for (const lane of ["self", "relief"])
    for (const enabled of [false, true])
      for (const body of ["earth", "moon", "mars"]) {
        const seed = config.seeds[0],
          scenario = `H-CUT-${body}-M9-L100`,
          r = cuts.find(
            (r) =>
              r.id === c.id &&
              r.lane === lane &&
              r.enabled === enabled &&
              r.seed === seed &&
              r.scenario === scenario,
          ),
          cut = {
            body,
            startMonth: 60,
            durationMonths: 9,
            inventoryLossFraction: 1,
            fundedColonyFixture: true,
            enabled: true,
          },
          x = simulateRound422Economy(p, e, inputs, {
            round4: profile.parameters,
            round41: lane422(profile.policy41, lane),
            round422: { ...c.policy, enabled },
            scenario,
            seed,
            cut,
            adapterControl: true,
          });
        assert.equal(hash422(compact422(x.rows)), r.pathHash);
        assert.equal(
          hash422(compact422(x.rows.slice(0, 61))),
          hash422(
            compact422(
              controlRows.get([c.id, lane, enabled].join("/")).slice(0, 61),
            ),
          ),
        );
        prefixChecks.push({
          id: c.id,
          lane,
          enabled,
          body,
          month0Through60Equal: true,
          pathHash: r.pathHash,
        });
      }
for (const r of [...final, ...controls].filter((r) => r.enabled))
  for (const body of ["earth", "moon", "mars"]) {
    const off = (r.stage === "final" ? final : controls).find(
        (o) =>
          o.id === r.id &&
          o.lane === r.lane &&
          !o.enabled &&
          o.seed === r.seed &&
          o.scenario === r.scenario,
      ),
      c = compareProduction422(
        r.productionPathQ[body],
        off.productionPathQ[body],
      );
    assert.deepEqual(c, r.productionComparison[body]);
    productionChecks++;
  }
for (const r of cuts.filter((r) => r.enabled)) {
  const c = r.cut;
  assert.equal(c.electrolysisU, 0);
  const off = BigInt(Math.round(c.offProducedU * 1000));
  assert.equal(
    off > 0 && BigInt(c.producedQ) * 100n >= off * 95n,
    r.checks.cutProduction,
  );
}
for (const r of [...final, ...controls, ...cuts])
  for (const body of ["earth", "moon", "mars"])
    for (const g of Object.values(r.bodies[body].guards)) {
      if (g.minimumPostFloorC !== null) {
        assert.ok(g.minimumPostFloorC >= -1e-7);
        guardRecords++;
      }
    }
for (const r of [...final, ...controls, ...cuts].filter((r) => r.enabled))
  for (const body of ["earth", "moon", "mars"]) {
    const b = r.bodies[body],
      ids = new Set();
    for (const a of b.waterApprovals) {
      assert.equal(
        a.months,
        choices.find((c) => c.id === r.id).policy.waterGateMonths,
      );
      assert.equal(
        a.fraction,
        choices.find((c) => c.id === r.id).policy.waterGateFraction,
      );
      assert.equal(a.operatingMonthsChecked, a.months);
      assert.ok(a.minimumCoverage + 1e-12 >= a.fraction);
      assert.ok(a.requestCapacityQ > 0);
      assert.ok(a.readyTick >= a.startTick);
      waterApprovals++;
    }
    for (const p of b.waterProposals) {
      assert.ok(!ids.has(p.id));
      ids.add(p.id);
      assert.ok(p.attempts >= 1);
      assert.ok(p.lastMonth >= p.firstMonth);
      assert.ok(p.firstQuoteC > 0 && p.latestQuoteC > 0);
      waterProposals++;
      waterRetries += p.attempts;
    }
    assert.equal(b.waterDeferredProposals, b.waterProposals.length);
    assert.equal(
      b.waterDeferredAttempts,
      b.waterProposals.reduce((n, p) => n + p.attempts, 0),
    );
    assert.ok(
      Math.abs(
        b.waterDeferredFirstQuoteC -
          b.waterProposals.reduce((n, p) => n + p.firstQuoteC, 0),
      ) < 1e-6,
    );
  }
const sample = choices.at(-1),
  oldPolicy = read422("docs/econ-sim/round4-2/candidates.json").choices.find(
    (r) => r.id === "R42-rounded",
  ).policy,
  prior421Policy = read422(
    "docs/econ-sim/round4-2-1/candidates.json",
  ).choices.find((r) => r.id === "R421-rounded").policy,
  bench = {
    round41: [],
    round42: [],
    round421: [],
    round422Peace: [],
    round422Stress: [],
  };
for (let i = 0; i < 15; i++)
  for (const [key, fn, scenario] of [
    ["round41", simulateRound41Economy, "E0"],
    ["round42", simulateRound42Economy, "E0"],
    ["round421", simulateRound421Economy, "E0"],
    ["round422Peace", simulateRound422Economy, "E0"],
    ["round422Stress", simulateRound422Economy, "E5-X"],
  ]) {
    const at = performance.now();
    fn(p, e, inputs, {
      round4: profile.parameters,
      round41: lane422(profile.policy41, "self"),
      round42: oldPolicy,
      round421: prior421Policy,
      round422: sample.policy,
      scenario,
      seed: config.seeds[i % 5],
    });
    bench[key].push(performance.now() - at);
  }
const result = {
  replayExecutions: replays.length + prefixChecks.length,
  replays,
  prefixChecks,
  productionChecks,
  cutIntegerChecks: cuts.filter((r) => r.enabled).length,
  guardRecords,
  integrityFailures: 0,
  waterApprovals,
  waterProposals,
  waterRetries,
  performanceExecutions: 75,
  performance: Object.fromEntries(
    Object.entries(bench).map(([k, a]) => {
      const s = [...a].sort((a, b) => a - b);
      return [k, { rawMs: a, p50Ms: s[7], p95Ms: s[14], samples: a.length }];
    }),
  ),
  scope:
    "Full E0/no-cut replay80 +24representative cuts. Production checks are exact integer-Q reanalysis of all final+prepared ON pairs. Transaction-time guards, not guaranteed future treasury balance.",
};
write422(root + "/verification.json", result);
console.log(
  JSON.stringify({
    ...result,
    replays: result.replays.length,
    prefixChecks: result.prefixChecks.length,
  }),
);

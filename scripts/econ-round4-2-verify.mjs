import fs from "node:fs";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  inputs42,
  read42,
  write42,
  hash42,
  lane42,
} from "./econ-round4-2-inputs.mjs";
import { simulateRound41Economy } from "../dist/src/economy-round4-1-model.js";
import { simulateRound42Economy } from "../dist/src/economy-round4-2-model.js";
import { compact42, observedIndustry42 } from "./econ-round4-2-analysis.mjs";
const root = "docs/econ-sim/round4-2",
  data = inputs42(),
  { p, e, inputs, config } = data,
  final = read42(root + "/final-runs.json"),
  cuts = read42(root + "/h-cut.json"),
  choices = read42(root + "/candidates.json").choices,
  start = performance.now(),
  replays = [],
  observations = [];
for (const c of choices)
  for (const lane of ["self", "relief"])
    for (const enabled of [false, true])
      for (const seed of config.seeds) {
        const r = final.find(
            (r) =>
              r.id === c.id &&
              r.lane === lane &&
              r.enabled === enabled &&
              r.scenario === "E0" &&
              r.seed === seed,
          ),
          x = simulateRound42Economy(p, e, inputs, {
            round4: c.profile.parameters,
            round41: lane42(c.profile.policy41, lane),
            round42: { ...c.policy, enabled },
            scenario: "E0",
            seed,
            adapterControl: true,
            capture42: true,
          });
        assert.equal(
          hash42(compact42(x.rows)),
          r.pathHash,
          "E0 passive observer changed path",
        );
        replays.push({
          id: c.id,
          lane,
          enabled,
          scenario: "E0",
          seed,
          pathHash: r.pathHash,
          exact: true,
        });
        observations.push({
          id: c.id,
          lane,
          enabled,
          seed,
          ...observedIndustry42(x, p),
        });
      }
for (const c of choices)
  for (const lane of ["self", "relief"])
    for (const scenario of [
      "E2-S",
      "E5-M",
      "E5-X",
      "E6-R",
      "E11-M",
      "E5-M-L70-S12-D2",
    ]) {
      const seed = config.seeds[0],
        r = final.find(
          (r) =>
            r.id === c.id &&
            r.lane === lane &&
            r.enabled &&
            r.scenario === scenario &&
            r.seed === seed,
        ),
        x = simulateRound42Economy(p, e, inputs, {
          round4: c.profile.parameters,
          round41: lane42(c.profile.policy41, lane),
          round42: c.policy,
          scenario,
          seed,
        });
      assert.equal(hash42(compact42(x.rows)), r.pathHash);
      replays.push({
        id: c.id,
        lane,
        enabled: true,
        scenario,
        seed,
        pathHash: r.pathHash,
        exact: true,
      });
    }
for (const r of cuts.filter((r) => r.enabled)) {
  assert.equal(r.cut.duringElectrolysisU, 0);
  const on = BigInt(Math.round(r.cut.producedU * 1000)),
    off = BigInt(Math.round(r.cut.offProducedU * 1000)),
    exact = off > 0n && on * 100n >= off * 95n;
  assert.equal(exact, r.checks.cutProduction, "Exact .001U cutoff test");
}
const sample = choices.at(-1),
  bench = { round41: [], round42Peace: [], round42Stress: [] };
for (let i = 0; i < 15; i++)
  for (const [key, fn, scenario] of [
    ["round41", simulateRound41Economy, "E0"],
    ["round42Peace", simulateRound42Economy, "E0"],
    ["round42Stress", simulateRound42Economy, "E5-X"],
  ]) {
    const at = performance.now();
    fn(p, e, inputs, {
      round4: sample.profile.parameters,
      round41: lane42(sample.profile.policy41, "self"),
      round42: sample.policy,
      scenario,
      seed: config.seeds[i % 5],
    });
    bench[key].push(performance.now() - at);
  }
const performanceResult = Object.fromEntries(
  Object.entries(bench).map(([k, a]) => {
    const sorted = [...a].sort((a, b) => a - b);
    return [k, { rawMs: a, p50Ms: sorted[7], p95Ms: sorted[14], samples: 15 }];
  }),
);
write42(root + "/industry-observer.json", {
  runs: observations.length,
  meaning:
    "Passive, path-hash verified E0 industry valuation; not a government cash sale or an extra acceptance condition.",
  observations,
});
write42(root + "/verification.json", {
  replayExecutions: replays.length,
  cutThresholdChecks: cuts.filter((r) => r.enabled).length,
  cutLossWindow: "flows in rows61..60+duration",
  coreMismatches: 0,
  replays,
  performanceExecutions: 45,
  performance: performanceResult,
  seconds: (performance.now() - start) / 1000,
});
console.log(
  JSON.stringify({
    replayExecutions: replays.length,
    cutThresholdChecks: cuts.filter((r) => r.enabled).length,
    coreMismatches: 0,
    performance: performanceResult,
  }),
);

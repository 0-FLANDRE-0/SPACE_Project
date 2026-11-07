import { performance } from "node:perf_hooks";
import { inputs43, read43, write43, lane43 } from "./econ-round4-3-inputs.mjs";
import { simulateRound43Economy } from "../dist/src/economy-round4-3-model.js";
import { simulateRound422Economy } from "../dist/src/economy-round4-2-2-model.js";
import { simulateRound41Economy } from "../dist/src/economy-round4-1-model.js";
const root = "docs/econ-sim/round4-3",
  { p, e, inputs, profile, hydrogenPolicy, config } = inputs43(),
  policy = read43(root + "/candidates.json").choices.at(-1).policy,
  bench = {
    round41: [],
    round422: [],
    round43Peace: [],
    round43Colony: [],
    round43Stress: [],
  };
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
      round43: policy,
      tax43: config.tax,
      scenario,
      seed: config.seeds[i % 5],
    });
    bench[key].push(performance.now() - at);
  }
const result = {
  scope:
    "Final75 sequential interleaved executions after calibration/tests/diagnostics/replays completed. Verification-associated75 are retained separately and not used in final reported timings. Both raw sets retained.",
  reportedExecutions: 75,
  preliminaryExecutions: 75,
  totalMeasuredExecutions: 150,
  performance: Object.fromEntries(
    Object.entries(bench).map(([k, a]) => {
      const s = [...a].sort((a, b) => a - b);
      return [k, { rawMs: a, p50Ms: s[7], p95Ms: s[14], samples: a.length }];
    }),
  ),
};
write43(root + "/performance.json", result);
console.log(JSON.stringify(result));

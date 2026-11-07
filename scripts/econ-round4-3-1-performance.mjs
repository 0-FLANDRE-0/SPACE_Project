import os from "node:os";
import { performance } from "node:perf_hooks";
import { inputs431, ROOT431, write431 } from "./econ-round4-3-1-inputs.mjs";
import { inputs43 } from "./econ-round4-3-inputs.mjs";
import { simulateRound43Economy } from "../dist/src/economy-round4-3-model.js";
import { simulateRound431Economy } from "../dist/src/economy-round4-3-1-model.js";
import { options431 } from "./econ-round4-3-1-calibrate.mjs";
const d = inputs431(),
  old = inputs43(),
  bench = { round43E0: [], round431E0: [], round431E2S: [], round431E5X: [] };
for (let i = 0; i < 15; i++)
  for (const [key, scenario] of [
    ["round43E0", "E0"],
    ["round431E0", "E0"],
    ["round431E2S", "E2-S"],
    ["round431E5X", "E5-X"],
  ]) {
    const seed = d.config.seeds[i % 5],
      opts = options431(
        d,
        { taxMode: "half", lane: "self", scenario },
        seed,
        true,
      ),
      at = performance.now();
    if (key === "round43E0")
      simulateRound43Economy(d.p, d.e, d.inputs, {
        ...opts,
        tax43: old.config.tax,
      });
    else simulateRound431Economy(d.p, d.e, d.inputs, opts);
    bench[key].push(performance.now() - at);
  }
const result = {
  scope:
    "60 quiet sequential interleaved240-month executions after formal simulations and replay checks.15 per case; own concurrent simulation/test processes finished. Not game FPS or a physical mobile benchmark.",
  executions: 60,
  environment: {
    node: process.version,
    cpu: os.cpus()[0]?.model,
    parallelism: os.availableParallelism(),
  },
  performance: Object.fromEntries(
    Object.entries(bench).map(([k, a]) => {
      const s = [...a].sort((x, y) => x - y);
      return [k, { rawMs: a, p50Ms: s[7], p95Ms: s[14], samples: a.length }];
    }),
  ),
};
write431(ROOT431 + "/performance.json", result);
console.log(JSON.stringify(result));

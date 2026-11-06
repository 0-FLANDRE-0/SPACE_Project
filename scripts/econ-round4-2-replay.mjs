import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { performance } from "node:perf_hooks";
import {
  simulateRound41Economy,
  ROUND41_SCENARIOS,
} from "../dist/src/economy-round4-1-model.js";
import { simulateRound42Economy } from "../dist/src/economy-round4-2-model.js";
import { compact41 } from "./econ-round4-1-analysis.mjs";
import {
  inputs42,
  lane42,
  read42,
  hash42,
  write42,
} from "./econ-round4-2-inputs.mjs";
import assert from "node:assert/strict";
if (!isMainThread) {
  const { p, e, inputs, config } = inputs42(),
    archived = read42("docs/econ-sim/round4-1/final-runs.json"),
    rows = [];
  for (const profile of workerData.profiles)
    for (const lane of ["self", "relief"])
      for (const scenario of ROUND41_SCENARIOS)
        for (const seed of config.seeds) {
          const options = {
              round4: profile.parameters,
              round41: lane42(profile.policy41, lane),
              scenario,
              seed,
            },
            x = simulateRound41Economy(p, e, inputs, options),
            y = simulateRound42Economy(p, e, inputs, {
              ...options,
              round42: { enabled: false },
            }),
            full = hash42(x.rows),
            off = hash42(y.rows),
            compact = hash42(compact41(x.rows)),
            prior = archived.find(
              (r) =>
                r.id === profile.id &&
                r.lane === lane &&
                r.scenario === scenario &&
                r.seed === seed,
            );
          assert.ok(prior);
          assert.equal(full, off);
          assert.equal(compact, prior.pathHash);
          rows.push({
            id: profile.id,
            baseId: profile.baseId,
            lane,
            scenario,
            seed,
            fullHash: full,
            offHash: off,
            compactHash: compact,
            archivedHash: prior.pathHash,
            equal: true,
          });
        }
  parentPort.postMessage(rows);
} else if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { profiles } = inputs42(),
    start = performance.now(),
    rows = [];
  const groups = [[], [], []];
  profiles.forEach((p, i) => groups[i % 3].push(p));
  await Promise.all(
    groups.map(
      (ps) =>
        new Promise((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), {
            workerData: { profiles: ps },
          });
          w.once("message", (x) => {
            rows.push(...x);
            console.log(
              "OFF replay completed profiles: " +
                ps.map((p) => p.id).join(",") +
                " / " +
                x.length +
                " pairs",
            );
            resolve();
          });
          w.once("error", reject);
        }),
    ),
  );
  rows.sort((a, b) =>
    [a.id, a.lane, a.scenario, a.seed]
      .join("/")
      .localeCompare([b.id, b.lane, b.scenario, b.seed].join("/")),
  );
  write42("docs/econ-sim/round4-2/off-replay.json", {
    pairs: rows.length,
    executions: rows.length * 2,
    maximumReproductionError: 0,
    seconds: (performance.now() - start) / 1000,
    rows,
  });
  console.log("PASS exact4.1 replay " + rows.length + " pairs");
}

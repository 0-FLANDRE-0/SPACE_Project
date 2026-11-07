import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  inputs421,
  read421,
  write421,
  lane421,
  hash421,
} from "./econ-round4-2-1-inputs.mjs";
import { simulateRound421Economy } from "../dist/src/economy-round4-2-1-model.js";
import { simulateRound42Economy } from "../dist/src/economy-round4-2-model.js";
import { simulateRound41Economy } from "../dist/src/economy-round4-1-model.js";
import {
  compact421,
  compareProduction421,
} from "./econ-round4-2-1-analysis.mjs";
const root = "docs/econ-sim/round4-2-1",
  { p, e, inputs, profile, config } = inputs421(),
  final = read421(root + "/final-runs.json"),
  controls = read421(root + "/no-cut-controls.json"),
  cuts = read421(root + "/h-cut.json"),
  choices = read421(root + "/candidates.json").choices,
  replays = [],
  prefixChecks = [];
let productionChecks = 0,
  guardRecords = 0;
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
            x = simulateRound421Economy(p, e, inputs, {
              round4: profile.parameters,
              round41: lane421(profile.policy41, lane),
              round421: { ...c.policy, enabled },
              scenario,
              seed,
              cut,
              adapterControl: true,
            });
          assert.equal(hash421(compact421(x.rows)), r.pathHash);
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
          x = simulateRound421Economy(p, e, inputs, {
            round4: profile.parameters,
            round41: lane421(profile.policy41, lane),
            round421: { ...c.policy, enabled },
            scenario,
            seed,
            cut,
            adapterControl: true,
          });
        assert.equal(hash421(compact421(x.rows)), r.pathHash);
        assert.equal(
          hash421(compact421(x.rows.slice(0, 61))),
          hash421(
            compact421(
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
      c = compareProduction421(
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
const sample = choices.at(-1),
  oldPolicy = read421("docs/econ-sim/round4-2/candidates.json").choices.find(
    (r) => r.id === "R42-rounded",
  ).policy,
  bench = { round41: [], round42: [], round421Peace: [], round421Stress: [] };
for (let i = 0; i < 15; i++)
  for (const [key, fn, scenario] of [
    ["round41", simulateRound41Economy, "E0"],
    ["round42", simulateRound42Economy, "E0"],
    ["round421Peace", simulateRound421Economy, "E0"],
    ["round421Stress", simulateRound421Economy, "E5-X"],
  ]) {
    const at = performance.now();
    fn(p, e, inputs, {
      round4: profile.parameters,
      round41: lane421(profile.policy41, "self"),
      round42: oldPolicy,
      round421: sample.policy,
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
  performanceExecutions: 60,
  performance: Object.fromEntries(
    Object.entries(bench).map(([k, a]) => {
      const s = [...a].sort((a, b) => a - b);
      return [k, { rawMs: a, p50Ms: s[7], p95Ms: s[14], samples: a.length }];
    }),
  ),
  scope:
    "Full E0/no-cut replay80 +24representative cuts. Production checks are exact integer-Q reanalysis of all final+prepared ON pairs. Transaction-time guards, not guaranteed future treasury balance.",
};
write421(root + "/verification.json", result);
console.log(
  JSON.stringify({
    ...result,
    replays: result.replays.length,
    prefixChecks: result.prefixChecks.length,
  }),
);

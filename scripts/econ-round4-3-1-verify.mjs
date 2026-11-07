import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ROOT431 as root,
  inputs431,
  read431,
  write431,
  hash431,
  lane431,
} from "./econ-round4-3-1-inputs.mjs";
import { inputs43 } from "./econ-round4-3-inputs.mjs";
import {
  simulateRound431Economy,
  createRound431Economy,
  tickRound431Economy,
  round431Snapshot,
} from "../dist/src/economy-round4-3-1-model.js";
import { simulateRound43Economy } from "../dist/src/economy-round4-3-model.js";
import { compact43, compareProduction43 } from "./econ-round4-3-analysis.mjs";
import { compact431 } from "./econ-round4-3-1-analysis.mjs";
import { options431, jobs431 } from "./econ-round4-3-1-calibrate.mjs";
const d = inputs431(),
  result = read431(root + "/results.json"),
  all = Object.keys(d.config.taxModes).flatMap((m) =>
    ["final", "control", "cut"].flatMap((s) =>
      read431(`${root}/runs-${m}-${s}.json`),
    ),
  ),
  manifest = read431(root + "/run-source-manifest.json");
assert.deepEqual(d, read431(root + "/input-manifest.json"));
for (const [p, h] of Object.entries(manifest.source))
  assert.equal(hash431(fs.readFileSync(p, "utf8")), h, "Formal source " + p);
assert.equal(all.length, 3660);
assert.equal(result.totalRuns, all.length);
assert.equal(result.integrityFailures, 0);
const jobs = jobs431(),
  jobFor = (r) =>
    jobs.find(
      (j) =>
        j.taxMode === r.taxMode &&
        j.lane === r.lane &&
        j.scenario === r.scenario,
    ),
  key = (r) => [r.taxMode, r.lane, r.scenario, r.seed, r.enabled].join("/");
assert.equal(new Set(all.map(key)).size, all.length);
for (const mode of ["half", "zero", "full"])
  for (const lane of ["self", "relief"])
    for (const enabled of [false, true]) {
      const group = all.filter(
        (r) => r.taxMode === mode && r.lane === lane && r.enabled === enabled,
      );
      assert.equal(group.length, 305);
      assert.equal(new Set(group.map((r) => r.scenario)).size, 61);
      for (const seed of d.config.seeds)
        assert.equal(group.filter((r) => r.seed === seed).length, 61);
    }
let annualChecks = 0,
  productionChecks = 0,
  lifeChecks = 0,
  cutChecks = 0,
  reserveAudits = 0;
for (const r of all) {
  assert.ok(r.integrity);
  assert.equal(r.national.negativeMonths, 0);
  assert.ok(r.national.minimumTreasuryC >= 0);
  for (const id of ["earth", "moon", "mars"]) {
    const b = r.bodies[id],
      annual = b.annualFiscal;
    assert.equal(annual.length, 20);
    for (const year of annual) {
      const q = (x) => Math.round(x * 1000);
      assert.equal(q(year.taxC) - q(year.spendingC), q(year.netTaxC));
      assert.ok(year.taxC >= 0 && year.spendingC >= 0);
      annualChecks++;
    }
    const qsum = (k) => annual.reduce((n, x) => n + Math.round(x[k] * 1000), 0);
    assert.equal(qsum("taxC"), Math.round(b.taxC * 1000));
    assert.equal(qsum("spendingC"), Math.round(b.spendingC * 1000));
    assert.equal(qsum("netTaxC"), Math.round(b.netFiscalC * 1000));
    assert.equal(
      annual.find((x) => x.netTaxC > 0)?.year ?? null,
      b.firstPositiveFiscalYear,
    );
    assert.equal(r.productionPathQ[id].length, 240);
    assert.ok(
      r.productionPathQ[id].every((n) => Number.isSafeInteger(n) && n >= 0),
    );
    if (r.enabled) {
      const off = all.find(
        (a) =>
          a.taxMode === r.taxMode &&
          a.lane === r.lane &&
          a.scenario === r.scenario &&
          a.seed === r.seed &&
          !a.enabled,
      );
      assert.deepEqual(
        compareProduction43(r.productionPathQ[id], off.productionPathQ[id]),
        r.productionComparison[id],
      );
      productionChecks++;
    }
    if (id !== "earth") {
      const z = b.reserve.ending;
      for (const k of ["water", "oxygen"]) {
        assert.ok(z[k + "Q"] >= 0 && z[k + "Q"] <= z[k + "CapacityQ"]);
        reserveAudits++;
      }
      if (r.lifeRequired) {
        assert.equal(
          r.checks["lifeWater_" + id],
          b.life.water.eligibleMonths > 0 && b.life.water.below99Months === 0,
        );
        assert.equal(
          r.checks["lifeOxygen_" + id],
          b.life.oxygen.eligibleMonths > 0 && b.life.oxygen.below99Months === 0,
        );
        lifeChecks += 2;
      } else
        assert.ok(
          !("lifeWater_" + id in r.checks) && !("lifeOxygen_" + id in r.checks),
        );
      assert.ok(Math.abs(b.dedicated.waterU - b.dedicated.oxygenU) < 1e-8);
    }
  }
  if (r.cut) {
    assert.equal(r.cut.electrolysisU, 0);
    cutChecks++;
  }
}
const selected = all.filter(
  (r) =>
    (r.taxMode === "half" && ["E0", "E2-S", "E5-M"].includes(r.scenario)) ||
    (r.scenario === "E2-S" && r.taxMode !== "half") ||
    (r.stage === "control" && ["econ-1", "econ-5"].includes(r.seed)) ||
    (r.cut &&
      r.cut.durationMonths === 9 &&
      r.cut.inventoryLossFraction === 1 &&
      ["econ-1", "econ-5"].includes(r.seed)),
);
const replays = [],
  firstFillAudits = [],
  cache = new Map();
let prefixChecks = 0;
for (const r of selected) {
  const x = simulateRound431Economy(
    d.p,
    d.e,
    d.inputs,
    options431(d, jobFor(r), r.seed, r.enabled),
  );
  assert.equal(hash431(compact431(x.rows)), r.pathHash, "Replay " + key(r));
  replays.push({ key: key(r), pathHash: r.pathHash });
  if (r.scenario === "E2-S")
    for (const body of ["moon", "mars"])
      for (const resource of ["water", "oxygen"]) {
        const fill = x.rows.find(
          (row) =>
            row.round431[body].reserve[resource + "TargetQ"] > 0 &&
            row.round431[body].reserve[resource + "Q"] >=
              row.round431[body].reserve[resource + "TargetQ"],
        );
        assert.equal(
          fill?.month ?? null,
          r.bodies[body].reserve.firstFill[resource].month,
        );
        firstFillAudits.push({
          key: key(r),
          taxMode: r.taxMode,
          lane: r.lane,
          seed: r.seed,
          enabled: r.enabled,
          body,
          resource,
          month: fill?.month ?? null,
          bodyActualSpendingC: fill
            ? fill.round43.cumulativeFiscal[body].outQ / 1000
            : null,
          scope:
            "All actual government outflow attributed to this colony through first fill. Includes shared infrastructure/operating/procurement/freight, not marginal reserve-only cost.",
        });
      }

  if (r.stage === "control")
    cache.set([r.taxMode, r.lane, r.seed, r.enabled].join("/"), x.rows);
  if (r.cut) {
    const control = cache.get([r.taxMode, r.lane, r.seed, r.enabled].join("/"));
    assert.ok(control);
    assert.equal(
      hash431(compact431(x.rows.slice(0, 61))),
      hash431(compact431(control.slice(0, 61))),
    );
    prefixChecks++;
  }
  if (replays.length % 20 === 0)
    console.log("New replay " + replays.length + "/" + selected.length);
}
const old = inputs43(),
  legacy = [];
const prior = [
  ...read431("docs/econ-sim/round4-3/final-runs.json"),
  ...read431("docs/econ-sim/round4-3/no-cut-controls.json"),
  ...read431("docs/econ-sim/round4-3/h-cut.json"),
].filter(
  (r) =>
    r.id === "R43-rounded" &&
    (["E0", "E2-S"].includes(r.scenario) ||
      (r.seed === "econ-1" &&
        (r.stage === "control" ||
          (r.cut?.durationMonths === 9 && r.cut.inventoryLossFraction === 1)))),
);
for (const r of prior) {
  const cut =
    r.stage === "control"
      ? {
          body: "earth",
          startMonth: 60,
          durationMonths: 9,
          inventoryLossFraction: 1,
          fundedColonyFixture: true,
          enabled: false,
        }
      : r.cut;
  const x = simulateRound43Economy(old.p, old.e, old.inputs, {
    round4: old.profile.parameters,
    round41: lane431(old.profile.policy41, r.lane),
    round422: { ...old.hydrogenPolicy, enabled: r.enabled },
    round43: r.policy,
    tax43: old.config.tax,
    scenario: r.scenario,
    cut,
    seed: r.seed,
    months: 240,
    adapterControl: true,
  });
  assert.equal(hash431(compact43(x.rows)), r.pathHash, "Legacy43 replay");
  legacy.push({
    scenario: r.scenario,
    lane: r.lane,
    enabled: r.enabled,
    seed: r.seed,
    pathHash: r.pathHash,
  });
}
// Passive transaction trace must leave final outputs identical.
const traces = [];
for (const scenario of ["E2-S", "E5-M", "E5-X", "H-CUT-moon-M9-L100"]) {
  const r = all.find(
      (r) =>
        r.taxMode === "half" &&
        r.lane === "self" &&
        r.enabled &&
        r.seed === "econ-1" &&
        r.scenario === scenario,
    ),
    j = jobFor(r),
    s = createRound431Economy(d.p, d.e, d.inputs, {
      ...options431(d, j, r.seed, true),
      trace: true,
    }),
    rows = [round431Snapshot(s)],
    sample = [];
  for (let m = 0; m < 240; m++) {
    rows.push(tickRound431Economy(s));
    for (const t of s.book.trace)
      if (
        sample.length < 25 &&
        [
          "construction:life-oxygen431",
          "construction:life-tank431",
          "life-oxygen-variable431",
          "water-market43:C",
          "life-water43",
          "life-oxygen43",
        ].includes(t.tag)
      )
        sample.push({ month: m + 1, ...t });
    s.book.trace.length = 0;
  }
  assert.equal(hash431(compact431(rows)), r.pathHash);
  traces.push({ scenario, pathHash: r.pathHash, sample });
}
write431(root + "/verification.json", {
  formalRuns: all.length,
  sourceHashes: true,
  inputManifest: true,
  integrityFailures: 0,
  annualFiscalBodyYears: annualChecks,
  productionPairBodyChecks: productionChecks,
  lifeCheckConditions: lifeChecks,
  cutElectrolysisZeroChecks: cutChecks,
  reserveEndingChecks: reserveAudits,
  replayExecutions: replays.length,
  prefixChecks,
  legacyReplayExecutions: legacy.length,
  traceExecutions: traces.length,
  replays,
  firstFillAudits,
  legacy,
  traces,
  scope:
    "All paths audit each tick in simulator. Independent reruns are the explicitly listed subset. Existing43 outputs replayed with their original0% tax, not overwritten. Required H gain E0; prepared control informational under431 table.",
});
console.log(
  JSON.stringify({
    replays: replays.length,
    prefixChecks,
    legacy: legacy.length,
    trace: traces.length,
    annualChecks,
    productionChecks,
    lifeChecks,
    cutChecks,
    reserveAudits,
  }),
);

import fs from "node:fs";
import os from "node:os";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { performance } from "node:perf_hooks";
import {
  inputs431,
  output431,
  ROOT431,
  write431,
  lane431,
  hash431,
} from "./econ-round4-3-1-inputs.mjs";
import { ROUND41_SCENARIOS } from "../dist/src/economy-round4-1-model.js";
import { simulateRound431Economy } from "../dist/src/economy-round4-3-1-model.js";
import { metrics431, pair431, series431 } from "./econ-round4-3-1-analysis.mjs";
export function options431(d, j, seed, enabled) {
  return {
    round4: d.profile.parameters,
    round41: lane431(d.profile.policy41, j.lane),
    round422: { ...d.hydrogenPolicy, enabled },
    round43: d.policy43,
    tax43: { ...d.config.tax, colonyFactor: d.config.taxModes[j.taxMode] },
    scenario: j.scenario,
    cut: j.cut,
    seed,
    months: d.config.months,
    adapterControl: true,
  };
}
export function evaluate431(d, j) {
  const records = [],
    paths = {};
  for (const seed of d.config.seeds) {
    const pair = [];
    for (const enabled of [false, true]) {
      const x = simulateRound431Economy(
        d.p,
        d.e,
        d.inputs,
        options431(d, j, seed, enabled),
      );
      const r = metrics431(x, d, j, seed, enabled);
      records.push(r);
      pair.push(r);
      if (seed === d.config.seeds[0])
        paths[j.lane + "/" + j.scenario + "/" + (enabled ? "ON" : "OFF")] =
          series431(x.rows);
    }
    pair431(pair[1], pair[0]);
  }
  return { records, paths };
}
export function jobs431(quick = false) {
  const jobs = [];
  for (const taxMode of quick ? ["half"] : ["half", "zero", "full"])
    for (const lane of ["self", "relief"]) {
      for (const scenario of quick
        ? ["E0", "E2-S", "E5-M", "E5-X"]
        : ROUND41_SCENARIOS)
        jobs.push({ taxMode, lane, stage: "final", scenario });
      jobs.push({
        taxMode,
        lane,
        stage: "control",
        scenario: "H-CUT-CONTROL",
        cut: {
          body: "earth",
          startMonth: 60,
          durationMonths: 9,
          inventoryLossFraction: 1,
          fundedColonyFixture: true,
          enabled: false,
        },
      });
      for (const body of ["earth", "moon", "mars"])
        for (const durationMonths of quick ? [9] : [6, 9, 12])
          for (const inventoryLossFraction of quick ? [1] : [0, 1])
            jobs.push({
              taxMode,
              lane,
              stage: "cut",
              scenario: `H-CUT-${body}-M${durationMonths}-L${inventoryLossFraction * 100}`,
              cut: {
                body,
                startMonth: 60,
                durationMonths,
                inventoryLossFraction,
                fundedColonyFixture: true,
                enabled: true,
              },
            });
    }
  return jobs;
}
class Pool431 {
  constructor(data, n) {
    this.queue = [];
    this.workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL(import.meta.url), { workerData: data });
      w.on("message", (m) => {
        const t = w.task;
        w.task = null;
        m.error ? t.reject(Error(m.error)) : t.resolve(m.result);
        this.flush();
      });
      w.on("error", (e) => w.task?.reject(e));
      return w;
    });
  }
  flush() {
    for (const w of this.workers)
      if (!w.task && this.queue.length) {
        w.task = this.queue.shift();
        w.postMessage(w.task.job);
      }
  }
  run(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.flush();
    });
  }
  close() {
    return Promise.all(this.workers.map((w) => w.terminate()));
  }
}
export async function main431() {
  const args = process.argv.slice(2),
    get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null),
    quick = args.includes("--quick"),
    out = output431(get("--out") ?? ROOT431),
    d = inputs431();
  if (quick) {
    if (out === ROOT431) throw Error("Quick output must be artifacts");
    d.config.seeds = d.config.seeds.slice(0, 1);
  }
  const n = Math.max(1, Math.min(3, Number(get("--workers") ?? 3))),
    jobs = jobs431(quick),
    pool = new Pool431(d, n),
    start = performance.now();
  let done = 0;
  const source = Object.fromEntries(
    [
      "dist/src/economy-round4-3-1-model.js",
      "dist/src/economy-round4-3-1-policy.js",
      "dist/src/economy-round4-3-1-water.js",
      "scripts/econ-round4-3-1-analysis.mjs",
      "scripts/econ-round4-3-1-inputs.mjs",
      "scripts/econ-round4-3-1-calibrate.mjs",
      "scripts/econ-round4-3-1.config.json",
    ].map((p) => [p, hash431(fs.readFileSync(p, "utf8"))]),
  );
  write431(out + "/run-source-manifest.json", {
    source,
    base: d.config.baseCommit,
  });
  try {
    const values = await Promise.all(
      jobs.map((j) =>
        pool.run(j).then((x) => {
          done++;
          if (done % 8 === 0 || done === jobs.length)
            console.log(
              `${done}/${jobs.length} jobs; ${((performance.now() - start) / 1000).toFixed(1)}s`,
            );
          return x;
        }),
      ),
    );
    const records = values.flatMap((x) => x.records),
      series = {};
    jobs.forEach((j, i) => {
      series[j.taxMode] ??= {};
      Object.assign(series[j.taxMode], values[i].paths);
    });
    for (const r of records.filter((r) => r.stage === "cut")) {
      const c = records.find(
        (c) =>
          c.stage === "control" &&
          c.taxMode === r.taxMode &&
          c.lane === r.lane &&
          c.seed === r.seed &&
          c.enabled === r.enabled,
      );
      const noCutQ = c.productionPathQ[r.cut.body]
        .slice(r.cut.startMonth, r.cut.startMonth + r.cut.durationMonths)
        .reduce((n, x) => n + x, 0);
      r.cut.sameTechnologyNoCutU = noCutQ / 1000;
      r.cut.sameTechnologyNoCutRatio = noCutQ ? r.cut.producedQ / noCutQ : null;
    }
    for (const mode of Object.keys(series)) {
      const a = records.filter((r) => r.taxMode === mode);
      for (const stage of ["final", "control", "cut"])
        fs.writeFileSync(
          out + `/runs-${mode}-${stage}.json`,
          JSON.stringify(a.filter((r) => r.stage === stage)) + "\n",
        );
      const entries = Object.entries(series[mode]),
        columns = Object.keys(entries[0][1][0]);
      fs.writeFileSync(
        out + `/series-${mode}.json`,
        JSON.stringify({
          columns,
          paths: Object.fromEntries(
            entries.map(([k, v]) => [
              k,
              v.map((r) => columns.map((c) => r[c])),
            ]),
          ),
        }) + "\n",
      );
    }
    const qualification = [];
    for (const taxMode of [...new Set(records.map((r) => r.taxMode))])
      for (const lane of ["self", "relief"]) {
        const a = records.filter(
            (r) => r.taxMode === taxMode && r.lane === lane && r.enabled,
          ),
          failures = {};
        if (!a.length) throw Error("431 empty qualification group");
        for (const r of a)
          for (const f of r.failures) failures[f] = (failures[f] ?? 0) + 1;
        qualification.push({
          taxMode,
          lane,
          passed: !Object.keys(failures).length,
          failures,
          runs: a.length,
        });
      }
    write431(out + "/input-manifest.json", d);
    write431(out + "/results.json", {
      baseCommit: d.config.baseCommit,
      archiveCommit: d.config.archiveCommit,
      totalRuns: records.length,
      integrityFailures: records.filter((r) => !r.integrity).length,
      qualification,
      scenarios: jobs.map((j) => ({
        taxMode: j.taxMode,
        lane: j.lane,
        scenario: j.scenario,
        stage: j.stage,
      })),
      totalSeconds: (performance.now() - start) / 1000,
      workers: n,
      environment: {
        node: process.version,
        cpu: os.cpus()[0]?.model,
        parallelism: os.availableParallelism(),
      },
      scope:
        "One fixed rounded43 policy; no search.3 tax comparators; paired H OFF/ON, each5 seeds240months. Extreme life informational; original41 criteria remain. Required H gain only E0 per latest431 table.",
    });
    console.log(
      "Finished " +
        records.length +
        " runs / integrity failures " +
        records.filter((r) => !r.integrity).length,
    );
  } finally {
    await pool.close();
  }
}
if (!isMainThread)
  parentPort.on("message", (j) => {
    try {
      parentPort.postMessage({ result: evaluate431(workerData, j) });
    } catch (e) {
      parentPort.postMessage({ error: e.stack });
    }
  });
else if (
  process.argv[1] &&
  new URL(import.meta.url).pathname === process.argv[1]
)
  await main431();

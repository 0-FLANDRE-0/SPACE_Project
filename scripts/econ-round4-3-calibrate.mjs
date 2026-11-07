import fs from "node:fs";
import os from "node:os";
import assert from "node:assert/strict";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { performance } from "node:perf_hooks";
import {
  inputs43,
  read43,
  write43,
  lane43,
  output43,
} from "./econ-round4-3-inputs.mjs";
import { simulateRound43Economy } from "../dist/src/economy-round4-3-model.js";
import { ROUND41_SCENARIOS } from "../dist/src/economy-round4-1-model.js";
import { resourceRandom } from "../dist/src/ore-quality.js";
import {
  metrics43,
  pair43,
  qualify43,
  series43,
} from "./econ-round4-3-analysis.mjs";
export function lhs43(config) {
  const out = Array.from({ length: config.samples }, (_, i) => ({
    id: "I" + String(i).padStart(3, "0"),
    policy: { ...config.policy },
  }));
  for (const [key, [lo, hi]] of Object.entries(config.ranges)) {
    const bins = Array.from({ length: config.samples }, (_, i) => i);
    for (let i = bins.length - 1; i > 0; i--) {
      const j = Math.floor(
        resourceRandom(config.samplingSeed, key, i, "shuffle") * (i + 1),
      );
      [bins[i], bins[j]] = [bins[j], bins[i]];
    }
    for (let i = 0; i < out.length; i++) {
      const v =
        lo +
        ((hi - lo) *
          (bins[i] + resourceRandom(config.samplingSeed, key, i, "jitter"))) /
          config.samples;
      out[i].policy[key] = key === "iceBuildMonths" ? Math.round(v) : v;
    }
  }
  return out;
}
export function rounded43(p) {
  return {
    ...p,
    iceOutputU: Math.max(
      200,
      Math.min(2000, Math.round(p.iceOutputU / 50) * 50),
    ),
    iceCapitalScale: Math.round(p.iceCapitalScale * 100) / 100,
    iceMaintenanceScale: Math.round(p.iceMaintenanceScale * 100) / 100,
    iceGWhPerU: Math.round(p.iceGWhPerU * 10000) / 10000,
    iceBuildMonths: Math.round(p.iceBuildMonths),
  };
}
export function evaluate43(job, data) {
  const { p, e, inputs, profile, hydrogenPolicy, config } = data,
    records = [],
    paths = {};
  for (const seed of config.seeds)
    for (const enabled of [false, true]) {
      const policy = { ...job.policy, ...job.overrides },
        hydrogen = { ...hydrogenPolicy, enabled },
        options = {
          round4: profile.parameters,
          round41: lane43(profile.policy41, job.lane),
          round422: hydrogen,
          round43: policy,
          tax43: config.tax,
          scenario: job.scenario,
          baseScenario43: job.baseScenario,
          seed,
          cut: job.cut,
          months: config.months,
          adapterControl: true,
        },
        x = simulateRound43Economy(p, e, inputs, options),
        r = {
          id: job.id,
          stage: job.stage,
          lane: job.lane,
          enabled,
          policy,
          ...metrics43(x, p, e, profile, policy, hydrogen, config, {
            ...job,
            seed,
          }),
        };
      records.push(r);
      if (seed === config.seeds[0] && job.stage !== "search")
        paths[job.lane + "/" + job.scenario + "/" + (enabled ? "ON" : "OFF")] =
          series43(x.rows);
    }
  const off = new Map(
    records.filter((r) => !r.enabled).map((r) => [r.seed, r]),
  );
  for (const r of records.filter((r) => r.enabled)) pair43(r, off.get(r.seed));
  return { records, paths };
}
class Pool43 {
  constructor(data, n) {
    this.workers = [];
    this.queue = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL(import.meta.url), { workerData: data });
      w.on("message", (m) => {
        const t = w.current;
        w.current = null;
        m.error ? t.reject(Error(m.error)) : t.resolve(m.result);
        this.flush();
      });
      w.on("error", (e) => w.current?.reject(e));
      this.workers.push(w);
    }
  }
  flush() {
    for (const w of this.workers)
      if (!w.current && this.queue.length) {
        w.current = this.queue.shift();
        w.postMessage(w.current.job);
      }
  }
  run(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.flush();
    });
  }
  async phase(name, jobs) {
    let count = 0;
    const at = performance.now(),
      values = await Promise.all(
        jobs.map((job) =>
          this.run(job).then((r) => {
            count++;
            if (count % 8 === 0 || count === jobs.length || jobs.length <= 4)
              console.log(
                `${name}: ${count}/${jobs.length} jobs ${((performance.now() - at) / 1000).toFixed(1)}s`,
              );
            return r;
          }),
        ),
      );
    return { seconds: (performance.now() - at) / 1000, values };
  }
  close() {
    return Promise.all(this.workers.map((w) => w.terminate()));
  }
}
const compactWrite = (path, x) =>
  fs.writeFileSync(path, JSON.stringify(x) + "\n");
export async function main43() {
  const args = process.argv.slice(2),
    get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null),
    quick = args.includes("--quick"),
    out = output43(get("--out") ?? "docs/econ-sim/round4-3"),
    data = inputs43();
  if (quick) {
    if (out === "docs/econ-sim/round4-3")
      throw Error("Quick cannot overwrite official output");
    data.config.samples = 2;
    data.config.seeds = data.config.seeds.slice(0, 1);
    data.config.months = 240;
  }
  const { config } = data,
    n = Math.max(1, Math.min(3, Number(get("--workers") ?? 3))),
    pool = new Pool43(data, n),
    started = performance.now(),
    all = [],
    paths = {},
    counts = {},
    timings = {};
  const phase = async (name, jobs) => {
    const r = await pool.phase(name, jobs),
      rows = r.values.flatMap((x) => x.records);
    counts[name] = rows.length;
    timings[name] = r.seconds;
    all.push(...rows);
    jobs.forEach((j, i) => {
      paths[j.id] ??= {};
      Object.assign(paths[j.id], r.values[i].paths);
    });
    return rows;
  };
  try {
    const samples = [
        ...lhs43(config),
        { id: "reference", policy: config.policy },
      ],
      search = await phase(
        "search",
        samples.flatMap((c) =>
          ["E0", "E2-S"].map((scenario) => ({
            ...c,
            stage: "search",
            lane: "self",
            scenario,
          })),
        ),
      ),
      ranked = samples
        .map((c) => {
          const r = search.filter((r) => r.id === c.id),
            q = qualify43(r),
            on = r.filter((r) => r.enabled),
            score =
              on.reduce(
                (n, r) =>
                  n +
                  r.failures.length * 10 +
                  Math.max(0, -(r.bodies.earth.margin ?? -1)) * 100 +
                  ["moon", "mars"].reduce(
                    (n, id) =>
                      n +
                      (r.bodies[id].life.water.below99Months +
                        r.bodies[id].life.oxygen.below99Months) /
                        240,
                    0,
                  ),
                0,
              ) / on.length;
          return {
            ...c,
            ...q,
            score,
            runs: r.length,
            meanHydrogenMargin:
              on.reduce((n, r) => n + r.bodies.earth.margin, 0) / on.length,
          };
        })
        .sort(
          (a, b) =>
            Number(b.passed) - Number(a.passed) ||
            a.score - b.score ||
            a.id.localeCompare(b.id),
        ),
      best = ranked[0],
      choices = [
        { id: "R43-selected-" + best.id, source: best.id, policy: best.policy },
        { id: "R43-rounded", source: best.id, policy: rounded43(best.policy) },
      ];
    write43(out + "/policy-search.json", ranked);
    write43(out + "/candidates.json", { choices });
    const scenarios = quick
      ? ["E0", "E2-S", "E5-M", "E5-M-L70-S12-D2", "E5-X", "S3-debt"]
      : ROUND41_SCENARIOS;
    const final = await phase(
      "final",
      choices.flatMap((c) =>
        ["self", "relief"].flatMap((lane) =>
          scenarios.map((scenario) => ({
            ...c,
            lane,
            scenario,
            stage: "final",
          })),
        ),
      ),
    );
    const survival = await phase(
      "survival",
      choices.flatMap((c) =>
        ["self", "relief"].flatMap((lane) =>
          [false, true].flatMap((iceEnabled) =>
            [0, 5, 10].map((holidayYears) => ({
              ...c,
              lane,
              scenario: `C43-ICE${Number(iceEnabled)}-TAX${holidayYears}`,
              baseScenario: "E2-S",
              stage: "survival",
              overrides: { iceEnabled, holidayYears },
            })),
          ),
        ),
      ),
    );
    const controls = await phase(
      "noCutControl",
      choices.flatMap((c) =>
        ["self", "relief"].map((lane) => ({
          ...c,
          lane,
          scenario: "H-CUT-CONTROL",
          stage: "control",
          cut: {
            body: "earth",
            startMonth: 60,
            durationMonths: 9,
            inventoryLossFraction: 1,
            fundedColonyFixture: true,
            enabled: false,
          },
        })),
      ),
    );
    const cut = await phase(
      "cut",
      choices.flatMap((c) =>
        ["self", "relief"].flatMap((lane) =>
          ["earth", "moon", "mars"].flatMap((body) =>
            (quick ? [6] : [6, 9, 12]).flatMap((durationMonths) =>
              (quick ? [1] : [0, 1]).map((inventoryLossFraction) => ({
                ...c,
                lane,
                scenario: `H-CUT-${body}-M${durationMonths}-L${inventoryLossFraction * 100}`,
                stage: "cut",
                cut: {
                  body,
                  startMonth: 60,
                  durationMonths,
                  inventoryLossFraction,
                  fundedColonyFixture: true,
                  enabled: true,
                },
              })),
            ),
          ),
        ),
      ),
    );
    for (const r of cut) {
      const same = controls.find(
          (c) =>
            c.id === r.id &&
            c.lane === r.lane &&
            c.enabled === r.enabled &&
            c.seed === r.seed,
        ),
        body = r.cut.body,
        win = same.productionPathQ[body].slice(60, 60 + r.cut.durationMonths),
        noCutQ = win.reduce((n, x) => n + x, 0);
      r.cut.sameTechnologyNoCutU = noCutQ / 1000;
      r.cut.sameTechnologyNoCutRatio = noCutQ ? r.cut.producedQ / noCutQ : null;
    }
    for (const [name, rows] of [
      ["search-runs", search],
      ["final-runs", final],
      ["survival-runs", survival],
      ["no-cut-controls", controls],
      ["h-cut", cut],
    ])
      compactWrite(out + "/" + name + ".json", rows);
    const qualification = choices.map((c) => ({
        id: c.id,
        policy: c.policy,
        ...Object.fromEntries(
          ["self", "relief"].map((lane) => [
            lane,
            qualify43(all.filter((r) => r.id === c.id && r.lane === lane)),
          ]),
        ),
      })),
      result = {
        status: config.status,
        baseCommit: config.baseCommit,
        archiveCommit: config.archiveCommit,
        profileId: config.profileId,
        counts: {
          ...counts,
          totalRuns: all.length,
          integrityFailures: all.filter((r) => !r.integrity).length,
        },
        qualification,
        selfPassing: qualification.filter((q) => q.self.passed).length,
        reliefPassing: qualification.filter((q) => q.relief.passed).length,
        timings,
        totalSeconds: (performance.now() - started) / 1000,
        workers: n,
        environment: {
          node: process.version,
          cpu: os.cpus()[0]?.model,
          parallelism: os.availableParallelism(),
        },
        scope:
          "Fixed422 adopted values, national fiscal budget, all4.1 scenarios, survival0/5/10 holidays with/without ice, paired H counterfactual in the SAME43 structure. Life>=99% applies after12months to every ice-enabled colony including shock/cut worlds. E0/prepared-control Earth strict total gain retained. Old12-month production and cut95% remain informational under latest43 table.",
      };
    write43(out + "/results.json", result);
    write43(out + "/input-manifest.json", data);
    let columns = null;
    const files = {};
    for (const c of choices) {
      const entries = Object.entries(paths[c.id]);
      columns ??= Object.keys(entries[0][1][0]);
      const name =
        c.id === "R43-rounded" ? "series-rounded.json" : "series-selected.json";
      files[c.id] = name;
      compactWrite(
        out + "/" + name,
        Object.fromEntries(
          entries.map(([key, rows]) => [
            key,
            rows.map((r) => columns.map((k) => r[k])),
          ]),
        ),
      );
    }
    write43(out + "/series-index.json", {
      columns,
      firstSeed: config.seeds[0],
      profiles: files,
    });
    const keys = [
        "id",
        "stage",
        "lane",
        "enabled",
        "scenario",
        "seed",
        "passed",
        "failures",
        "budgetRatio17",
        "national",
        "policy",
        "cut",
        "productionComparison",
        "pathHash",
      ],
      esc = (v) =>
        '"' +
        String(
          v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v,
        ).replaceAll('"', '""') +
        '"';
    fs.writeFileSync(
      out + "/runs.csv",
      keys.join(",") +
        "\n" +
        all.map((r) => keys.map((k) => esc(r[k])).join(",")).join("\n") +
        "\n",
    );
    const annual = all
      .filter((r) => r.stage !== "search")
      .flatMap((r) =>
        ["earth", "moon", "mars"].flatMap((body) =>
          r.bodies[body].annualFiscal.map((a) => ({
            id: r.id,
            stage: r.stage,
            lane: r.lane,
            enabled: r.enabled,
            scenario: r.scenario,
            seed: r.seed,
            body,
            ...a,
          })),
        ),
      );
    const annualKeys = Object.keys(annual[0]);
    fs.writeFileSync(
      out + "/annual-fiscal.csv",
      annualKeys.join(",") +
        "\n" +
        annual
          .map((r) => annualKeys.map((k) => esc(r[k])).join(","))
          .join("\n") +
        "\n",
    );
    assert.equal(result.counts.integrityFailures, 0);
    console.log(JSON.stringify(result));
  } finally {
    await pool.close();
  }
}
if (!isMainThread)
  parentPort.on("message", (job) => {
    try {
      parentPort.postMessage({ result: evaluate43(job, workerData) });
    } catch (e) {
      parentPort.postMessage({ error: e.stack });
    }
  });
else if (process.argv[1] === new URL(import.meta.url).pathname) await main43();

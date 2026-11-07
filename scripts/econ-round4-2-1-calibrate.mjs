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
  inputs421,
  read421,
  write421,
  hash421,
  lane421,
  output421,
} from "./econ-round4-2-1-inputs.mjs";
import {
  simulateRound421Economy,
  strip421Rows,
} from "../dist/src/economy-round4-2-1-model.js";
import {
  simulateRound42Economy,
  strip42Rows,
} from "../dist/src/economy-round4-2-model.js";
import { ROUND41_SCENARIOS } from "../dist/src/economy-round4-1-model.js";
import { compact41 } from "./econ-round4-1-analysis.mjs";
import {
  metrics421,
  compact421,
  compareProduction421,
  qualify421,
  score421,
} from "./econ-round4-2-1-analysis.mjs";
import { resourceRandom } from "../dist/src/ore-quality.js";
export function lhs421(c) {
  const rows = Array.from({ length: c.samples }, () => ({ ...c.policy }));
  for (const [key, [lo, hi]] of Object.entries(c.ranges)) {
    const order = Array.from({ length: rows.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(
        resourceRandom(c.samplingSeed, key, i, "shuffle") * (i + 1),
      );
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < rows.length; i++)
      rows[i][key] =
        lo +
        ((hi - lo) *
          (order[i] + resourceRandom(c.samplingSeed, key, i, "jitter"))) /
          rows.length;
  }
  return rows;
}
export function rounded421(p) {
  return {
    ...p,
    boost: Math.max(0.05, Math.min(0.25, Math.round(p.boost * 100) / 100)),
    hydrogenPerAlloyU: Math.max(
      0.95,
      Math.min(1.1, Math.round(p.hydrogenPerAlloyU * 100) / 100),
    ),
    cashReserveMonths: Math.max(
      1,
      Math.min(6, Math.round(p.cashReserveMonths)),
    ),
  };
}
let archived;
function evaluate421(job, data) {
  const { p, e, inputs, profile, config } = data,
    records = [],
    series = {};
  for (const lane of job.lanes ?? ["self"])
    for (const scenario of job.scenarios)
      for (const seed of config.seeds) {
        const policy = { ...job.policy, enabled: job.enabled !== false },
          cut = job.cut ?? null,
          options = {
            round4: profile.parameters,
            round41: lane421(profile.policy41, lane),
            round421: policy,
            scenario,
            seed,
            cut,
            adapterControl: true,
          },
          x = simulateRound421Economy(p, e, inputs, options),
          m = metrics421(x, p, e, profile, policy, config, {
            scenario,
            seed,
            lane,
            cut,
          }),
          r = {
            id: job.id,
            stage: job.stage,
            profileId: profile.id,
            lane,
            enabled: policy.enabled,
            policy,
            ...m,
          };
        if (!policy.enabled) {
          if (!cut) {
            archived ??= new Map(
              read421("docs/econ-sim/round4-1/final-runs.json")
                .filter((r) => r.id === profile.id)
                .map((r) => [
                  [r.lane, r.scenario, r.seed].join("/"),
                  r.pathHash,
                ]),
            );
            assert.equal(
              r.legacyHash,
              archived.get([lane, scenario, seed].join("/")),
            );
            r.offReference = "immutable4.1 archived compact hash";
          } else {
            const old = simulateRound42Economy(p, e, inputs, {
              ...options,
              round42: { enabled: false },
            });
            assert.equal(
              hash421(strip421Rows(x.rows)),
              hash421(strip42Rows(old.rows)),
            );
            r.offReference =
              "immutable4.2 exact core rows, same paid preparation/cut";
          }
          r.offVerified = true;
        }
        records.push(r);
        if (job.series && seed === config.seeds[0])
          series[
            lane + "/" + scenario + "/" + (policy.enabled ? "ON" : "OFF")
          ] = compact421(x.rows);
      }
  return { id: job.id, policy: job.policy, records, series };
}
class Pool421 {
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
    const at = performance.now();
    let i = 0;
    const values = await Promise.all(
      jobs.map((j) =>
        this.run(j).then((r) => {
          i++;
          if (i % 8 === 0 || i === jobs.length || jobs.length <= 4)
            console.log(
              `${name}: ${i}/${jobs.length} jobs ${((performance.now() - at) / 1000).toFixed(1)}s`,
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
const update = (r) => {
  r.failures = Object.entries(r.checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  r.passed = r.failures.length === 0;
};
export function pairProduction421(on, off) {
  on.productionComparison = {};
  for (const b of ["earth", "moon", "mars"]) {
    const c = compareProduction421(
      on.productionPathQ[b],
      off.productionPathQ[b],
    );
    on.productionComparison[b] = c;
    if (c.hasControlIndustry) on.checks["uncutProduction_" + b] = c.passed;
  }
  on.earthNetProductionRatio = on.productionComparison.earth.totalRatio;
  update(on);
}
const compactWrite = (p, x) => fs.writeFileSync(p, JSON.stringify(x) + "\n");
async function main421() {
  const args = process.argv.slice(2),
    get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null),
    quick = args.includes("--quick"),
    out = output421(get("--out") ?? "docs/econ-sim/round4-2-1"),
    data = inputs421();
  if (quick) {
    if (out === "docs/econ-sim/round4-2-1")
      throw Error("Quick cannot overwrite official output");
    data.config.samples = 2;
    data.config.seeds = data.config.seeds.slice(0, 1);
  }
  const { config, profile } = data,
    n = Math.max(1, Math.min(3, Number(get("--workers") ?? 3))),
    pool = new Pool421(data, n),
    started = performance.now(),
    counts = {},
    timings = {},
    all = [],
    series = {};
  const save = (key, phase) => {
    timings[key] = phase.seconds;
    const rows = phase.values.flatMap((r) => r.records);
    counts[key] = rows.length;
    all.push(...rows);
    for (const r of rows) assert.equal(r.integrity, true);
    for (const result of phase.values)
      if (Object.keys(result.series).length)
        series[result.id] = { ...series[result.id], ...result.series };
    return rows;
  };
  try {
    const baseline = save(
        "searchBaseline",
        await pool.phase("search baseline", [
          {
            id: "search-OFF",
            stage: "search-baseline",
            policy: config.policy,
            enabled: false,
            scenarios: ["E0"],
          },
        ]),
      ),
      policies = [...lhs421(config), config.policy],
      searched = await pool.phase(
        "LHS32+reference E0",
        policies.map((policy, i) => ({
          id:
            i === policies.length - 1
              ? "REFERENCE"
              : "H" + String(i).padStart(3, "0"),
          stage: "search",
          policy,
          scenarios: ["E0"],
        })),
      );
    save("search", searched);
    for (const x of searched.values) {
      for (const r of x.records)
        pairProduction421(
          r,
          baseline.find((b) => b.seed === r.seed),
        );
      x.passed = x.records.every((r) => r.passed);
      x.score = score421(x.records);
    }
    const ranking = [...searched.values].sort(
        (a, b) =>
          Number(b.passed) - Number(a.passed) ||
          a.score - b.score ||
          a.id.localeCompare(b.id),
      ),
      selected = ranking[0],
      choices = [
        { id: "R421-selected-" + selected.id, policy: selected.policy },
        { id: "R421-rounded", policy: rounded421(selected.policy) },
      ];
    write421(
      out + "/policy-search.json",
      searched.values.map(({ series, records, ...x }) => ({
        ...x,
        runs: records.length,
        failures: qualify421(records).failures,
        meanMarketMargin:
          records.reduce((n, r) => n + r.bodies.earth.margin, 0) /
          records.length,
      })),
    );
    write421(out + "/candidates.json", {
      profileId: profile.id,
      searchScope:
        "E0 self lane;32 deterministic LHS plus fixed h1.06 reference;five seeds. All other economic bases frozen and not searched.",
      searchPasses: searched.values.filter((r) => r.passed).length,
      choices,
    });
    const final = save(
      "final",
      await pool.phase(
        "all4.1 OFF/ON",
        choices.flatMap((c) =>
          [false, true].flatMap((enabled) =>
            (quick
              ? ["E0", "E2-S", "E5-M", "E5-X", "E6-R", "E5-M-L70-S12-D2"]
              : ROUND41_SCENARIOS
            ).flatMap((scenario) =>
              ["self", "relief"].map((lane) => ({
                ...c,
                stage: "final",
                enabled,
                scenarios: [scenario],
                lanes: [lane],
                series: true,
              })),
            ),
          ),
        ),
      ),
    );
    const offFinal = new Map(
      final
        .filter((r) => !r.enabled)
        .map((r) => [[r.id, r.lane, r.scenario, r.seed].join("/"), r]),
    );
    for (const on of final.filter((r) => r.enabled))
      pairProduction421(
        on,
        offFinal.get([on.id, on.lane, on.scenario, on.seed].join("/")),
      );
    const controlCut = {
        body: "earth",
        startMonth: 60,
        durationMonths: 9,
        inventoryLossFraction: 1,
        fundedColonyFixture: true,
        enabled: false,
      },
      control = save(
        "noCutControl",
        await pool.phase(
          "matched paid preparation no-cut",
          choices.flatMap((c) =>
            [false, true].map((enabled) => ({
              ...c,
              stage: "no-cut-control",
              enabled,
              scenarios: ["H-CUT-CONTROL"],
              cut: controlCut,
              lanes: ["self", "relief"],
              series: true,
            })),
          ),
        ),
      );
    const offControl = new Map(
      control
        .filter((r) => !r.enabled)
        .map((r) => [[r.id, r.lane, r.seed].join("/"), r]),
    );
    for (const on of control.filter((r) => r.enabled))
      pairProduction421(
        on,
        offControl.get([on.id, on.lane, on.seed].join("/")),
      );
    const cutJobs = [];
    for (const c of choices)
      for (const body of config.cut.bodies)
        for (const durationMonths of quick ? [6] : config.cut.durations)
          for (const inventoryLossFraction of quick
            ? [1]
            : config.cut.inventoryLossFractions)
            for (const enabled of [false, true])
              cutJobs.push({
                ...c,
                stage: "cut",
                enabled,
                scenarios: [
                  `H-CUT-${body}-M${durationMonths}-L${inventoryLossFraction * 100}`,
                ],
                lanes: ["self", "relief"],
                cut: {
                  body,
                  startMonth: 60,
                  durationMonths,
                  inventoryLossFraction,
                  fundedColonyFixture: true,
                  enabled: true,
                },
                series: true,
              });
    const cut = save("cut", await pool.phase("H-CUT OFF/ON", cutJobs)),
      offCuts = new Map(
        cut
          .filter((r) => !r.enabled)
          .map((r) => [[r.id, r.lane, r.scenario, r.seed].join("/"), r]),
      );
    const controls = new Map(
      control.map((r) => [[r.id, r.lane, r.seed, r.enabled].join("/"), r]),
    );
    for (const r of cut) {
      const c = r.cut,
        own = controls.get([r.id, r.lane, r.seed, r.enabled].join("/")),
        noCutQ = own.productionPathQ[c.body]
          .slice(60, 60 + c.durationMonths)
          .reduce((n, q) => n + q, 0);
      c.sameTechnologyNoCutU = noCutQ / 1000;
      c.cutToSameTechnologyNoCutRatio =
        noCutQ > 0 ? c.producedQ / noCutQ : null;
      assert.equal(c.electrolysisU, 0);
      if (r.enabled) {
        const off = offCuts.get([r.id, r.lane, r.scenario, r.seed].join("/"));
        c.offProducedU = off.cut.producedQ / 1000;
        c.productionRatio =
          off.cut.producedQ > 0 ? r.cut.producedQ / off.cut.producedQ : null;
        r.checks.cutProduction =
          off.cut.producedQ > 0 &&
          BigInt(c.producedQ) * 100n >= BigInt(off.cut.producedQ) * 95n;
        update(r);
      }
    }
    for (const [name, rows] of [
      ["final-runs", final],
      ["h-cut", cut],
      ["no-cut-controls", control],
    ])
      compactWrite(out + "/" + name + ".json", rows);
    const qualification = choices.map((c) => ({
        id: c.id,
        policy: c.policy,
        ...Object.fromEntries(
          ["self", "relief"].map((l) => [
            l,
            qualify421(all.filter((r) => r.id === c.id && r.lane === l)),
          ]),
        ),
      })),
      result = {
        status: config.status,
        baseCommit: config.baseCommit,
        archiveCommit: config.archiveCommit,
        profileId: profile.id,
        counts: {
          ...counts,
          totalRuns: all.length,
          offVerified: all.filter((r) => !r.enabled && r.offVerified).length,
          extraPredecessorReplayExecutions: all.filter(
            (r) =>
              !r.enabled &&
              r.cut !== undefined &&
              ["cut", "no-cut-control"].includes(r.stage),
          ).length,
          integrityFailures: all.filter((r) => !r.integrity).length,
        },
        timings,
        totalSeconds: (performance.now() - started) / 1000,
        workers: n,
        environment: {
          node: process.version,
          cpu: os.cpus()[0]?.model,
          parallelism: os.availableParallelism(),
        },
        qualification,
        selfPassing: qualification.filter((r) => r.self.passed).length,
        reliefPassing: qualification.filter((r) => r.relief.passed).length,
        scope:
          "Only R41-rounded. New uncut production criteria applied to all non-H-CUT final paths with control industrial output plus all3 prepared no-cut worlds; zero/zero12m windows compare equal but ratio remains undefined. Earth net >1 is information. Old information classification retained.",
      };
    write421(out + "/results.json", result);
    write421(out + "/input-manifest.json", data);
    const columns = Object.keys(Object.values(Object.values(series)[0])[0][0]),
      encoded = Object.fromEntries(
        Object.entries(series).map(([id, paths]) => [
          id,
          Object.fromEntries(
            Object.entries(paths).map(([key, rows]) => [
              key,
              rows.map((r) => columns.map((k) => r[k])),
            ]),
          ),
        ]),
      );
    compactWrite(out + "/series.json", {
      columns,
      firstSeed: config.seeds[0],
      profiles: encoded,
    });
    const csvRows = all.map((r) => ({
        stage: r.stage,
        id: r.id,
        lane: r.lane,
        enabled: r.enabled,
        scenario: r.scenario,
        seed: r.seed,
        passed: r.passed,
        failures: r.failures.join(";"),
        integrity: r.integrity,
        earthMarketPrice: r.bodies.earth.price,
        earthMarketMargin: r.bodies.earth.margin,
        electrolyzerPaybackYears: r.bodies.earth.paybackYears,
        productionComparison: r.productionComparison,
        cut: r.cut,
        bodies: r.bodies,
        pathHash: r.pathHash,
        legacyHash: r.legacyHash,
      })),
      keys = Object.keys(csvRows[0]),
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
        csvRows.map((r) => keys.map((k) => esc(r[k])).join(",")).join("\n") +
        "\n",
    );
    console.log(JSON.stringify(result));
  } finally {
    await pool.close();
  }
}
if (!isMainThread)
  parentPort.on("message", (job) => {
    try {
      parentPort.postMessage({ result: evaluate421(job, workerData) });
    } catch (e) {
      parentPort.postMessage({ error: e.stack });
    }
  });
else if (process.argv[1] === new URL(import.meta.url).pathname) await main421();

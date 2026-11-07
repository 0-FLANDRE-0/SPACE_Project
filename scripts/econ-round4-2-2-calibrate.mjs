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
  inputs422,
  read422,
  write422,
  hash422,
  lane422,
  output422,
} from "./econ-round4-2-2-inputs.mjs";
import {
  simulateRound422Economy,
  strip422Rows,
} from "../dist/src/economy-round4-2-2-model.js";
import {
  simulateRound421Economy,
  strip421Rows,
} from "../dist/src/economy-round4-2-1-model.js";
import { ROUND41_SCENARIOS } from "../dist/src/economy-round4-1-model.js";
import { compact41 } from "./econ-round4-1-analysis.mjs";
import {
  metrics422,
  compact422,
  compareProduction422,
  qualify422,
  score422,
} from "./econ-round4-2-2-analysis.mjs";
import { resourceRandom } from "../dist/src/ore-quality.js";
export function lhs422(c) {
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
  for (const p of rows) p.waterGateMonths = Math.round(p.waterGateMonths);
  return rows;
}
export function rounded422(p) {
  return {
    ...p,
    yieldBonus: Math.max(
      0.05,
      Math.min(0.25, Math.round(p.yieldBonus * 100) / 100),
    ),
    hydrogenPerAlloyU: Math.max(
      0.95,
      Math.min(1.1, Math.round(p.hydrogenPerAlloyU * 100) / 100),
    ),
    cashReserveMonths: Math.max(
      1,
      Math.min(6, Math.round(p.cashReserveMonths)),
    ),
    waterGateFraction: Math.max(
      0.5,
      Math.min(1, Math.round(p.waterGateFraction * 100) / 100),
    ),
    waterGateMonths: Math.max(3, Math.min(12, Math.round(p.waterGateMonths))),
  };
}

let archived;
function evaluate422(job, data) {
  const { p, e, inputs, profile, config } = data,
    records = [],
    series = {};
  for (const lane of job.lanes ?? ["self"])
    for (const scenario of job.scenarios)
      for (const seed of config.seeds) {
        const policy = { ...job.policy, enabled: job.enabled !== false },
          cut =
            job.cut ??
            (scenario === "H-CUT-CONTROL"
              ? {
                  body: "earth",
                  startMonth: 60,
                  durationMonths: 9,
                  inventoryLossFraction: 1,
                  fundedColonyFixture: true,
                  enabled: false,
                }
              : null),
          options = {
            round4: profile.parameters,
            round41: lane422(profile.policy41, lane),
            round422: policy,
            scenario,
            seed,
            cut,
            adapterControl: true,
          },
          x = simulateRound422Economy(p, e, inputs, options),
          m = metrics422(x, p, e, profile, policy, config, {
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
              read422("docs/econ-sim/round4-1/final-runs.json")
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
            const old = simulateRound421Economy(p, e, inputs, {
              ...options,
              round421: { enabled: false },
            });
            assert.equal(
              hash422(strip422Rows(x.rows)),
              hash422(strip421Rows(old.rows)),
            );
            r.offReference =
              "immutable4.2.1 exact core rows, same paid preparation/cut";
          }
          r.offVerified = true;
        }
        records.push(r);
        if (job.series && seed === config.seeds[0])
          series[
            lane + "/" + scenario + "/" + (policy.enabled ? "ON" : "OFF")
          ] = compact422(x.rows);
      }
  return { id: job.id, policy: job.policy, records, series };
}
class Pool422 {
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
export function pairProduction422(on, off) {
  on.productionComparison = {};
  for (const b of ["earth", "moon", "mars"]) {
    const c = compareProduction422(
      on.productionPathQ[b],
      off.productionPathQ[b],
    );
    on.productionComparison[b] = c;
    if (c.hasControlIndustry) on.checks["uncutProduction_" + b] = c.passed;
  }
  on.earthNetProductionRatio = on.productionComparison.earth.totalRatio;
  if (["E0", "H-CUT-CONTROL"].includes(on.scenario))
    on.checks.earthStrictNetProduction =
      on.productionComparison.earth.onTotalU >
      on.productionComparison.earth.offTotalU;
  update(on);
}
const compactWrite = (p, x) => fs.writeFileSync(p, JSON.stringify(x) + "\n");
async function main422() {
  const args = process.argv.slice(2),
    get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null),
    quick = args.includes("--quick"),
    out = output422(get("--out") ?? "docs/econ-sim/round4-2-2"),
    data = inputs422();
  if (quick) {
    if (out === "docs/econ-sim/round4-2-2")
      throw Error("Quick cannot overwrite official output");
    data.config.samples = 2;
    data.config.seeds = data.config.seeds.slice(0, 1);
  }
  const { config, profile } = data,
    n = Math.max(1, Math.min(3, Number(get("--workers") ?? 3))),
    pool = new Pool422(data, n),
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
            scenarios: ["E0", "H-CUT-CONTROL"],
          },
        ]),
      ),
      policies = [...lhs422(config), config.policy],
      searched = await pool.phase(
        "LHS32 five axes + reference E0/prepared control",
        policies.map((policy, i) => ({
          id:
            i === policies.length - 1
              ? "REFERENCE"
              : "H" + String(i).padStart(3, "0"),
          stage: "search",
          policy,
          scenarios: ["E0", "H-CUT-CONTROL"],
        })),
      );
    save("search", searched);
    for (const x of searched.values) {
      for (const r of x.records)
        pairProduction422(
          r,
          baseline.find((b) => b.seed === r.seed && b.scenario === r.scenario),
        );
      x.passed = x.records.every((r) => r.passed);
      x.score = score422(x.records);
    }
    const ranking = [...searched.values].sort(
        (a, b) =>
          Number(b.passed) - Number(a.passed) ||
          a.score - b.score ||
          a.id.localeCompare(b.id),
      ),
      selected = ranking[0],
      choices = [
        { id: "R422-selected-" + selected.id, policy: selected.policy },
        { id: "R422-rounded", policy: rounded422(selected.policy) },
      ];
    write422(
      out + "/policy-search.json",
      searched.values.map(({ series, records, ...x }) => ({
        ...x,
        runs: records.length,
        failures: qualify422(records).failures,
        meanMarketMargin:
          records.reduce((n, r) => n + r.bodies.earth.margin, 0) /
          records.length,
      })),
    );
    write422(out + "/candidates.json", {
      profileId: profile.id,
      searchScope:
        "E0 and prepared no-cut control self lane;32 five-axis LHS plus h1.06 reference;five seeds. All other economic bases frozen and not searched.",
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
      pairProduction422(
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
      pairProduction422(
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
            qualify422(all.filter((r) => r.id === c.id && r.lane === l)),
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
              !r.enabled && r.offReference?.startsWith("immutable4.2.1 exact"),
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
          "Only R41-rounded. New uncut production criteria applied to all non-H-CUT final paths with control industrial output plus all3 prepared no-cut worlds; zero/zero12m windows compare equal but ratio remains undefined. E0 and prepared-control Earth net >1 is required; other non-H-CUT worlds retain >=1 plus all12m windows. Old information classification retained.",
      };
    write422(out + "/results.json", result);
    write422(out + "/input-manifest.json", data);
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
      parentPort.postMessage({ result: evaluate422(job, workerData) });
    } catch (e) {
      parentPort.postMessage({ error: e.stack });
    }
  });
else if (process.argv[1] === new URL(import.meta.url).pathname) await main422();

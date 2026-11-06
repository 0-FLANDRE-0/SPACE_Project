import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { simulateRound42Economy } from "../dist/src/economy-round4-2-model.js";
import { ROUND41_SCENARIOS } from "../dist/src/economy-round4-1-model.js";
import { resourceRandom } from "../dist/src/ore-quality.js";
import {
  inputs42,
  lane42,
  hash42,
  write42,
  output42,
  read42,
} from "./econ-round4-2-inputs.mjs";
import { compact41 } from "./econ-round4-1-analysis.mjs";
import {
  metrics42,
  compact42,
  aggregate42,
} from "./econ-round4-2-analysis.mjs";
export function lhs42(config) {
  const rows = Array.from({ length: config.samples }, () => ({
    ...config.policy,
  }));
  for (const [key, [lo, hi]] of Object.entries(config.ranges)) {
    const order = Array.from({ length: rows.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(
        resourceRandom(config.samplingSeed, key, i, "shuffle") * (i + 1),
      );
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < rows.length; i++)
      rows[i][key] =
        lo +
        ((hi - lo) *
          (order[i] + resourceRandom(config.samplingSeed, key, i, "jitter"))) /
          rows.length;
  }
  return rows;
}
export function rounded42(p, config) {
  const out = { ...p };
  for (const [k, [lo, hi]] of Object.entries(config.ranges)) {
    const scale = ["switchDays", "enterMonths"].includes(k) ? 1 : 100;
    out[k] = Math.max(lo, Math.min(hi, Math.round(out[k] * scale) / scale));
  }
  return out;
}
let archive42;
function evaluate42(job, data) {
  const { p, e, inputs, config } = data,
    records = [],
    series = {};
  for (const lane of job.lanes ?? ["self"])
    for (const scenario of job.scenarios)
      for (const seed of config.seeds) {
        const policy = { ...job.policy, enabled: job.enabled !== false },
          cut = job.cut ?? null,
          options = {
            round4: job.profile.parameters,
            round41: lane42(job.profile.policy41, lane),
            round42: policy,
            scenario,
            seed,
            cut,
            adapterControl: job.enabled === false,
          },
          x = simulateRound42Economy(p, e, inputs, options),
          m = metrics42(x, p, e, job.profile, policy, config, {
            scenario,
            seed,
            lane,
            cut,
          }),
          legacyHash = hash42(compact41(x.rows)),
          row = {
            legacyHash,
            stage: job.stage,
            id: job.id,
            profileId: job.profile.id,
            baseId: job.profile.baseId,
            lane,
            enabled: policy.enabled,
            ...m,
            pathHash: hash42(compact42(x.rows)),
            policy,
          };
        if (!policy.enabled && !cut) {
          archive42 ??= read42("docs/econ-sim/round4-1/final-runs.json");
          const a = archive42.find(
            (r) =>
              r.id === job.profile.id &&
              r.lane === lane &&
              r.scenario === scenario &&
              r.seed === seed,
          );
          if (!a || a.pathHash !== legacyHash)
            throw Error(
              "Adapter OFF differs from archived4.1 " +
                job.profile.id +
                "/" +
                lane +
                "/" +
                scenario +
                "/" +
                seed,
            );
        }
        records.push(row);
        if (job.series && seed === config.seeds[0])
          series[
            lane + "/" + scenario + "/" + (policy.enabled ? "ON" : "OFF")
          ] = compact42(x.rows);
      }
  return {
    id: job.id,
    profileId: job.profile.id,
    policy: job.policy,
    summary: aggregate42(records),
    records,
    series,
  };
}
class Pool42 {
  constructor(data, n) {
    this.workers = [];
    this.queue = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL(import.meta.url), { workerData: data });
      w.on("message", (msg) => {
        const t = w.current;
        w.current = null;
        msg.error ? t.reject(Error(msg.error)) : t.resolve(msg.result);
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
    let n = 0;
    const results = await Promise.all(
      jobs.map((j) =>
        this.run(j).then((r) => {
          n++;
          if (n % 8 === 0 || n === jobs.length)
            console.log(
              `${name}: ${n}/${jobs.length} jobs, ${((performance.now() - at) / 1000).toFixed(1)}s`,
            );
          return r;
        }),
      ),
    );
    return { seconds: (performance.now() - at) / 1000, results };
  }
  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
function csv42(file, rows) {
  const keys = [...new Set(rows.flatMap((x) => Object.keys(x)))],
    v = (x) =>
      '"' +
      String(
        x == null ? "" : typeof x === "object" ? JSON.stringify(x) : x,
      ).replaceAll('"', '""') +
      '"';
  fs.writeFileSync(
    file,
    keys.join(",") +
      "\n" +
      rows.map((x) => keys.map((k) => v(x[k])).join(",")).join("\n") +
      "\n",
  );
}
function compactRecord42(r) {
  const { bodies, policy, annualUnserved, planetSummary, ...x } = r;
  return {
    ...x,
    earthPrice: bodies.earth.price,
    earthHydrogenMargin: bodies.earth.margin,
    earthRatedMargin: bodies.earth.ratedMargin,
    earthNewPaybackYears: bodies.earth.paybackYears,
    earthElectrolysisUtilization: bodies.earth.utilization,
    earthReductionShare: bodies.earth.reductionShare,
    moonReductionShare: bodies.moon.reductionShare,
    marsReductionShare: bodies.mars.reductionShare,
    waterGeneratedU: Object.values(bodies).reduce(
      (n, b) => n + b.waterGeneratedU,
      0,
    ),
    lifeWaterServedU: Object.values(bodies).reduce(
      (n, b) => n + b.lifeWaterServedU,
      0,
    ),
    waterRecycledU: Object.values(bodies).reduce(
      (n, b) => n + b.waterRecycledU,
      0,
    ),
    waterStockU: Object.values(bodies).reduce((n, b) => n + b.waterStockU, 0),
    privateOwnUsedU: Object.values(bodies).reduce(
      (n, b) => n + (b.privateOwnUsedU ?? 0),
      0,
    ),
  };
}
async function main42() {
  const arg = process.argv.slice(2),
    get = (k) => (arg.includes(k) ? arg[arg.indexOf(k) + 1] : null),
    out = output42(get("--out") ?? "docs/econ-sim/round4-2"),
    quick = arg.includes("--quick"),
    data = inputs42();
  if (quick) {
    if (out === "docs/econ-sim/round4-2")
      throw Error("Quick output must be artifacts");
    data.config.samples = 2;
    data.config.seeds = data.config.seeds.slice(0, 1);
  }
  const { config, profiles } = data,
    n = Math.max(1, Math.min(3, Number(get("--workers") ?? 3))),
    pool = new Pool42(data, n),
    at = performance.now(),
    runs = [],
    series = {},
    timings = {},
    counts = {};
  const save = (name, x) => {
    timings[name] = x.seconds;
    const rows = x.results.flatMap((r) => r.records);
    counts[name] = rows.length;
    runs.push(...rows);
    for (const r of x.results) {
      if (!r.summary.integrity) throw Error("42 integrity " + name);
      if (Object.keys(r.series).length)
        series[r.id] = { ...series[r.id], ...r.series };
    }
  };
  try {
    const policies = lhs42(config),
      search = await pool.phase(
        "LHS64 E0 / five seeds",
        profiles.flatMap((profile) =>
          policies.map((policy, i) => ({
            id: profile.id + "-H" + String(i).padStart(3, "0"),
            stage: "search",
            profile,
            policy,
            scenarios: ["E0"],
          })),
        ),
      );
    save("search", search);
    write42(
      out + "/policy-search.json",
      search.results.map((r) => ({
        id: r.id,
        profileId: r.profileId,
        policy: r.policy,
        summary: r.summary,
      })),
    );
    const selected = profiles.map(
      (profile) =>
        search.results
          .filter((r) => r.profileId === profile.id)
          .sort(
            (a, b) =>
              Number(b.summary.passed) - Number(a.summary.passed) ||
              a.summary.score - b.summary.score ||
              a.id.localeCompare(b.id),
          )[0],
    );
    const choices = selected.map((r) => ({
        id: "R42-" + r.id,
        profile: profiles.find((p) => p.id === r.profileId),
        policy: r.policy,
      })),
      roundedBase = choices.find((r) => r.profile.id === "R41-rounded");
    choices.push({
      id: "R42-rounded",
      profile: roundedBase.profile,
      policy: rounded42(roundedBase.policy, config),
    });
    const scenarios = quick
      ? ["E0", "E2-S", "E5-M", "E5-X", "E6-R", "E11-M"]
      : ROUND41_SCENARIOS;
    const final = await pool.phase(
      "all4.1 scenarios paired OFF/ON",
      choices.flatMap((c) =>
        [false, true].map((enabled) => ({
          ...c,
          stage: "final",
          enabled,
          lanes: ["self", "relief"],
          scenarios,
          series: true,
        })),
      ),
    );
    save("final", final);
    write42(
      out + "/final-runs.json",
      final.results.flatMap((r) => r.records),
    );
    write42(out + "/candidates.json", {
      choices,
      searchPasses: search.results.filter((r) => r.summary.passed).length,
      screeningScope:
        "E0 self lane only;64 LHS ×5 frozen profiles ×5 seeds; no claim of full-scenario pass until final",
      finalSummary: final.results.map((r) => ({
        id: r.id,
        enabled: r.records[0].enabled,
        ...r.summary,
      })),
    });
    const cuts = [];
    for (const c of choices)
      for (const body of config.cut.bodies)
        for (const durationMonths of quick ? [6] : config.cut.durations)
          for (const inventoryLossFraction of quick
            ? [1]
            : config.cut.inventoryLossFractions) {
            const scenario = `H-CUT-${body}-M${durationMonths}-L${Math.round(inventoryLossFraction * 100)}`,
              cut = {
                body,
                startMonth: 60,
                durationMonths,
                inventoryLossFraction,
                baseScenario: "E0",
                fundedColonyFixture: true,
              };
            for (const enabled of [false, true])
              cuts.push({
                ...c,
                stage: "cut",
                enabled,
                lanes: ["self", "relief"],
                scenarios: [scenario],
                cut,
                series: durationMonths === 9 && inventoryLossFraction === 1,
              });
          }
    const cutResults = await pool.phase(
      "H-CUT geography/duration/loss pairs",
      cuts,
    );
    save("cut", cutResults);
    const cutRows = cutResults.results.flatMap((r) => r.records);
    for (const r of cutRows.filter((r) => r.enabled)) {
      const off = cutRows.find(
        (x) =>
          x.id === r.id &&
          !x.enabled &&
          x.scenario === r.scenario &&
          x.lane === r.lane &&
          x.seed === r.seed,
      );
      if (!off) throw Error("Missing H-CUT pair");
      r.cut.offProducedU = off.cut.producedU;
      r.cut.productionRatio =
        off.cut.producedU > 0 ? r.cut.producedU / off.cut.producedU : null;
      r.checks.cutProduction =
        r.cut.productionRatio !== null &&
        r.cut.productionRatio >= config.criteria42.cutProductionRatioMin;
      r.failures = Object.entries(r.checks)
        .filter(([, ok]) => !ok)
        .map(([k]) => k);
      r.passed = !r.failures.length;
    }
    write42(out + "/h-cut.json", cutRows);
    const sensitivities = await pool.phase(
      "rounded water-intake allocation sensitivity",
      [0, 0.5, 1].map((share) => ({
        ...choices.at(-1),
        id: "R42-rounded-water-" + share,
        stage: "water-sensitivity",
        policy: { ...choices.at(-1).policy, waterIntakeCostShare: share },
        scenarios: ["E0"],
        lanes: ["self"],
      })),
    );
    save("waterSensitivity", sensitivities);
    write42(
      out + "/water-sensitivity.json",
      sensitivities.results.flatMap((r) => r.records),
    );
    const candidateSummaries = choices.map((c) => {
      const rows = runs.filter((r) => r.id === c.id),
        byLane = Object.fromEntries(
          ["self", "relief"].map((l) => {
            const a = rows.filter((r) => r.lane === l && r.enabled),
              required = a.filter(
                (r) => r.classification !== "information" || r.stage === "cut",
              );
            return [
              l,
              {
                passed: required.length > 0 && required.every((r) => r.passed),
                requiredRuns: required.length,
                failures: aggregate42(a).failures,
              },
            ];
          }),
        );
      return {
        id: c.id,
        profileId: c.profile.id,
        baseId: c.profile.baseId,
        policy: c.policy,
        ...byLane,
      };
    });
    const result = {
      status: config.status,
      baseCommit: config.baselineCommit,
      archiveCommit: config.archiveCommit,
      config,
      counts: {
        ...counts,
        totalRuns: runs.length,
        integrityFailures: runs.filter((r) => !r.integrity).length,
      },
      timings,
      totalSeconds: (performance.now() - at) / 1000,
      workers: n,
      environment: {
        node: process.version,
        cpu: os.cpus()[0]?.model,
        parallelism: os.availableParallelism(),
      },
      candidateSummaries,
      selfPassing: candidateSummaries.filter((c) => c.self.passed).length,
      reliefPassing: candidateSummaries.filter((c) => c.relief.passed).length,
    };
    write42(out + "/results.json", result);
    const columns = Object.keys(Object.values(Object.values(series)[0])[0][0]),
      encoded = Object.fromEntries(
        Object.entries(series).map(([id, paths]) => [
          id,
          Object.fromEntries(
            Object.entries(paths).map(([key, rows]) => [
              key,
              rows.map((r) => columns.map((c) => r[c])),
            ]),
          ),
        ]),
      );
    fs.writeFileSync(
      out + "/series.json",
      JSON.stringify({
        columns,
        firstSeed: config.seeds[0],
        profiles: encoded,
      }) + "\n",
    );
    write42(out + "/input-manifest.json", {
      macro: data.p,
      baselineEnergy: data.e,
      profiles,
      criteria41: config.criteria41,
      config,
      hashes: profiles.map((p) => ({
        id: p.id,
        baseId: p.baseId,
        baseHash: hash42(p.parameters),
        policy41Hash: hash42(p.policy41),
      })),
    });
    csv42(out + "/runs.csv", runs.map(compactRecord42));
    console.log(
      JSON.stringify({
        out,
        counts: result.counts,
        seconds: result.totalSeconds,
        selfPassing: result.selfPassing,
        reliefPassing: result.reliefPassing,
      }),
    );
  } finally {
    await pool.close();
  }
}
if (!isMainThread)
  parentPort.on("message", (job) => {
    try {
      parentPort.postMessage({ result: evaluate42(job, workerData) });
    } catch (e) {
      parentPort.postMessage({ error: e.stack });
    }
  });
else if (process.argv[1] === new URL(import.meta.url).pathname) await main42();

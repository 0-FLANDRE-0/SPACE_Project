import {
  metrics43,
  compact43,
  pair43,
  series43,
} from "./econ-round4-3-analysis.mjs";
import { lifeRequired431 } from "../dist/src/economy-round4-3-1-policy.js";
import { hash431 } from "./econ-round4-3-1-inputs.mjs";
const sum = (a) => a.reduce((n, x) => n + x, 0);
export function compact431(rows) {
  const old = compact43(rows);
  return rows.map((r, i) => ({ old: old[i], life431: r.round431 }));
}
export function metrics431(x, d, job, seed, enabled) {
  const r = metrics43(
    x,
    d.p,
    d.e,
    d.profile,
    d.policy43,
    { ...d.hydrogenPolicy, enabled },
    d.config,
    { ...job, seed },
  );
  r.taxMode = job.taxMode;
  r.lane = job.lane;
  r.enabled = enabled;
  r.stage = job.stage;
  for (const key of Object.keys(r.checks))
    if (key.startsWith("life") && !lifeRequired431(job.scenario))
      delete r.checks[key];
  r.lifeRequired = lifeRequired431(job.scenario);
  const rows = x.rows.slice(1);
  for (const id of ["earth", "moon", "mars"]) {
    const b = r.bodies[id],
      state = x.state.planets[id],
      f = (k) => sum(rows.map((r) => r.planets[id].flow[k] ?? 0));
    const first = {};
    for (const resource of ["water", "oxygen"]) {
      const full = rows.findIndex((row) => {
        const z = row.round431[id].reserve;
        return (
          z[resource + "TargetQ"] > 0 &&
          z[resource + "Q"] >= z[resource + "TargetQ"]
        );
      });
      const prefix = full >= 0 ? rows.slice(0, full + 1) : [];
      first[resource] = {
        month: full >= 0 ? rows[full].month : null,
        tankCapitalC: sum(
          prefix.map((r) => r.planets[id].flow.reserveTankConstructionC431),
        ),
        tankMaintenanceC: sum(
          prefix.map((r) => r.planets[id].flow.reserveTankMaintenanceC431),
        ),
        tankAlloyU: sum(
          prefix.map(
            (r) =>
              r.planets[id].flow.reserveTankConstructionAlloyU431 +
              r.planets[id].flow.reserveTankMaintenanceAlloyU431,
          ),
        ),
        allLifeWaterPurchasesC: sum(
          prefix.map((r) => r.planets[id].flow.lifeWaterPurchaseC43),
        ),
        reserveWaterAcquisitionValueC: sum(
          prefix.map(
            (r) => r.planets[id].flow.reserveWaterAcquisitionValueC431,
          ),
        ),
        dedicatedCapitalC: sum(
          prefix.map((r) => r.planets[id].flow.dedicatedConstructionC431),
        ),
        dedicatedOperatingCashC: sum(
          prefix.map(
            (r) =>
              r.planets[id].flow.dedicatedMaintenanceC431 +
              r.planets[id].flow.dedicatedVariableC431,
          ),
        ),
        dedicatedPowerValueC: sum(
          prefix.map((r) => r.planets[id].flow.dedicatedEnergyValueC431),
        ),
        scope:
          "Costs accumulated until first fill: shared life infrastructure, not incremental reserve cost. Water value/power tariff valuation are non-additive to ledger cash spending.",
      };
    }
    b.reserve = {
      firstFill: first,
      ending: x.rows.at(-1).round431[id].reserve,
      waterFilledU: f("waterReserveFilledU431"),
      oxygenFilledU: f("oxygenReserveFilledU431"),
      waterDrawU: f("waterReserveDrawU431"),
      oxygenDrawU: f("oxygenReserveDrawU431"),
      tankCapitalC: f("reserveTankConstructionC431"),
      tankMaintenanceC: f("reserveTankMaintenanceC431"),
      tankCapitalAlloyU: f("reserveTankConstructionAlloyU431"),
      tankMaintenanceAlloyU: f("reserveTankMaintenanceAlloyU431"),
      waterAcquisitionValueC: f("reserveWaterAcquisitionValueC431"),
    };
    b.dedicated = {
      waterU: f("dedicatedWaterU431"),
      oxygenU: f("dedicatedOxygenU431"),
      hydrogenU: f("dedicatedOxygenU431"),
      powerGWh: f("dedicatedPowerGWh431"),
      powerValueC: f("dedicatedEnergyValueC431"),
      capitalC: f("dedicatedConstructionC431"),
      capitalAlloyU: f("dedicatedConstructionAlloyU431"),
      maintenanceC: f("dedicatedMaintenanceC431"),
      maintenanceAlloyU: f("dedicatedMaintenanceAlloyU431"),
      variableC: f("dedicatedVariableC431"),
      endingCapacityU: x.rows.at(-1).round431[id].dedicatedCapacityU,
    };
    b.populationEnd = state.population;
    b.privateElectroModules = sum(
      state.assets
        .filter(
          (a) =>
            a.kind === "electrolyzer" &&
            a.owner === "private" &&
            a.state !== "dismantled",
        )
        .map((a) => a.modules),
    );
    b.privateIceModuleMonths = sum(
      rows.map((r) => r.round431[id].privateIceModules),
    );
    const start =
      job.cut?.startMonth ??
      (["E4", "E6"].includes(job.scenario)
        ? 48
        : (x.state.stress41?.startMonth ?? 60));
    const duration =
      job.cut?.durationMonths ??
      (job.scenario === "E4"
        ? 36
        : job.scenario === "E6"
          ? 12
          : (x.state.stress41?.stopMonths ?? 24));
    const window = rows.filter(
        (r) => r.month > start && r.month <= start + duration,
      ),
      before = x.rows.find((r) => r.month === start)?.round431[id].reserve;
    const fraction = (r, k) => {
      const f = r.planets[id].flow;
      return k === "water"
        ? f.lifeWaterDemandU
          ? f.lifeWaterServedU / f.lifeWaterDemandU
          : 1
        : f.oxygenLifeDemandU43
          ? f.oxygenLifeServedU43 / f.oxygenLifeDemandU43
          : 1;
    };
    const firstBad = window.findIndex(
      (r) => fraction(r, "water") < 0.99 || fraction(r, "oxygen") < 0.99,
    );
    b.shock = {
      start,
      duration,
      openingReserve: before,
      fullyServedPrefixMonths: firstBad < 0 ? window.length : firstBad,
      windowCensored: firstBad < 0,
      waterDrawMonths: window.filter(
        (r) => r.planets[id].flow.waterReserveDrawU431 > 0,
      ).length,
      oxygenDrawMonths: window.filter(
        (r) => r.planets[id].flow.oxygenReserveDrawU431 > 0,
      ).length,
      waterDrawU: sum(
        window.map((r) => r.planets[id].flow.waterReserveDrawU431),
      ),
      oxygenDrawU: sum(
        window.map((r) => r.planets[id].flow.oxygenReserveDrawU431),
      ),
      minWater: window.length
        ? Math.min(...window.map((r) => fraction(r, "water")))
        : null,
      minOxygen: window.length
        ? Math.min(...window.map((r) => fraction(r, "oxygen")))
        : null,
      scope:
        "Actual ongoing supply plus reserve; fulfilled-prefix duration is not reserve-only autonomy.",
    };
  }
  r.pathHash = hash431(compact431(x.rows));
  refresh431(r);
  return r;
}
export function refresh431(r) {
  r.failures = Object.entries(r.checks)
    .filter(
      ([k, ok]) =>
        !ok &&
        !(
          k in r.legacyChecks &&
          r.classification === "information" &&
          r.stage === "final"
        ),
    )
    .map(([k]) => k);
  r.passed = !r.failures.length;
}
export function pair431(on, off) {
  pair43(on, off);
  // The latest explicit hydrogen criterion names E0 only. Prepared control is information.
  if (on.scenario !== "E0") delete on.checks.earthNetProduction;
  refresh431(on);
}
export function series431(rows) {
  const old = series43(rows);
  return rows.map((r, i) => ({
    ...old[i],
    ...Object.fromEntries(
      ["earth", "moon", "mars"].flatMap((id) => {
        const a = r.round431[id],
          f = r.planets[id].flow;
        return Object.entries({
          population: a.population,
          waterReserveU: a.reserve.waterQ / 1000,
          waterTargetU: a.reserve.waterTargetQ / 1000,
          oxygenReserveU: a.reserve.oxygenQ / 1000,
          oxygenTargetU: a.reserve.oxygenTargetQ / 1000,
          waterDrawU: f.waterReserveDrawU431,
          oxygenDrawU: f.oxygenReserveDrawU431,
          dedicatedPowerGWh: f.dedicatedPowerGWh431,
          dedicatedWaterU: f.dedicatedWaterU431,
          dedicatedOxygenU: f.dedicatedOxygenU431,
          dedicatedCostC:
            f.dedicatedConstructionC431 +
            f.dedicatedMaintenanceC431 +
            f.dedicatedVariableC431,
          privateIceModules: r.round431[id].privateIceModules,
          privateElectroModules: r.round431[id].privateElectroModules,
        }).map(([k, v]) => [id + "_" + k, v]);
      }),
    ),
  }));
}

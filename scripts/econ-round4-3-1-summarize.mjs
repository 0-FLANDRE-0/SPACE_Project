import fs from "node:fs";
import {
  ROOT431 as root,
  read431,
  write431,
} from "./econ-round4-3-1-inputs.mjs";
const result = read431(root + "/results.json"),
  modes = Object.keys(read431(root + "/input-manifest.json").config.taxModes),
  all = modes.flatMap((m) =>
    ["final", "control", "cut"].flatMap((s) =>
      read431(`${root}/runs-${m}-${s}.json`),
    ),
  );
const sum = (a) => a.reduce((n, x) => n + x, 0),
  valid = (a) => a.filter((x) => x != null && Number.isFinite(x)),
  mean = (a) => {
    a = valid(a);
    return a.length ? sum(a) / a.length : null;
  },
  min = (a) => {
    a = valid(a);
    return a.length ? Math.min(...a) : null;
  },
  max = (a) => {
    a = valid(a);
    return a.length ? Math.max(...a) : null;
  };
const worlds = [...new Set(all.map((r) => r.scenario))],
  cases = [];
const meanKeys = [
  "price",
  "observedCost",
  "margin",
  "paybackYears",
  "alloyU",
  "netFiscalC",
  "taxC",
  "spendingC",
  "cashContributionC",
  "populationEnd",
  "privateIceModules",
  "privateElectroModules",
  "privateIceModuleMonths",
  "iceProducedU",
  "iceUsedFraction",
  "waterMarketC",
  "meanWaterPrice",
];
for (const taxMode of modes)
  for (const lane of ["self", "relief"])
    for (const scenario of worlds)
      for (const enabled of [false, true]) {
        const a = all.filter(
          (r) =>
            r.taxMode === taxMode &&
            r.lane === lane &&
            r.scenario === scenario &&
            r.enabled === enabled,
        );
        if (!a.length) continue;
        const bodies = {};
        for (const id of ["earth", "moon", "mars"]) {
          const b = a.map((r) => r.bodies[id]);
          bodies[id] = {
            ...Object.fromEntries(
              meanKeys.map((k) => [k, mean(b.map((r) => r[k]))]),
            ),
            firstPositiveFiscalYears: b.map((r) => r.firstPositiveFiscalYear),
            sustainedPositiveFiscalYears: b.map(
              (r) => r.sustainedPositiveFiscalYear,
            ),
            waterMinimum: min(b.map((r) => r.life.water.minimum)),
            oxygenMinimum: min(b.map((r) => r.life.oxygen.minimum)),
            waterBelow99Months: sum(b.map((r) => r.life.water.below99Months)),
            oxygenBelow99Months: sum(b.map((r) => r.life.oxygen.below99Months)),
            reserve: Object.fromEntries(
              [
                "waterFilledU",
                "oxygenFilledU",
                "waterDrawU",
                "oxygenDrawU",
                "tankCapitalC",
                "tankMaintenanceC",
                "tankCapitalAlloyU",
                "tankMaintenanceAlloyU",
                "waterAcquisitionValueC",
              ].map((k) => [k, mean(b.map((r) => r.reserve[k]))]),
            ),
            reserveEnd: Object.fromEntries(
              Object.keys(b[0].reserve.ending).map((k) => [
                k,
                mean(b.map((r) => r.reserve.ending[k])),
              ]),
            ),
            firstFill: Object.fromEntries(
              ["water", "oxygen"].map((k) => [
                k,
                {
                  completedSeeds: b.filter(
                    (r) => r.reserve.firstFill[k].month !== null,
                  ).length,
                  minimumMonth: min(b.map((r) => r.reserve.firstFill[k].month)),
                  maximumMonth: max(b.map((r) => r.reserve.firstFill[k].month)),
                  ...Object.fromEntries(
                    Object.keys(b[0].reserve.firstFill[k])
                      .filter((x) => !["month", "scope"].includes(x))
                      .map((x) => [
                        x,
                        mean(
                          b
                            .filter(
                              (r) => r.reserve.firstFill[k].month !== null,
                            )
                            .map((r) => r.reserve.firstFill[k][x]),
                        ),
                      ]),
                  ),
                },
              ]),
            ),
            dedicated: Object.fromEntries(
              Object.keys(b[0].dedicated).map((k) => [
                k,
                mean(b.map((r) => r.dedicated[k])),
              ]),
            ),
            shock: {
              fullyServedPrefixMin: min(
                b.map((r) => r.shock.fullyServedPrefixMonths),
              ),
              allWindowServedSeeds: b.filter((r) => r.shock.windowCensored)
                .length,
              duration: b[0].shock.duration,
              minWater: min(b.map((r) => r.shock.minWater)),
              minOxygen: min(b.map((r) => r.shock.minOxygen)),
              waterDrawMonthsMax: max(b.map((r) => r.shock.waterDrawMonths)),
              oxygenDrawMonthsMax: max(b.map((r) => r.shock.oxygenDrawMonths)),
              waterDrawU: mean(b.map((r) => r.shock.waterDrawU)),
              oxygenDrawU: mean(b.map((r) => r.shock.oxygenDrawU)),
              openingWaterTargetFraction: min(
                b.map((r) =>
                  r.shock.openingReserve?.waterTargetQ
                    ? r.shock.openingReserve.waterQ /
                      r.shock.openingReserve.waterTargetQ
                    : null,
                ),
              ),
              openingOxygenTargetFraction: min(
                b.map((r) =>
                  r.shock.openingReserve?.oxygenTargetQ
                    ? r.shock.openingReserve.oxygenQ /
                      r.shock.openingReserve.oxygenTargetQ
                    : null,
                ),
              ),
            },
            annualFiscal: Array.from({ length: 20 }, (_, i) => ({
              year: i + 1,
              ...Object.fromEntries(
                ["taxC", "spendingC", "netTaxC", "cashNetC"].map((k) => [
                  k,
                  mean(b.map((r) => r.annualFiscal[i][k])),
                ]),
              ),
            })),
            productionComparison: enabled
              ? {
                  totalRatioMean: mean(
                    a.map((r) => r.productionComparison[id].totalRatio),
                  ),
                  totalRatioMin: min(
                    a.map((r) => r.productionComparison[id].totalRatio),
                  ),
                  gainSeeds: a.filter(
                    (r) =>
                      r.productionComparison[id].onTotalU >
                      r.productionComparison[id].offTotalU,
                  ).length,
                }
              : null,
          };
        }
        const national = {
          ...Object.fromEntries(
            [
              "initialTreasuryC",
              "endingTreasuryC",
              "totalBudgetC",
              "colonySpendingC",
              "totalSpendingC",
              "colonyBudgetShare",
              "colonyTotalSpendingShare",
            ].map((k) => [k, mean(a.map((r) => r.national[k]))]),
          ),
          minimumTreasuryC: min(a.map((r) => r.national.minimumTreasuryC)),
          negativeMonths: sum(a.map((r) => r.national.negativeMonths)),
          annual: Array.from({ length: 20 }, (_, i) => ({
            year: i + 1,
            ...Object.fromEntries(
              ["budgetC", "spendingC", "colonySpendingC", "treasuryC"].map(
                (k) => [k, mean(a.map((r) => r.national.annual[i][k]))],
              ),
            ),
          })),
        };
        const failureCounts = {};
        for (const r of a)
          for (const f of r.failures)
            failureCounts[f] = (failureCounts[f] ?? 0) + 1;
        cases.push({
          taxMode,
          lane,
          scenario,
          enabled,
          seeds: a.length,
          lifeRequired: a[0].lifeRequired,
          passing: a.filter((r) => r.passed).length,
          failures: failureCounts,
          national,
          bodies,
          cut: a[0].cut
            ? {
                body: a[0].cut.body,
                duration: a[0].cut.durationMonths,
                loss: a[0].cut.inventoryLossFraction,
                normalElectrolysisU: sum(a.map((r) => r.cut.electrolysisU)),
                minimumProductionRatio: min(
                  a.map((r) => r.cut.productionRatio),
                ),
                minimumSameTechnologyRatio: min(
                  a.map((r) => r.cut.sameTechnologyNoCutRatio),
                ),
              }
            : null,
        });
      }
const fillAudits = read431(root + "/verification.json").firstFillAudits;
for (const c of cases.filter((c) => c.scenario === "E2-S"))
  for (const body of ["moon", "mars"])
    for (const resource of ["water", "oxygen"]) {
      const a = fillAudits.filter(
        (r) =>
          r.taxMode === c.taxMode &&
          r.lane === c.lane &&
          r.enabled === c.enabled &&
          r.body === body &&
          r.resource === resource,
      );
      c.bodies[body].firstFill[resource].bodyActualSpendingC = mean(
        a.map((r) => r.bodyActualSpendingC),
      );
    }
const old43 = [
    ...read431("docs/econ-sim/round4-3/final-runs.json"),
    ...read431("docs/econ-sim/round4-3/no-cut-controls.json"),
    ...read431("docs/econ-sim/round4-3/h-cut.json"),
  ].filter((r) => r.id === "R43-rounded" && r.enabled),
  comparison = [];
for (const scenario of [
  "E0",
  "E2-S",
  "E5-M",
  "E5-X",
  "H-CUT-moon-M9-L100",
  "H-CUT-mars-M9-L100",
])
  for (const lane of ["self", "relief"]) {
    const a = old43.filter((r) => r.scenario === scenario && r.lane === lane),
      fresh = cases.find(
        (c) =>
          c.taxMode === "half" &&
          c.lane === lane &&
          c.scenario === scenario &&
          c.enabled,
      );
    if (!a.length || !fresh) continue;
    comparison.push({
      scenario,
      lane,
      old: {
        nationalEndC: mean(a.map((r) => r.national.endingTreasuryC)),
        colonySpendingC: mean(a.map((r) => r.national.colonySpendingC)),
        bodies: Object.fromEntries(
          ["earth", "moon", "mars"].map((id) => [
            id,
            {
              waterMinimum: min(a.map((r) => r.bodies[id].life.water.minimum)),
              oxygenMinimum: min(
                a.map((r) => r.bodies[id].life.oxygen.minimum),
              ),
              margin: mean(a.map((r) => r.bodies[id].margin)),
              paybackYears: mean(a.map((r) => r.bodies[id].paybackYears)),
              netFiscalC: mean(a.map((r) => r.bodies[id].netFiscalC)),
              alloyU: mean(a.map((r) => r.bodies[id].alloyU)),
              productionRatio: mean(
                a.map((r) => r.productionComparison?.[id]?.totalRatio),
              ),
              privateIceModules: mean(
                a.map((r) => r.bodies[id].privateIceModules),
              ),
            },
          ]),
        ),
      },
      current: fresh,
    });
  }
const criteriaSummary = [];
for (const taxMode of modes)
  for (const lane of ["self", "relief"]) {
    const a = all.filter((r) => r.taxMode === taxMode && r.lane === lane),
      on = a.filter((r) => r.enabled),
      legacy = on.filter(
        (r) => r.stage === "final" && r.classification !== "information",
      ),
      e0 = on.filter((r) => r.scenario === "E0");
    const life = (enabled) =>
      a
        .filter((r) => r.enabled === enabled && r.lifeRequired)
        .flatMap((r) =>
          ["moon", "mars"].flatMap((id) => [
            r.checks["lifeWater_" + id],
            r.checks["lifeOxygen_" + id],
          ]),
        );
    const l = life(true),
      off = life(false);
    criteriaSummary.push({
      taxMode,
      lane,
      legacyRequired: legacy.length,
      legacyPassing: legacy.filter((r) =>
        Object.values(r.legacyChecks).every(Boolean),
      ).length,
      marginPassing: e0.filter((r) => r.checks.hydrogenMarketMargin).length,
      paybackPassing: e0.filter((r) => r.checks.electrolyzerPayback).length,
      earthGainPassing: e0.filter((r) => r.checks.earthNetProduction).length,
      lifeConditions: l.length,
      lifePassing: l.filter(Boolean).length,
      offLifeConditions: off.length,
      offLifePassing: off.filter(Boolean).length,
      negativeMonths: a.reduce((n, r) => n + r.national.negativeMonths, 0),
      integrityPassing: a.filter((r) => r.integrity).length,
      runs: a.length,
    });
  }
const summary = {
  ...result,
  date: "2026-11-07 Asia/Seoul",
  cases,
  comparison,
  criteriaSummary,
  assumptions: {
    tax: "National.25; holiday5y; unterraformed inherited national factor .5 [provisional], comparisons0/1. Explicit planet then sector overrides. No terraforming transitions.",
    cost: "Tank.1x electrolysis capital prorated by existing waterTankU, same4SCU/U,100U increments/1month [provisional]. Dedicated capex prorated by capacity, existing6-month lag and positive O2/H2 liquefaction coefficients; no SCU shipment for connected storage. Costs to first fill include shared life costs, not pure reserve incremental cost. Inventory and power valuations not extra cash.",
    population:
      "Existing exogenous population growth. Tax-dependent migration/behavior absent; equal population does not prove taxes have no demographic effect.",
    mars: "Existing private water200000U retained; Mars ice need not bind.",
    shock:
      "Fulfilled-prefix months include ongoing production plus reserves; censored when whole challenge served. They do not measure pure stock-only autonomy.",
  },
};
write431(root + "/summary.json", summary);
const esc = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"',
  csv = (name, columns, rows) =>
    fs.writeFileSync(
      root + "/" + name,
      [
        columns.map(esc).join(","),
        ...rows.map((r) => columns.map((k) => esc(r[k])).join(",")),
      ].join("\n") + "\n",
    );
csv(
  "runs.csv",
  [
    "taxMode",
    "lane",
    "scenario",
    "seed",
    "enabled",
    "passed",
    "integrity",
    "lifeRequired",
    "failures",
    "nationalEndC",
    "nationalMinC",
  ],
  all.map((r) => ({
    ...r,
    failures: r.failures.join("|"),
    nationalEndC: r.national.endingTreasuryC,
    nationalMinC: r.national.minimumTreasuryC,
  })),
);
csv(
  "annual-fiscal.csv",
  [
    "taxMode",
    "lane",
    "scenario",
    "seed",
    "enabled",
    "body",
    "year",
    "taxC",
    "spendingC",
    "netTaxC",
    "cashNetC",
  ],
  all.flatMap((r) =>
    ["earth", "moon", "mars"].flatMap((body) =>
      r.bodies[body].annualFiscal.map((a) => ({
        taxMode: r.taxMode,
        lane: r.lane,
        scenario: r.scenario,
        seed: r.seed,
        enabled: r.enabled,
        body,
        ...a,
      })),
    ),
  ),
);
csv(
  "life-reserve.csv",
  [
    "taxMode",
    "lane",
    "scenario",
    "seed",
    "enabled",
    "body",
    "waterMinimum",
    "oxygenMinimum",
    "waterFirstFullMonth",
    "oxygenFirstFullMonth",
    "waterDrawU",
    "oxygenDrawU",
    "dedicatedWaterU",
    "dedicatedPowerGWh",
    "dedicatedCapitalC",
    "dedicatedOperatingC",
  ],
  all.flatMap((r) =>
    ["moon", "mars"].map((body) => {
      const b = r.bodies[body];
      return {
        taxMode: r.taxMode,
        lane: r.lane,
        scenario: r.scenario,
        seed: r.seed,
        enabled: r.enabled,
        body,
        waterMinimum: b.life.water.minimum,
        oxygenMinimum: b.life.oxygen.minimum,
        waterFirstFullMonth: b.reserve.firstFill.water.month,
        oxygenFirstFullMonth: b.reserve.firstFill.oxygen.month,
        waterDrawU: b.reserve.waterDrawU,
        oxygenDrawU: b.reserve.oxygenDrawU,
        dedicatedWaterU: b.dedicated.waterU,
        dedicatedPowerGWh: b.dedicated.powerGWh,
        dedicatedCapitalC: b.dedicated.capitalC,
        dedicatedOperatingC: b.dedicated.maintenanceC + b.dedicated.variableC,
      };
    }),
  ),
);
console.log(
  "Summary " +
    all.length +
    " runs / " +
    cases.length +
    " paired-context records / " +
    all.length * 60 +
    " fiscal body-years",
);

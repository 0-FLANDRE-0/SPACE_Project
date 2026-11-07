import { read43, write43 } from "./econ-round4-3-inputs.mjs";
const root = "docs/econ-sim/round4-3",
  results = read43(root + "/results.json"),
  choices = read43(root + "/candidates.json").choices,
  groups = {
    final: read43(root + "/final-runs.json"),
    survival: read43(root + "/survival-runs.json"),
    control: read43(root + "/no-cut-controls.json"),
    cut: read43(root + "/h-cut.json"),
  },
  all = Object.values(groups).flat(),
  legacy = read43(root + "/legacy-verification.json");
const valid = (a) =>
    a.filter((x) => x !== null && x !== undefined && Number.isFinite(x)),
  avg = (a) => {
    const b = valid(a);
    return b.length ? b.reduce((n, x) => n + x, 0) / b.length : null;
  },
  min = (a) => {
    const b = valid(a);
    return b.length ? Math.min(...b) : null;
  };
const markets = [],
  production = [],
  cutSummary = [],
  information = [],
  survival = [],
  national = [],
  oldComparison = [];
const meanFields = [
  "price",
  "ratedCost",
  "observedCost",
  "margin",
  "ratedMargin",
  "paybackYears",
  "utilization",
  "reductionShare",
  "meanFeasibleBreakEvenC",
  "meanCapacityBreakEvenC",
  "meanReductionTime",
  "meanTimeChange",
  "maximumTimeChange",
  "cashBlockedMonths",
  "cashPurchaseBlockedOwnerMonths",
  "cashInvestmentBlockedOwnerMonths",
  "oreLimitedAssetMonths",
  "meanRealAlloyPrice",
  "yieldBonusAlloyU",
  "processedOreU",
  "oreLimitedMonths",
  "oreLimitedCalendarRatio",
  "smeltEligibleMonths",
  "oreLimitedMonthRatio",
  "waterDeferredProposals",
  "waterDeferredAttempts",
  "waterDeferredFirstQuoteC",
  "waterDeferredOutstandingC",
  "alloyU",
  "reductionAlloyU",
  "privateOwnUsedU",
  "localExternalHydrogenU",
  "localExternalHydrogenC",
  "lifeWaterDemandU",
  "lifeWaterServedU",
  "lifeWaterUnmetU",
  "lifeWaterFulfilled",
  "waterGeneratedU",
  "waterRecycledU",
  "waterStockU",
  "privateGeneralUnmetU",
  "taxC",
  "spendingC",
  "netFiscalC",
  "cashContributionC",
  "meanEffectiveTaxRate",
  "waterDemandU",
  "waterServedU",
  "oxygenDemandU",
  "oxygenServedU",
  "oxygenProducedU",
  "oxygenStockU",
  "waterStockAllU",
  "iceProducedU",
  "iceEnergyGWh",
  "iceInitialU",
  "iceUsedFraction",
  "meanWaterPrice",
  "waterMarketU",
  "waterMarketC",
  "privateIceModules",
];
for (const c of choices)
  for (const lane of ["self", "relief"]) {
    for (const enabled of [false, true])
      for (const body of ["earth", "moon", "mars"]) {
        const a = groups.final.filter(
          (r) =>
            r.id === c.id &&
            r.lane === lane &&
            r.enabled === enabled &&
            r.scenario === "E0",
        );
        markets.push({
          id: c.id,
          lane,
          enabled,
          body,
          seeds: a.length,
          ...Object.fromEntries(
            meanFields.map((k) => [k, avg(a.map((r) => r.bodies[body][k]))]),
          ),
          noPaybackSeeds: a.filter((r) => r.bodies[body].paybackYears === null)
            .length,
        });
      }
    for (const world of ["E0", "H-CUT-CONTROL"])
      for (const body of ["earth", "moon", "mars"]) {
        const a = all.filter(
          (r) =>
            r.id === c.id &&
            r.lane === lane &&
            r.enabled &&
            r.scenario === world,
        );
        production.push({
          id: c.id,
          lane,
          world,
          body,
          seeds: a.length,
          onTotalU: avg(a.map((r) => r.productionComparison[body].onTotalU)),
          offTotalU: avg(a.map((r) => r.productionComparison[body].offTotalU)),
          meanTotalRatio: avg(
            a.map((r) => r.productionComparison[body].totalRatio),
          ),
          minimumTotalRatio: min(
            a.map((r) => r.productionComparison[body].totalRatio),
          ),
          minimum12MonthRatio: min(
            a.map((r) => r.productionComparison[body].worst12Ratio),
          ),
          strictGainSeeds: a.filter(
            (r) =>
              r.productionComparison[body].onTotalU >
              r.productionComparison[body].offTotalU,
          ).length,
          wholePassing: a.filter(
            (r) => r.productionComparison[body].wholePeriod,
          ).length,
          all12Passing: a.filter(
            (r) => r.productionComparison[body].all12MonthWindows,
          ).length,
          industrySeeds: a.filter(
            (r) => r.productionComparison[body].hasControlIndustry,
          ).length,
        });
      }
    for (const scenario of [...new Set(groups.cut.map((r) => r.scenario))]) {
      const a = groups.cut.filter(
        (r) =>
          r.id === c.id &&
          r.lane === lane &&
          r.enabled &&
          r.scenario === scenario,
      );
      cutSummary.push({
        id: c.id,
        lane,
        scenario,
        body: a[0].cut.body,
        duration: a[0].cut.durationMonths,
        loss: a[0].cut.inventoryLossFraction,
        seeds: a.length,
        onProducedU: avg(a.map((r) => r.cut.producedQ / 1000)),
        offProducedU: avg(a.map((r) => r.cut.offProducedU)),
        minimumOnOffRatio: min(a.map((r) => r.cut.productionRatio)),
        onOwnControlRatio: avg(a.map((r) => r.cut.sameTechnologyNoCutRatio)),
        minimumOwnControlRatio: min(
          a.map((r) => r.cut.sameTechnologyNoCutRatio),
        ),
        productionPassingSeeds: a.filter((r) => r.cut.passesOld95).length,
        duringElectrolysisU: avg(a.map((r) => r.cut.electrolysisU)),
        minimumWaterMonth: min(
          a.map((r) => r.bodies[a[0].cut.body].life.water.minimum),
        ),
        minimumOxygenMonth: min(
          a.map((r) => r.bodies[a[0].cut.body].life.oxygen.minimum),
        ),
      });
    }
    for (const world of [...new Set(all.map((r) => r.scenario))]) {
      const a = all.filter(
        (r) =>
          r.id === c.id && r.lane === lane && r.enabled && r.scenario === world,
      );
      national.push({
        id: c.id,
        lane,
        world,
        seeds: a.length,
        ...Object.fromEntries(
          [
            "initialTreasuryC",
            "endingTreasuryC",
            "totalBudgetC",
            "colonySpendingC",
            "totalSpendingC",
            "colonyBudgetShare",
            "colonyTotalSpendingShare",
          ].map((k) => [k, avg(a.map((r) => r.national[k]))]),
        ),
        minimumTreasuryC: min(a.map((r) => r.national.minimumTreasuryC)),
        annual: Array.from({ length: 20 }, (_, i) => ({
          year: i + 1,
          ...Object.fromEntries(
            ["budgetC", "spendingC", "colonySpendingC", "treasuryC"].map(
              (k) => [k, avg(a.map((r) => r.national.annual[i][k]))],
            ),
          ),
        })),
      });
      for (const body of ["earth", "moon", "mars"]) {
        const off = (r) =>
          all.find(
            (o) =>
              o.id === c.id &&
              o.lane === lane &&
              !o.enabled &&
              o.seed === r.seed &&
              o.scenario === world,
          );
        const info = {
          id: c.id,
          lane,
          world,
          body,
          seeds: a.length,
          ...Object.fromEntries(
            meanFields.map((k) => [k, avg(a.map((r) => r.bodies[body][k]))]),
          ),
          netAlloySupplyChangeU: avg(
            a.map((r) =>
              r.productionComparison?.[body]
                ? r.productionComparison[body].onTotalU -
                  r.productionComparison[body].offTotalU
                : r.bodies[body].alloyU - off(r).bodies[body].alloyU,
            ),
          ),
          offMeanRealAlloyPrice: avg(
            a.map((r) => off(r).bodies[body].meanRealAlloyPrice),
          ),
          realAlloyPriceChangeRatio: avg(
            a.map(
              (r) =>
                r.bodies[body].meanRealAlloyPrice /
                  off(r).bodies[body].meanRealAlloyPrice -
                1,
            ),
          ),
          minimumWaterMonth: min(
            a.map((r) => r.bodies[body].life.water.minimum),
          ),
          minimumOxygenMonth: min(
            a.map((r) => r.bodies[body].life.oxygen.minimum),
          ),
          waterPassingSeeds: a.filter(
            (r) =>
              r.bodies[body].life.water.eligibleMonths > 0 &&
              r.bodies[body].life.water.below99Months === 0,
          ).length,
          oxygenPassingSeeds: a.filter(
            (r) =>
              r.bodies[body].life.oxygen.eligibleMonths > 0 &&
              r.bodies[body].life.oxygen.below99Months === 0,
          ).length,
          meanWaterBadMonths: avg(
            a.map((r) => r.bodies[body].life.water.below99Months),
          ),
          meanOxygenBadMonths: avg(
            a.map((r) => r.bodies[body].life.oxygen.below99Months),
          ),
          positiveFiscalYears: [
            ...new Set(a.map((r) => r.bodies[body].firstPositiveFiscalYear)),
          ],
          sustainedPositiveFiscalYears: [
            ...new Set(
              a.map((r) => r.bodies[body].sustainedPositiveFiscalYear),
            ),
          ],
          annualFiscal: Array.from({ length: 20 }, (_, i) => ({
            year: i + 1,
            ...Object.fromEntries(
              ["taxC", "spendingC", "inflowC", "netTaxC", "cashNetC"].map(
                (k) => [
                  k,
                  avg(a.map((r) => r.bodies[body].annualFiscal[i][k])),
                ],
              ),
            ),
          })),
        };
        information.push(info);
        if (world.startsWith("C43") && body !== "earth")
          survival.push({
            ...info,
            iceEnabled: a[0].policy.iceEnabled,
            holidayYears: a[0].policy.holidayYears,
            waterTotalFraction: info.waterDemandU
              ? info.waterServedU / info.waterDemandU
              : null,
            oxygenTotalFraction: info.oxygenDemandU
              ? info.oxygenServedU / info.oxygenDemandU
              : null,
          });
      }
    }
  }
const prior = read43("docs/econ-sim/round4-2-2/summary.json"),
  priorEarth = prior.markets.find(
    (r) =>
      r.id === "R422-rounded" &&
      r.lane === "self" &&
      r.enabled &&
      r.body === "earth",
  );
for (const lane of ["self", "relief"])
  for (const world of ["E0", "E2-S", "H-CUT-CONTROL"])
    for (const body of ["earth", "moon", "mars"]) {
      const base =
          world === "H-CUT-CONTROL"
            ? read43("docs/econ-sim/round4-2-2/no-cut-controls.json")
            : read43("docs/econ-sim/round4-2-2/final-runs.json"),
        a = base.filter(
          (r) =>
            r.id === "R422-rounded" &&
            r.lane === lane &&
            r.enabled &&
            r.scenario === world,
        ),
        oldCash = legacy.records.filter(
          (r) => r.lane === lane && r.enabled && r.scenario === world,
        ),
        current = information.find(
          (r) =>
            r.id === "R43-rounded" &&
            r.lane === lane &&
            r.world === world &&
            r.body === body,
        ),
        nation = national.find(
          (r) => r.id === "R43-rounded" && r.lane === lane && r.world === world,
        );
      oldComparison.push({
        world,
        lane,
        body,
        oldWaterTotalFraction: avg(
          a.map((r) => r.bodies[body].lifeWaterFulfilled),
        ),
        oldOxygenModeled: false,
        oldAlloyU: avg(a.map((r) => r.bodies[body].alloyU)),
        oldMinimumLocalGovernmentC: min(
          oldCash.map((r) => r.bodies[body].minimumGovernmentC),
        ),
        oldEndingLocalGovernmentC: avg(
          oldCash.map((r) => r.bodies[body].endingGovernmentC),
        ),
        oldCashAtOrBelow1Seeds: oldCash.filter(
          (r) => r.bodies[body].firstCashAtOrBelow1Month !== null,
        ).length,
        newLocalGovernmentC: null,
        newNationMinimumC: nation.minimumTreasuryC,
        newNationEndC: nation.endingTreasuryC,
        newWaterMinimum: current.minimumWaterMonth,
        newOxygenMinimum: current.minimumOxygenMonth,
        newTaxNetC: current.netFiscalC,
      });
    }
write43(root + "/summary.json", {
  answer:
    results.selfPassing || results.reliefPassing
      ? "일부 검토안이 지정 범위를 통과했다. 식민지 재정·초기 재고·정보용 충격 지표를 함께 검토해야 한다."
      : "국가 금고가 식민지 정부 비용을 지불하고 얼음·산소 생명유지를 연결했지만, 모든 재정·전력·생존·수소 조건을 함께 통과한 안은 없다.",
  counts: results.counts,
  selfPassing: results.selfPassing,
  reliefPassing: results.reliefPassing,
  qualification: results.qualification,
  markets,
  production,
  cutSummary,
  information,
  survival,
  national,
  oldComparison,
  prior422: priorEarth,
  tax: read43("scripts/econ-round4-3.config.json").tax,
  scope: results.scope,
});
console.log(
  JSON.stringify({
    self: results.selfPassing,
    relief: results.reliefPassing,
    survivalRows: survival.length,
    informationRows: information.length,
  }),
);

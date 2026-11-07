import { read421, write421 } from "./econ-round4-2-1-inputs.mjs";
const root = "docs/econ-sim/round4-2-1",
  r = read421(root + "/results.json"),
  final = read421(root + "/final-runs.json"),
  cuts = read421(root + "/h-cut.json"),
  control = read421(root + "/no-cut-controls.json"),
  choices = read421(root + "/candidates.json").choices;
const finite = (a) =>
    a.filter((x) => x !== null && x !== undefined && Number.isFinite(x)),
  avg = (a) => {
    const f = finite(a);
    return f.length ? f.reduce((n, x) => n + x, 0) / f.length : null;
  },
  min = (a) => {
    const f = finite(a);
    return f.length ? Math.min(...f) : null;
  };
const markets = [],
  production = [],
  cutSummary = [],
  information = [];
for (const c of choices)
  for (const lane of ["self", "relief"]) {
    for (const enabled of [false, true])
      for (const body of ["earth", "moon", "mars"]) {
        const rows = final.filter(
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
          seeds: rows.length,
          ...Object.fromEntries(
            [
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
            ].map((k) => [k, avg(rows.map((r) => r.bodies[body][k]))]),
          ),
          noPaybackSeeds: rows.filter(
            (r) => r.bodies[body].paybackYears === null,
          ).length,
        });
      }
    for (const world of ["E0", "H-CUT-CONTROL"])
      for (const body of ["earth", "moon", "mars"]) {
        const a = (world === "E0" ? final : control).filter(
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
    for (const scenario of [...new Set(cuts.map((r) => r.scenario))]) {
      const a = cuts.filter(
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
        onOwnControlRatio: avg(
          a.map((r) => r.cut.cutToSameTechnologyNoCutRatio),
        ),
        minimumOwnControlRatio: min(
          a.map((r) => r.cut.cutToSameTechnologyNoCutRatio),
        ),
        productionPassingSeeds: a.filter((r) => r.checks.cutProduction).length,
        duringElectrolysisU: avg(a.map((r) => r.cut.electrolysisU)),
      });
    }
    for (const world of ["E0", "H-CUT-CONTROL"])
      for (const body of ["earth", "moon", "mars"]) {
        const a = (world === "E0" ? final : control).filter(
          (r) =>
            r.id === c.id &&
            r.lane === lane &&
            r.enabled &&
            r.scenario === world,
        );
        information.push({
          id: c.id,
          lane,
          world,
          body,
          ...Object.fromEntries(
            [
              "price",
              "reductionShare",
              "meanReductionTime",
              "meanTimeChange",
              "maximumTimeChange",
              "cashBlockedMonths",
              "cashPurchaseBlockedOwnerMonths",
              "cashInvestmentBlockedOwnerMonths",
              "oreLimitedAssetMonths",
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
            ].map((k) => [k, avg(a.map((r) => r.bodies[body][k]))]),
          ),
        });
      }
  }
const old = read421("docs/econ-sim/round4-2/summary.json"),
  prior = old.market.find(
    (r) =>
      r.id === "R42-rounded" &&
      r.lane === "self" &&
      r.enabled &&
      r.body === "earth",
  );
write421(root + "/summary.json", {
  answer:
    r.selfPassing > 0 || r.reliefPassing > 0
      ? "일부 검토안이 지정 범위를 통과했다. 적용은 사용자 결정 사항이다."
      : "순증산·운영 대체·현금 안전선을 적용했지만, 수소 공급 과잉 해소와 무차단·차단 생산 무해성을 함께 충족한 검토안은 없다.",
  counts: r.counts,
  selfPassing: r.selfPassing,
  reliefPassing: r.reliefPassing,
  qualification: r.qualification,
  markets,
  production,
  cutSummary,
  information,
  prior42: {
    marketPrice: prior.meanMarketPrice,
    observedCost: prior.observedCost,
    margin: prior.marketMargin,
    paybackYears: prior.paybackYears,
    utilization: prior.utilization,
    policy: read421("docs/econ-sim/round4-2/candidates.json").choices.find(
      (r) => r.id === "R42-rounded",
    ).policy,
  },
  scope: r.scope,
});
console.log(
  JSON.stringify({
    self: r.selfPassing,
    relief: r.reliefPassing,
    counts: r.counts,
  }),
);

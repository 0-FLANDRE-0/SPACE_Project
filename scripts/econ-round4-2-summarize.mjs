import { read42, write42 } from "./econ-round4-2-inputs.mjs";
const root = "docs/econ-sim/round4-2",
  results = read42(root + "/results.json"),
  final = read42(root + "/final-runs.json"),
  cuts = read42(root + "/h-cut.json"),
  choices = read42(root + "/candidates.json").choices;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null),
  values = (a, f) =>
    a.map(f).filter((x) => x !== null && x !== undefined && Number.isFinite(x)),
  avg = (a, f) => mean(values(a, f)),
  minimum = (a, f) => {
    const x = values(a, f);
    return x.length ? Math.min(...x) : null;
  };
const market = [];
for (const choice of choices)
  for (const lane of ["self", "relief"])
    for (const enabled of [false, true])
      for (const body of ["earth", "moon", "mars"]) {
        const a = final.filter(
          (r) =>
            r.id === choice.id &&
            r.lane === lane &&
            r.enabled === enabled &&
            r.scenario === "E0",
        );
        market.push({
          id: choice.id,
          profileId: choice.profile.id,
          baseId: choice.profile.baseId,
          lane,
          enabled,
          body,
          seeds: a.length,
          meanMarketPrice: avg(a, (r) => r.bodies[body].price),
          ratedCost: avg(a, (r) => r.bodies[body].ratedCost),
          observedCost: avg(a, (r) => r.bodies[body].observedCost),
          marketMargin: avg(a, (r) => r.bodies[body].margin),
          worstMarketMargin: minimum(a, (r) => r.bodies[body].margin),
          ratedMargin: avg(a, (r) => r.bodies[body].ratedMargin),
          paybackYears: avg(a, (r) => r.bodies[body].paybackYears),
          noPaybackSeeds: a.filter((r) => r.bodies[body].paybackYears === null)
            .length,
          utilization: avg(a, (r) => r.bodies[body].utilization),
          reductionShare: avg(a, (r) => r.bodies[body].reductionShare),
          reductionAlloyU: avg(a, (r) => r.bodies[body].reductionAlloyU),
          conventionalFallbackAlloyU: avg(
            a,
            (r) => r.bodies[body].conventionalFallbackAlloyU,
          ),
          meanBreakEven: avg(a, (r) => r.bodies[body].breakEvenAtMeanAlloyC),
          waterGeneratedU: avg(a, (r) => r.bodies[body].waterGeneratedU),
          waterLifeU: avg(a, (r) => r.bodies[body].lifeWaterServedU),
          waterLifeUnmetU: avg(a, (r) => r.bodies[body].lifeWaterUnmetU),
          waterRecycledU: avg(a, (r) => r.bodies[body].waterRecycledU),
          waterStockU: avg(a, (r) => r.bodies[body].waterStockU),
          waterIntakeU: avg(a, (r) => r.bodies[body].waterIntakeU),
          waterAvoidedC: avg(a, (r) => r.bodies[body].waterAvoidedC),
          privateOwnUsedU: avg(a, (r) => r.bodies[body].privateOwnUsedU),
          localExternalHydrogenU: avg(
            a,
            (r) => r.bodies[body].localExternalHydrogenU,
          ),
          localExternalHydrogenC: avg(
            a,
            (r) => r.bodies[body].localExternalHydrogenC,
          ),
          privateGeneralUnmetU: avg(
            a,
            (r) => r.bodies[body].privateGeneralUnmetU,
          ),
          legacyHydrogenReferenceMargin: avg(
            a,
            (r) => r.hydrogenAtReferenceMarginC,
          ),
          legacyPassSeeds: a.filter((r) =>
            Object.values(r.legacyChecks).every(Boolean),
          ).length,
          newE0PassSeeds: a.filter((r) => r.passed).length,
          maxSwitches: Math.max(
            ...a.map((r) => r.maxSwitchesPerAssetRollingYear),
          ),
        });
      }
const cutSummary = [];
for (const choice of choices)
  for (const lane of ["self", "relief"])
    for (const scenario of [...new Set(cuts.map((r) => r.scenario))]) {
      const a = cuts.filter(
        (r) =>
          r.id === choice.id &&
          r.lane === lane &&
          r.scenario === scenario &&
          r.enabled,
      );
      cutSummary.push({
        id: choice.id,
        lane,
        scenario,
        body: a[0].cut.body,
        duration: a[0].cut.durationMonths,
        loss: a[0].cut.inventoryLossFraction,
        seeds: a.length,
        onProducedU: avg(a, (r) => r.cut.producedU),
        offProducedU: avg(a, (r) => r.cut.offProducedU),
        meanRatio: avg(a, (r) => r.cut.productionRatio),
        minimumRatio: minimum(a, (r) => r.cut.productionRatio),
        zeroControlSeeds: a.filter((r) => r.cut.offProducedU === 0).length,
        productionPassingSeeds: a.filter((r) => r.checks.cutProduction).length,
        previouslyActiveSeeds: a.filter((r) => r.cut.preCutReductionU > 0)
          .length,
        formalFallbackSeeds: a.filter((r) => r.cut.conventionalSwitches > 0)
          .length,
        returningSeeds: a.filter(
          (r) => r.cut.preCutReductionU > 0 && r.cut.returnDelayMonths !== null,
        ).length,
        returnMeanMonths: avg(
          a.filter((r) => r.cut.preCutReductionU > 0),
          (r) => r.cut.returnDelayMonths,
        ),
        postCutReductionSeeds: a.filter((r) => r.cut.returnDelayMonths !== null)
          .length,
        postCutFirstReductionMeanMonths: avg(a, (r) => r.cut.returnDelayMonths),
        maxSwitches: Math.max(
          ...a.map((r) => r.maxSwitchesPerAssetRollingYear),
        ),
        duringElectrolysisU: avg(a, (r) => r.cut.duringElectrolysisU),
      });
    }
const qualification = results.candidateSummaries.map((c) => {
  const a = [...final, ...cuts].filter((r) => r.id === c.id && r.enabled),
    lanes = {};
  for (const lane of ["self", "relief"]) {
    const all = a.filter((r) => r.lane === lane),
      rs = all.filter(
        (r) => r.classification !== "information" || r.stage === "cut",
      ),
      failures = {};
    for (const r of all)
      for (const k of r.failures) {
        const old = k in r.legacyChecks;
        if (old && r.classification === "information" && r.stage !== "cut")
          continue;
        failures[k] = (failures[k] ?? 0) + 1;
      }
    lanes[lane] = {
      passed: Object.keys(failures).length === 0,
      requiredRuns: rs.length,
      allNewRuleRuns: all.length,
      failures,
    };
  }
  return { ...c, self: lanes.self, relief: lanes.relief };
});
const primary = market.filter(
  (r) =>
    r.enabled &&
    r.body === "earth" &&
    r.lane === "self" &&
    r.profileId !== "R41-rounded",
);
const answer = primary.every(
  (r) => r.worstMarketMargin !== null && r.worstMarketMargin >= 0,
)
  ? "네 기존 기반 모두에서 시장 마진 조건을 충족했다. 다른 조건은 별도 판정을 따른다."
  : "일부 기반의 시장 마진은 개선되지만, 네 기존 기반에 공통인 공급 과잉 해소·신규 수전해 수익성을 확인하지 못했다.";
write42(root + "/summary.json", {
  answer,
  counts: results.counts,
  selfPassing: qualification.filter((c) => c.self.passed).length,
  reliefPassing: qualification.filter((c) => c.relief.passed).length,
  qualification,
  market,
  cutSummary,
  scope:
    "Market table E0, arithmetic mean of5 seeds and240 monthly quotes. No guaranteed sales; original4.1 information classification retained. New switch criterion checks every ON path including information scenarios. H-CUT rows61..60+duration.",
});
console.log(
  JSON.stringify({
    answer,
    self: qualification.filter((c) => c.self.passed).length,
    relief: qualification.filter((c) => c.relief.passed).length,
  }),
);

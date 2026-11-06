import { metrics41, compact41 } from "./econ-round4-1-analysis.mjs";
import { hydrogenCost } from "../dist/src/economy-round4-units.js";
import { normalizeRound4Energy } from "../dist/src/economy-round4-model.js";
import { breakEven42 } from "../dist/src/economy-round4-2-policy.js";
const sum = (a) => a.reduce((n, x) => n + x, 0),
  mean = (a) => (a.length ? sum(a) / a.length : null);
export function financial42(
  p,
  e,
  r,
  {
    body = "earth",
    utilization = 1,
    price,
    recycleShare = 0,
    costShare = 0.5,
  } = {},
) {
  if (!(utilization > 0))
    return {
      ratedCost: null,
      observedCost: null,
      margin: null,
      ratedMargin: null,
      paybackYears: null,
      utilization,
    };
  const en = normalizeRound4Energy(e, r),
    rated = hydrogenCost(p, en, r, { planet: body, marketPrice: price }),
    actual = hydrogenCost(p, en, r, {
      planet: body,
      marketPrice: price,
      utilization,
    }),
    saving =
      en.hydrogenVariableCPerU *
      costShare *
      Math.max(0, Math.min(1, recycleShare)),
    observedCost = actual.totalCPerU - saving,
    opCost = observedCost - actual.equipmentRecoveryCPerU,
    capital = en.hydrogenModuleC + en.hydrogenModuleAlloyU * p.baseAlloyPrice,
    annualNet = (price - opCost) * actual.capacityU * 12;
  return {
    ratedCost: rated.totalCPerU - saving,
    observedCost,
    margin: price - observedCost,
    ratedMargin: price - rated.totalCPerU + saving,
    paybackYears: annualNet > 0 ? capital / annualNet : null,
    utilization,
    avoidedWaterCostCPerU: saving,
    capitalC: capital,
    annualNetC: annualNet,
    boundary:
      "new SCU module at observed aggregate utilization; not guaranteed entrant sales",
  };
}
export function maxSwitches42(events) {
  const groups = new Map();
  let maximum = 0;
  for (const e of events.filter((x) => x.changed)) {
    const key = e.body + "/" + e.asset,
      q = groups.get(key) ?? [];
    while (q.length && q[0] <= e.month - 12) q.shift();
    q.push(e.month);
    groups.set(key, q);
    maximum = Math.max(maximum, q.length);
  }
  return maximum;
}
export function metrics42(
  x,
  p,
  e,
  profile,
  policy,
  config,
  { scenario, seed, lane, cut = null } = {},
) {
  const baseR = { ...profile.parameters, hydrogenPrice: 0.4 },
    prior = metrics41(
      x,
      p,
      e,
      baseR,
      {
        ...profile.policy41,
        marketRelief: lane === "relief",
        importRelief: lane === "relief",
      },
      config.criteria41,
      { scenario, seed },
    ),
    rows = x.rows.slice(1),
    bodies = {};
  for (const id of ["earth", "moon", "mars"]) {
    const a = rows.map((r) => r.planets[id]),
      ext = rows.map((r) => r.round42?.[id]),
      flow = (k) => sum(a.map((r) => r.flow[k] ?? 0)),
      capacity = sum(ext.map((r) => r?.electrolyzerCapacityU ?? 0)),
      electrolysisU = flow("hydrogenElectrolysisU"),
      util = capacity ? Math.min(1, electrolysisU / capacity) : 0,
      price = mean(a.map((r) => r.hydrogenPrice)),
      recycleShare = electrolysisU ? flow("waterRecycledU") / electrolysisU : 0,
      finance = financial42(p, e, baseR, {
        body: id,
        utilization: util,
        price,
        recycleShare,
        costShare: policy.waterIntakeCostShare,
      }),
      oldTotal = flow("producedU"),
      waterDemand = flow("lifeWaterDemandU"),
      last = x.state.planets[id];
    bodies[id] = {
      price,
      minimumPrice: Math.min(...a.map((r) => r.hydrogenPrice)),
      maximumPrice: Math.max(...a.map((r) => r.hydrogenPrice)),
      endPrice: a.at(-1).hydrogenPrice,
      ...finance,
      capacityMonthsU: capacity,
      electrolysisU,
      byproductHydrogenU: flow("hydrogenByproductU"),
      hydrogenUsedU: flow("hydrogenUsedU"),
      alloyU: oldTotal,
      reductionAlloyU: flow("reductionAlloyU"),
      reductionShare: oldTotal ? flow("reductionAlloyU") / oldTotal : 0,
      conventionalFallbackAlloyU: flow("conventionalFallbackAlloyU"),
      reductionHydrogenU: flow("reductionHydrogenU"),
      ownReductionHydrogenU: flow("reductionOwnHydrogenU"),
      privateOwnUsedU: last.h42 ? last.h42.private.usedOwnQ / 1000 : null,
      privateOwnProducedU: last.h42 ? last.h42.private.producedQ / 1000 : null,
      localExternalHydrogenU: flow("hydrogenMarketSoldU"),
      localExternalHydrogenC: flow("hydrogenMarketSalesC"),
      waterGeneratedU: flow("reductionWaterU"),
      lifeWaterDemandU: waterDemand,
      lifeWaterServedU: flow("lifeWaterServedU"),
      lifeWaterUnmetU: Math.max(0, waterDemand - flow("lifeWaterServedU")),
      lifeWaterFulfilled: waterDemand
        ? flow("lifeWaterServedU") / waterDemand
        : null,
      waterRecycledU: flow("waterRecycledU"),
      waterStockU: last.h42
        ? sum(Object.values(last.h42).map((a) => a.waterQ)) / 1000
        : 0,
      waterIntakeU: flow("waterIntakeU"),
      waterIntakeServicesC: flow("waterIntakeServicesC"),
      waterAvoidedC: flow("waterRecycleAvoidedC"),
      privateGeneralUnmetU: flow("unmetAlloyU"),
      breakEvenAtMeanAlloyC: breakEven42(
        policy,
        mean(a.map((r) => r.alloyPrice)),
      ),
      meanAlloyPrice: mean(a.map((r) => r.alloyPrice)),
      switchC: flow("smeltSwitchC"),
      switches: flow("smeltSwitches"),
    };
  }
  const added = {};
  if (scenario === "E0") {
    added.hydrogenMarketMargin =
      bodies.earth.margin !== null && bodies.earth.margin >= -1e-12;
    added.electrolyzerPayback =
      bodies.earth.paybackYears !== null &&
      bodies.earth.paybackYears <=
        config.criteria42.electrolyzerPaybackYearsMax;
  }
  const maxSwitch = maxSwitches42(x.state.events42 ?? []);
  added.switchOscillation =
    maxSwitch <= config.criteria42.switchesPerAssetRollingYearMax;
  const checks = { ...prior.checks, ...added },
    failures = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([k]) => k);
  let cutData = null;
  if (cut) {
    const window = rows.filter(
        (r) =>
          r.month > cut.startMonth &&
          r.month <= cut.startMonth + cut.durationMonths,
      ),
      pre = rows.filter(
        (r) => r.month > cut.startMonth - 12 && r.month <= cut.startMonth,
      ),
      post = rows.find(
        (r) =>
          r.month > cut.startMonth + cut.durationMonths &&
          (r.round42?.[cut.body]?.reductionAlloyU ?? 0) > 0,
      ),
      exit = (x.state.events42 ?? []).filter(
        (e) =>
          e.body === cut.body &&
          e.changed &&
          e.target === "conventional" &&
          e.month >= cut.startMonth &&
          e.month < cut.startMonth + cut.durationMonths,
      );
    cutData = {
      body: cut.body,
      startMonth: cut.startMonth,
      durationMonths: cut.durationMonths,
      inventoryLossFraction: cut.inventoryLossFraction,
      producedU: sum(window.map((r) => r.planets[cut.body].flow.producedU)),
      preCutReductionU: sum(
        pre.map((r) => r.round42?.[cut.body]?.reductionAlloyU ?? 0),
      ),
      duringReductionU: sum(
        window.map((r) => r.round42?.[cut.body]?.reductionAlloyU ?? 0),
      ),
      duringElectrolysisU: sum(
        window.map((r) => r.planets[cut.body].flow.hydrogenElectrolysisU),
      ),
      conventionalSwitches: exit.length,
      firstConventionalMonth: exit[0]?.month ?? null,
      returnProductionRow: post?.month ?? null,
      returnDelayMonths: post
        ? post.month - cut.startMonth - cut.durationMonths
        : null,
      stoppedAssetMonths: sum(
        window.map((r) => r.planets[cut.body].pausedFacilities),
      ),
      fixtureFundingC: x.state.planets[cut.body].cutFundingC42 ?? 0,
    };
  }
  return {
    ...prior,
    legacyChecks: prior.checks,
    checks,
    failures,
    passed: !failures.length,
    bodies,
    maxSwitchesPerAssetRollingYear: maxSwitch,
    cut: cutData,
  };
}
export function compact42(rows) {
  return rows.map((r) => ({
    month: r.month,
    ...Object.fromEntries(
      ["earth", "moon", "mars"].flatMap((id) => {
        const b = r.planets[id],
          x = r.round42?.[id] ?? {};
        return [
          ["alloyPrice", b.alloyPrice],
          ["hydrogenPrice", b.hydrogenPrice],
          ["producedU", b.flow.producedU],
          ["reductionAlloyU", b.flow.reductionAlloyU ?? 0],
          ["hydrogenUsedU", b.flow.hydrogenUsedU],
          ["electrolysisU", b.flow.hydrogenElectrolysisU],
          ["lifeDemandU", b.flow.lifeWaterDemandU ?? 0],
          ["lifeWaterU", b.flow.lifeWaterServedU ?? 0],
          ["waterRecycledU", b.flow.waterRecycledU ?? 0],
          ["waterStockU", x.waterPoolU ?? 0],
          ["switches", b.flow.smeltSwitches ?? 0],
          ["unmetAlloyU", b.flow.unmetAlloyU],
          ["health", b.meanHealth],
          ["unserved", b.flow.unservedGWh / Math.max(1, b.flow.demandGWh)],
          ["breakEven", x.breakEvenCPerU ?? 0],
        ].map(([k, v]) => [id + "_" + k, v]);
      }),
    ),
  }));
}
export function aggregate42(records) {
  const required = records.filter((r) => r.classification !== "information"),
    failed = {};
  for (const r of records)
    for (const k of r.failures) failed[k] = (failed[k] ?? 0) + 1;
  return {
    runs: records.length,
    requiredRuns: required.length,
    passed: required.length > 0 && required.every((r) => r.passed),
    integrity: records.every((r) => r.integrity),
    failures: failed,
    meanEarthMarketMargin: mean(
      records
        .filter((r) => r.scenario === "E0")
        .map((r) => r.bodies.earth.margin),
    ),
    maxSwitches: Math.max(
      0,
      ...records.map((r) => r.maxSwitchesPerAssetRollingYear),
    ),
    score:
      records.reduce(
        (n, r) =>
          n +
          (r.integrity ? 0 : 1000) +
          r.failures.length * 10 +
          (r.bodies.earth.margin === null
            ? 100
            : Math.max(0, -r.bodies.earth.margin) * 100) +
          Math.max(0, r.maxSwitchesPerAssetRollingYear - 2),
        0,
      ) / Math.max(1, records.length),
  };
}
// Supplemental valuation, not cash booked as a government sale. Existing4.1
// conventional finance checks remain intact and are reported separately.
export function observedIndustry42(x, p) {
  if (!x.state.capture42) throw Error("Explicit passive observer required");
  const assets = x.state.planets.earth.assets.filter(
    (a) => a.kind === "industry" && a.owner === "government" && !a.historic,
  );
  if (assets.length !== 1) throw Error("E0 single public pair assay only");
  const a = assets[0],
    investmentC =
      a.creditBasisC +
      a.alloyBasisU * p.baseAlloyPrice +
      (a.hydrogenU ?? 0) * 0.4;
  let net = 0,
    payback = null;
  const rows = [];
  for (const r of x.rows.slice(1)) {
    const b = r.planets.earth,
      f = b.flow,
      revenue = f.governmentProducedU * b.alloyPrice,
      cost =
        f.governmentIndustryDirectC / r.priceIndex +
        f.governmentIndustryUpkeepU * b.alloyPrice +
        f.governmentIndustryEnergy42GWh * b.powerPriceC +
        f.governmentIndustryHydrogen42U * b.hydrogenPrice +
        f.governmentSwitch42C / r.priceIndex,
      prior = net;
    net += revenue - cost;
    if (payback === null && net >= investmentC && net > prior)
      payback = (r.month - 1 + (investmentC - prior) / (net - prior)) / 12;
    rows.push({
      month: r.month,
      outputU: f.governmentProducedU,
      imputedProductValueC: revenue,
      realOperatingCostC: cost,
      cumulativeNetValueC: net,
      hydrogenU: f.governmentIndustryHydrogen42U,
      powerGWh: f.governmentIndustryEnergy42GWh,
    });
  }
  return {
    investmentC,
    paybackYears: payback,
    terminalNetValueC: net,
    governmentSelfSalesC: 0,
    meaning:
      "E0 actual public-pair volumes/costs valued at each local real quote; assumes full external product sale. No sale or value source is posted to the simulation ledger. Conventional4.1 assay remains a distinct fixed test.",
    rows,
  };
}

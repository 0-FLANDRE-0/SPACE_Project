import { metrics41, compact41 } from "./econ-round4-1-analysis.mjs";
import { financial42 } from "./econ-round4-2-analysis.mjs";
import { hash421 } from "./econ-round4-2-1-inputs.mjs";
const sum = (a) => a.reduce((n, x) => n + x, 0),
  mean = (a) => (a.length ? sum(a) / a.length : null);
export const productionQ421 = (rows) =>
  Object.fromEntries(
    ["earth", "moon", "mars"].map((b) => [
      b,
      rows.slice(1).map((r) => Math.round(r.planets[b].flow.producedU * 1000)),
    ]),
  );
export function compareProduction421(onQ, offQ) {
  if (onQ.length !== offQ.length || onQ.length < 12)
    throw Error("421 matched production paths");
  let on12 = sum(onQ.slice(0, 12)),
    off12 = sum(offQ.slice(0, 12)),
    minimumRatio = null,
    worstStartMonth = null,
    windowPass = true,
    zeroControlWindows = 0;
  for (let start = 0; start <= onQ.length - 12; start++) {
    if (start) {
      on12 += onQ[start + 11] - onQ[start - 1];
      off12 += offQ[start + 11] - offQ[start - 1];
    }
    if (on12 < off12) windowPass = false;
    if (off12 > 0) {
      const ratio = on12 / off12;
      if (minimumRatio === null || ratio < minimumRatio) {
        minimumRatio = ratio;
        worstStartMonth = start + 1;
      }
    } else zeroControlWindows++;
  }
  const onTotal = sum(onQ),
    offTotal = sum(offQ);
  return {
    onTotalU: onTotal / 1000,
    offTotalU: offTotal / 1000,
    totalRatio: offTotal > 0 ? onTotal / offTotal : null,
    wholePeriod: onTotal >= offTotal,
    worst12Ratio: minimumRatio,
    worstStartMonth,
    all12MonthWindows: windowPass,
    zeroControlWindows,
    hasControlIndustry: offTotal > 0,
    passed: onTotal >= offTotal && windowPass,
  };
}
export function metrics421(
  x,
  p,
  e,
  profile,
  policy,
  config,
  { scenario, seed, lane, cut = null } = {},
) {
  const prior = metrics41(
      x,
      p,
      e,
      { ...profile.parameters, hydrogenPrice: 0.4 },
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
  for (const body of ["earth", "moon", "mars"]) {
    const a = rows.map((r) => r.planets[body]),
      ext = rows.map((r) => r.round421?.[body]),
      flow = (k) => sum(a.map((r) => r.flow[k] ?? 0)),
      capacity = sum(ext.map((r) => r?.electrolyzerCapacityU ?? 0)),
      electrolysis = flow("hydrogenElectrolysisU"),
      price = mean(a.map((r) => r.hydrogenPrice)),
      recycle = flow("waterRecycledU"),
      finance = financial42(
        p,
        e,
        { ...profile.parameters, hydrogenPrice: 0.4 },
        {
          body,
          utilization: capacity ? Math.min(1, electrolysis / capacity) : 0,
          price,
          recycleShare: electrolysis ? recycle / electrolysis : 0,
          costShare: policy.waterIntakeCostShare,
        },
      ),
      last = x.state.planets[body],
      shares = a.map((r) =>
        (r.flow.smelterTime421 ?? 0) > 0
          ? r.flow.reductionTime421 / r.flow.smelterTime421
          : 0,
      ),
      changes = shares.slice(1).map((n, i) => Math.abs(n - shares[i])),
      demand = flow("lifeWaterDemandU"),
      served = flow("lifeWaterServedU"),
      alloy = flow("producedU");
    bodies[body] = {
      price,
      minimumPrice: Math.min(...a.map((r) => r.hydrogenPrice)),
      maximumPrice: Math.max(...a.map((r) => r.hydrogenPrice)),
      ...finance,
      electrolysisU: electrolysis,
      alloyU: alloy,
      reductionAlloyU: flow("reductionAlloyU"),
      reductionShare: alloy ? flow("reductionAlloyU") / alloy : 0,
      conventionalAlloyU: flow("conventionalFallbackAlloyU"),
      reductionHydrogenU: flow("reductionHydrogenU"),
      privateOwnUsedU: last.h421.private.usedOwnQ / 1000,
      localExternalHydrogenU: flow("hydrogenMarketSoldU"),
      localExternalHydrogenC: flow("hydrogenMarketSalesC"),
      waterGeneratedU: flow("reductionWaterU"),
      lifeWaterDemandU: demand,
      lifeWaterServedU: served,
      lifeWaterUnmetU: Math.max(0, demand - served),
      lifeWaterFulfilled: demand ? served / demand : null,
      waterRecycledU: recycle,
      waterStockU: sum(Object.values(last.h421).map((x) => x.waterQ)) / 1000,
      privateGeneralUnmetU: flow("unmetAlloyU"),
      meanFeasibleBreakEvenC: mean(ext.map((r) => r?.breakEvenCPerU ?? 0)),
      meanCapacityBreakEvenC: mean(
        ext.map((r) => r?.capacityBreakEvenCPerU ?? 0),
      ),
      oreLimitedAssetMonths: sum(ext.map((r) => r?.oreLimitedAssets ?? 0)),
      meanReductionTime: mean(shares),
      meanTimeChange: mean(changes),
      maximumTimeChange: Math.max(0, ...changes),
      cashBlockedMonths: a.filter(
        (r) =>
          (r.flow.cashPurchaseBlocked421 ?? 0) +
            (r.flow.cashInvestmentBlocked421 ?? 0) >
          0,
      ).length,
      cashPurchaseBlockedOwnerMonths: flow("cashPurchaseBlocked421"),
      cashInvestmentBlockedOwnerMonths: flow("cashInvestmentBlocked421"),
      guards: structuredClone(last.guards421),
    };
  }
  const checks = { ...prior.checks };
  if (scenario === "E0") {
    checks.hydrogenMarketMargin =
      bodies.earth.margin !== null && bodies.earth.margin >= 0;
    checks.electrolyzerPayback =
      bodies.earth.paybackYears !== null &&
      bodies.earth.paybackYears <=
        config.criteria421.electrolyzerPaybackYearsMax;
  }
  let cutResult = null;
  if (cut?.enabled !== false && cut) {
    const win = rows.filter(
      (r) =>
        r.month > cut.startMonth &&
        r.month <= cut.startMonth + cut.durationMonths,
    );
    cutResult = {
      ...cut,
      producedQ: sum(
        win.map((r) => Math.round(r.planets[cut.body].flow.producedU * 1000)),
      ),
      electrolysisU: sum(
        win.map((r) => r.planets[cut.body].flow.hydrogenElectrolysisU),
      ),
      reductionAlloyU: sum(
        win.map((r) => r.planets[cut.body].flow.reductionAlloyU),
      ),
    };
  }
  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return {
    ...prior,
    legacyChecks: prior.checks,
    checks,
    failures,
    passed: !failures.length,
    bodies,
    cut: cutResult,
    productionPathQ: productionQ421(x.rows),
    pathHash: hash421(compact421(x.rows)),
    legacyHash: hash421(compact41(x.rows)),
  };
}
export function compact421(rows) {
  return rows.map((r) => ({
    month: r.month,
    ...Object.fromEntries(
      ["earth", "moon", "mars"].flatMap((id) => {
        const b = r.planets[id],
          x = r.round421?.[id] ?? {},
          f = b.flow;
        return Object.entries({
          alloyPrice: b.alloyPrice,
          hydrogenPrice: b.hydrogenPrice,
          producedU: f.producedU,
          reductionAlloyU: f.reductionAlloyU ?? 0,
          hydrogenUsedU: f.hydrogenUsedU,
          electrolysisU: f.hydrogenElectrolysisU,
          lifeDemandU: f.lifeWaterDemandU ?? 0,
          lifeWaterU: f.lifeWaterServedU ?? 0,
          waterRecycledU: f.waterRecycledU ?? 0,
          unmetAlloyU: f.unmetAlloyU,
          health: b.meanHealth,
          unserved: f.unservedGWh / Math.max(1, f.demandGWh),
          breakEven: x.breakEvenCPerU ?? 0,
          capacityBreakEven: x.capacityBreakEvenCPerU ?? 0,
          reductionTime:
            f.smelterTime421 > 0 ? f.reductionTime421 / f.smelterTime421 : 0,
          cashBlocked:
            (f.cashPurchaseBlocked421 ?? 0) + (f.cashInvestmentBlocked421 ?? 0),
          governmentC: b.governmentC,
          oreLimited: x.oreLimitedAssets ?? 0,
        }).map(([k, v]) => [id + "_" + k, v]);
      }),
    ),
  }));
}
export function qualify421(records) {
  const failures = {};
  for (const r of records.filter((r) => r.enabled)) {
    for (const [k, ok] of Object.entries(r.checks)) {
      if (ok) continue;
      if (
        k in r.legacyChecks &&
        r.classification === "information" &&
        r.stage === "final"
      )
        continue;
      failures[k] = (failures[k] ?? 0) + 1;
    }
  }
  return { passed: Object.keys(failures).length === 0, failures };
}
export function score421(records) {
  return (
    records.reduce(
      (n, r) =>
        n +
        r.failures.length * 10 +
        Math.max(0, -(r.bodies.earth.margin ?? -1)) * 100,
      0,
    ) / records.length
  );
}

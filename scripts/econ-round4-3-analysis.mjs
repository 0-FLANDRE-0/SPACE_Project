import {
  metrics422,
  compact422,
  compareProduction422,
} from "./econ-round4-2-2-analysis.mjs";
import { financial42 } from "./econ-round4-2-analysis.mjs";
import { hydrogenCost } from "../dist/src/economy-round4-units.js";
import { normalizeRound4Energy } from "../dist/src/economy-round4-model.js";
import { hash43 } from "./econ-round4-3-inputs.mjs";
export { compareProduction422 as compareProduction43 };
const sum = (a) => a.reduce((n, x) => n + x, 0),
  mean = (a) => (a.length ? sum(a) / a.length : null);
export function lifeMetrics43(rows, id, grace = 12) {
  const eligible = rows.filter(
      (r) => r.month > (r.round43?.bodies[id].foundingMonth ?? 0) + grace,
    ),
    ratio = (r, k) => {
      const f = r.planets[id].flow;
      return k === "water"
        ? f.lifeWaterDemandU
          ? f.lifeWaterServedU / f.lifeWaterDemandU
          : null
        : f.oxygenLifeDemandU43
          ? f.oxygenLifeServedU43 / f.oxygenLifeDemandU43
          : null;
    };
  const stats = (k) => {
    const a = eligible.map((r) => ratio(r, k)).filter((x) => x !== null);
    return {
      minimum: a.length ? Math.min(...a) : null,
      below99Months: a.filter((x) => x < 0.99).length,
      eligibleMonths: a.length,
    };
  };
  return { water: stats("water"), oxygen: stats("oxygen") };
}
export function compact43(rows) {
  return compact422(rows).map((old, i) => ({
    old,
    round43: rows[i].round43
      ? {
          ...rows[i].round43,
          fiscal: Object.fromEntries(
            Object.entries(rows[i].round43.fiscal).map(
              ([id, { byTag, ...r }]) => [id, r],
            ),
          ),
          cumulativeFiscal: Object.fromEntries(
            Object.entries(rows[i].round43.cumulativeFiscal).map(
              ([id, { byTag, ...r }]) => [id, r],
            ),
          ),
        }
      : null,
    life: Object.fromEntries(
      Object.entries(rows[i].planets).map(([id, b]) => [
        id,
        {
          water: b.flow.lifeWaterServedU,
          oxygen: b.flow.oxygenLifeServedU43,
          oxygenDemand: b.flow.oxygenLifeDemandU43,
          ice: b.flow.iceProducedU43,
          iceEnergy: b.flow.iceEnergyGWh43,
        },
      ]),
    ),
  }));
}
export function metrics43(x, p, e, profile, policy, hydrogen, config, job) {
  const mapped = job.baseScenario ?? job.scenario,
    view = {
      ...x,
      rows: x.rows.map((r) => ({
        ...r,
        planets: {
          ...r.planets,
          earth: {
            ...r.planets.earth,
            flow: {
              ...r.planets.earth.flow,
              budgetC: r.round43.nationalBudgetC,
            },
          },
        },
      })),
    },
    prior = metrics422(
      view,
      p,
      e,
      profile,
      hydrogen,
      { ...config, criteria422: config.criteria },
      { scenario: mapped, seed: job.seed, lane: job.lane, cut: job.cut },
    ),
    rows = x.rows.slice(1),
    checks = { ...prior.checks },
    last = rows.at(-1),
    bodies = prior.bodies;
  for (const id of ["earth", "moon", "mars"]) {
    const a = rows.map((r) => r.planets[id]),
      flow = (k) => sum(a.map((b) => b.flow[k] ?? 0)),
      life = lifeMetrics43(rows, id, policy.lifeGraceMonths),
      state = x.state.planets[id],
      b = bodies[id];
    const finance = financial42(
      p,
      e,
      { ...profile.parameters, hydrogenPrice: 0.4, oxygenStored: true },
      {
        body: id,
        utilization: b.utilization,
        price: b.price,
        recycleShare: b.electrolysisU ? b.waterRecycledU / b.electrolysisU : 0,
        costShare: hydrogen.waterIntakeCostShare,
      },
    );
    Object.assign(b, finance);
    const annual = Array.from(
        { length: Math.ceil(rows.length / 12) },
        (_, i) => {
          const year = rows.slice(i * 12, i * 12 + 12),
            f = year.map((r) => r.round43.fiscal[id]);
          return {
            year: i + 1,
            taxC: sum(f.map((r) => r.taxQ)) / 1000,
            spendingC: sum(f.map((r) => r.outQ)) / 1000,
            inflowC: sum(f.map((r) => r.inQ)) / 1000,
            netTaxC: sum(f.map((r) => r.taxQ - r.outQ)) / 1000,
            cashNetC: sum(f.map((r) => r.inQ - r.outQ)) / 1000,
          };
        },
      ),
      fiscal = last.round43.cumulativeFiscal[id];
    Object.assign(b, {
      life,
      annualFiscal: annual,
      firstPositiveFiscalYear: annual.find((r) => r.netTaxC > 0)?.year ?? null,
      sustainedPositiveFiscalYear:
        annual.find(
          (r, i) =>
            r.netTaxC > 0 && annual.slice(i).every((a) => a.netTaxC > 0),
        )?.year ?? null,
      taxC: fiscal.taxQ / 1000,
      spendingC: fiscal.outQ / 1000,
      netFiscalC: (fiscal.taxQ - fiscal.outQ) / 1000,
      cashContributionC: (fiscal.inQ - fiscal.outQ) / 1000,
      meanEffectiveTaxRate: mean(rows.map((r) => r.round43.bodies[id].taxRate)),
      waterDemandU: flow("lifeWaterDemandU"),
      waterServedU: flow("lifeWaterServedU"),
      oxygenDemandU: flow("oxygenLifeDemandU43"),
      oxygenServedU: flow("oxygenLifeServedU43"),
      oxygenProducedU: flow("oxygenProducedU43"),
      oxygenStockU: last.round43.bodies[id].oxygenStockU,
      waterStockAllU: last.round43.bodies[id].waterStockU,
      iceProducedU: flow("iceProducedU43"),
      iceEnergyGWh: flow("iceEnergyGWh43"),
      iceInitialU: state.iceInitialQ43 / 1000,
      iceUsedFraction: state.iceInitialQ43
        ? flow("iceProducedU43") / (state.iceInitialQ43 / 1000)
        : null,
      meanWaterPrice: mean(rows.map((r) => r.round43.bodies[id].waterPrice)),
      waterMarketU: flow("waterMarketU43"),
      waterMarketC: flow("waterMarketC43"),
      privateIceModules: sum(
        state.assets
          .filter(
            (a) =>
              a.kind === "iceMine43" &&
              a.owner === "private" &&
              a.state !== "dismantled",
          )
          .map((a) => a.modules),
      ),
      firstWaterBelow99Month:
        rows.find(
          (r) =>
            r.planets[id].flow.lifeWaterDemandU > 0 &&
            r.planets[id].flow.lifeWaterServedU /
              r.planets[id].flow.lifeWaterDemandU <
              0.99,
        )?.month ?? null,
      firstOxygenBelow99Month:
        rows.find(
          (r) =>
            r.planets[id].flow.oxygenLifeDemandU43 > 0 &&
            r.planets[id].flow.oxygenLifeServedU43 /
              r.planets[id].flow.oxygenLifeDemandU43 <
              0.99,
        )?.month ?? null,
    });
    if (policy.iceEnabled && id !== "earth") {
      checks["lifeWater_" + id] =
        life.water.eligibleMonths > 0 && life.water.below99Months === 0;
      checks["lifeOxygen_" + id] =
        life.oxygen.eligibleMonths > 0 && life.oxygen.below99Months === 0;
    }
  }
  checks.nationalCash = x.rows.every((r) => r.treasuryC >= 0);
  if (mapped === "E0") {
    checks.hydrogenMarketMargin =
      bodies.earth.margin !== null && bodies.earth.margin >= 0;
    checks.electrolyzerPayback =
      bodies.earth.paybackYears !== null && bodies.earth.paybackYears <= 4;
    const quote = hydrogenCost(
      p,
      normalizeRound4Energy(e, profile.parameters),
      { ...profile.parameters, oxygenStored: true },
      { marketPrice: 0.4 },
    );
    checks.hydrogenMargin = quote.marginCPerU >= 0;
  }
  const annualNation = Array.from(
    { length: Math.ceil(rows.length / 12) },
    (_, i) => {
      const year = rows.slice(i * 12, i * 12 + 12);
      return {
        year: i + 1,
        budgetC: sum(year.map((r) => r.round43.nationalBudgetC)),
        spendingC:
          sum(
            year.flatMap((r) =>
              Object.values(r.round43.fiscal).map((f) => f.outQ),
            ),
          ) / 1000,
        colonySpendingC:
          sum(
            year.flatMap((r) =>
              ["moon", "mars"].map((id) => r.round43.fiscal[id].outQ),
            ),
          ) / 1000,
        treasuryC: year.at(-1).treasuryC,
      };
    },
  );
  const totalBudgetC = sum(rows.map((r) => r.round43.nationalBudgetC)),
    colonySpendingC = sum(["moon", "mars"].map((id) => bodies[id].spendingC)),
    totalSpendingC = sum(Object.values(bodies).map((b) => b.spendingC));
  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return {
    ...prior,
    scenario: job.scenario,
    baseScenario: mapped,
    checks,
    failures,
    passed: !failures.length,
    bodies,
    national: {
      initialTreasuryC: x.rows[0].treasuryC,
      endingTreasuryC: last.treasuryC,
      minimumTreasuryC: Math.min(...x.rows.map((r) => r.treasuryC)),
      negativeMonths: x.rows.filter((r) => r.treasuryC < 0).length,
      totalBudgetC,
      colonySpendingC,
      totalSpendingC,
      colonyBudgetShare: totalBudgetC ? colonySpendingC / totalBudgetC : null,
      colonyTotalSpendingShare: totalSpendingC
        ? colonySpendingC / totalSpendingC
        : null,
      annual: annualNation,
    },
    pathHash: hash43(compact43(x.rows)),
    classification: job.baseScenario ? "colony-survival" : prior.classification,
  };
}
export function pair43(on, off) {
  on.productionComparison = Object.fromEntries(
    ["earth", "moon", "mars"].map((id) => [
      id,
      compareProduction422(on.productionPathQ[id], off.productionPathQ[id]),
    ]),
  );
  if (["E0", "H-CUT-CONTROL"].includes(on.scenario))
    on.checks.earthNetProduction =
      on.productionComparison.earth.onTotalU >
      on.productionComparison.earth.offTotalU;
  if (on.cut) {
    on.cut.offProducedU = off.cut.producedQ / 1000;
    on.cut.productionRatio =
      off.cut.producedQ > 0 ? on.cut.producedQ / off.cut.producedQ : null;
    on.cut.passesOld95 =
      off.cut.producedQ > 0 &&
      BigInt(on.cut.producedQ) * 100n >= BigInt(off.cut.producedQ) * 95n;
  }
  on.failures = Object.entries(on.checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  on.passed = !on.failures.length;
}
export function qualify43(records) {
  const failures = {};
  for (const r of records.filter((r) => r.enabled))
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
  return { passed: !Object.keys(failures).length, failures };
}
export function series43(rows) {
  return rows.map((r) => ({
    month: r.month,
    nationC: r.treasuryC,
    nationalBudgetC: r.round43.nationalBudgetC,
    colonySpendingC:
      sum(["moon", "mars"].map((id) => r.round43.fiscal[id].outQ)) / 1000,
    ...Object.fromEntries(
      ["earth", "moon", "mars"].flatMap((id) => {
        const b = r.planets[id],
          e = r.round43.bodies[id],
          f = r.round43.fiscal[id];
        return Object.entries({
          producedU: b.flow.producedU,
          hydrogenPrice: b.hydrogenPrice,
          breakEven: r.round422[id].breakEvenCPerU,
          netFiscalC: (f.taxQ - f.outQ) / 1000,
          spendingC: f.outQ / 1000,
          taxRate: e.taxRate,
          waterPrice: e.waterPrice,
          waterDemandU: b.flow.lifeWaterDemandU,
          waterServedU: b.flow.lifeWaterServedU,
          waterFraction: b.flow.lifeWaterDemandU
            ? b.flow.lifeWaterServedU / b.flow.lifeWaterDemandU
            : null,
          oxygenFraction: b.flow.oxygenLifeDemandU43
            ? b.flow.oxygenLifeServedU43 / b.flow.oxygenLifeDemandU43
            : null,
          oxygenProducedU: b.flow.oxygenProducedU43,
          oxygenServedU: b.flow.oxygenLifeServedU43,
          oxygenStockU: e.oxygenStockU,
          iceProducedU: b.flow.iceProducedU43,
          iceUsedFraction: e.iceInitialU
            ? 1 - e.iceRemainingU / e.iceInitialU
            : null,
          waterStockU: e.waterStockU,
        }).map(([k, v]) => [id + "_" + k, v]);
      }),
    ),
  }));
}

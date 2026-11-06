// Offline ECON-SIM-4.2 only. Never imported by game main.js or resource registries.
import { restartCharge, restartProfile } from "./economy-round4-facilities.js";
export const POLICY42 = Object.freeze({
  enabled: true,
  boost: 0.15,
  rampSpeed: 0.2,
  hydrogenPerAlloyU: 1,
  enterMonths: 3,
  exitRatio: 0.5,
  switchDays: 3,
  switchOutput: 0.8,
  switchColdCostRatio: 0.1,
  lifeLitersPerPersonDay: 0.4,
  waterIntakeCostShare: 0.5,
});
const ranges = {
  boost: [0.1, 0.25],
  rampSpeed: [0.1, 0.3],
  hydrogenPerAlloyU: [0.9, 1.1],
  enterMonths: [1, 6],
  exitRatio: [0.3, 0.8],
  switchDays: [1, 10],
  switchOutput: [0.5, 0.9],
  switchColdCostRatio: [0.05, 0.3],
  lifeLitersPerPersonDay: [0.1, 1],
  waterIntakeCostShare: [0, 1],
};
export function validate42(input = {}) {
  const p = { ...POLICY42, ...input };
  if (typeof p.enabled !== "boolean") throw Error("42 enabled must be boolean");
  for (const [k, [lo, hi]] of Object.entries(ranges))
    if (!Number.isFinite(p[k]) || p[k] < lo || p[k] > hi)
      throw Error("42 range " + k);
  return Object.freeze(p);
}
export function switchCost42(a, r, p) {
  const smeltC = Math.max(0, a.creditBasisC - (a.mineCreditC ?? 0));
  return smeltC * r.smeltRestartFraction * p.switchColdCostRatio;
}
export function breakEven42(p, alloyPrice, amortizedPerBaseAlloyC = 0) {
  return Math.max(
    0,
    (p.boost * alloyPrice - amortizedPerBaseAlloyC) /
      ((1 + p.boost) * p.hydrogenPerAlloyU),
  );
}
export function mode42(
  a,
  { month, availableU, requiredU, baseAlloyU, alloyPrice, hydrogenPrice },
  p,
  r,
) {
  const previous =
      a.smeltMode === "switching"
        ? a.smeltTarget
        : (a.smeltMode ?? "conventional"),
    cold = switchCost42(a, r, p),
    amortized = baseAlloyU > 0 ? cold / (12 * baseAlloyU) : Infinity;
  const profitable =
    p.boost * alloyPrice >
    (1 + p.boost) * p.hydrogenPerAlloyU * hydrogenPrice + amortized;
  let target = previous;
  if (requiredU > 0) {
    if (
      previous === "conventional" &&
      availableU >= requiredU * p.enterMonths &&
      profitable
    )
      target = "hydrogenReduction";
    else if (
      previous === "hydrogenReduction" &&
      availableU < requiredU * p.enterMonths * p.exitRatio
    )
      target = "conventional";
  }
  const changed = target !== previous;
  return {
    previous,
    target,
    changed,
    costC: changed ? cold : 0,
    profitable,
    coverMonths: requiredU ? availableU / requiredU : null,
    month,
  };
}
export function process42(a, p) {
  const target =
      a.smeltMode === "switching"
        ? a.smeltTarget
        : (a.smeltMode ?? "conventional"),
    reduction = target === "hydrogenReduction",
    switchFactor =
      a.smeltMode === "switching"
        ? 1 - (p.switchDays / 30) * (1 - p.switchOutput)
        : 1;
  return {
    reduction,
    switchFactor,
    capacityFactor: (reduction ? 1 + p.boost : 1) * switchFactor,
  };
}
export function restart42(a, r, m, p) {
  return restartProfile(
    a,
    process42(a, p).reduction
      ? { ...r, smeltRecoveryMonths: r.smeltRecoveryMonths * (1 - p.rampSpeed) }
      : r,
    m,
  );
}
export function lifeWater42(body, population, p) {
  return body === "earth"
    ? 0
    : (population * p.lifeLitersPerPersonDay * 30) / 4500;
}
// 5 H quanta use2 residue quanta (4kg oxygen per .001U H). Exact mass at .001U.
export function reductionHydrogenQ42(alloyQ, p) {
  return 5 * Math.ceil((alloyQ * p.hydrogenPerAlloyU) / 5);
}
export function reductionMass42(hQ) {
  if (!Number.isSafeInteger(hQ) || hQ < 0 || hQ % 5)
    throw Error("Reduction H quantum");
  return { hydrogenQ: hQ, waterQ: hQ, residueOxygenQ: (hQ * 2) / 5 };
}
export function rollingSwitches42(events, month) {
  return events.filter((e) => e.month > month - 12 && e.month <= month).length;
}
export function assert42Policy() {
  for (const p of Object.values(POLICY42))
    if (typeof p === "number" && !Number.isFinite(p))
      throw Error("42 defaults");
  return true;
}
export function validateCut42(c) {
  if (c === null || c === undefined) return null;
  const out = { enabled: true, baseScenario: "E0", ...c };
  if (
    !["earth", "moon", "mars"].includes(out.body) ||
    out.startMonth !== 60 ||
    !Number.isInteger(out.durationMonths) ||
    out.durationMonths < 6 ||
    out.durationMonths > 12 ||
    !Number.isFinite(out.inventoryLossFraction) ||
    !(
      out.inventoryLossFraction === 0 ||
      (out.inventoryLossFraction >= 0.5 && out.inventoryLossFraction <= 1)
    ) ||
    typeof out.fundedColonyFixture !== "boolean" ||
    typeof out.enabled !== "boolean" ||
    out.baseScenario !== "E0"
  )
    throw Error("42 cut protocol");
  return Object.freeze(out);
}

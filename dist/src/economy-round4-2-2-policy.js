// Offline ECON-SIM-4.2.2. New search values are provisional; fixed values follow the request.
import { assistedSmelting } from "./economy-energy-facilities.js";
import { restartProfile } from "./economy-round4-facilities.js";
export {
  validateCut42 as validateCut422,
  lifeWater42 as lifeWater422,
  reductionHydrogenQ42 as reductionHydrogenQ422,
  reductionMass42 as reductionMass422,
} from "./economy-round4-2-policy.js";
export const POLICY422 = Object.freeze({
  enabled: true,
  yieldBonus: 0.15,
  waterGateFraction: 0.75,
  waterGateMonths: 6,
  hydrogenPerAlloyU: 1.06,
  cashReserveMonths: 3,
  rampSpeed: 0.13,
  lifeLitersPerPersonDay: 0.5,
  waterIntakeCostShare: 0.5,
});
export function validate422(input = {}) {
  const p = { ...POLICY422, ...input };
  for (const key of Object.keys(input))
    if (!(key in POLICY422)) throw Error("422 unknown/removed policy " + key);
  if (typeof p.enabled !== "boolean") throw Error("422 enabled");
  for (const [key, lo, hi] of [
    ["yieldBonus", 0.05, 0.25],
    ["waterGateFraction", 0.5, 1],
    ["waterGateMonths", 3, 12],
    ["hydrogenPerAlloyU", 0.95, 1.1],
    ["cashReserveMonths", 1, 6],
  ])
    if (!Number.isFinite(p[key]) || p[key] < lo || p[key] > hi)
      throw Error("422 range " + key);
  for (const key of [
    "rampSpeed",
    "lifeLitersPerPersonDay",
    "waterIntakeCostShare",
  ])
    if (p[key] !== POLICY422[key]) throw Error("422 fixed " + key);
  if (!Number.isInteger(p.waterGateMonths))
    throw Error("422 integer gate months");
  return Object.freeze(p);
}
export const restart422 = (a, r, m, p) =>
  restartProfile(
    a,
    { ...r, smeltRecoveryMonths: r.smeltRecoveryMonths * (1 - p.rampSpeed) },
    m,
  );
const clamp = (x) => Math.max(0, Math.min(1, x));
// Compare full-month alternatives at the same ore/health/ramp. Mining and fixed power cancel.
export function marginal422(
  {
    baseProcessU,
    fastProcessU,
    rawWorkU,
    maxHydrogenU,
    oreU,
    yieldFraction,
    assistedBoost,
    alloyPrice,
    hydrogenPrice,
    processGWhPerU,
    powerPrice,
    baseOperatingC,
  },
  p,
) {
  const conventional = assistedSmelting({
    oreU,
    baseProcessU,
    rawWorkU,
    maxHydrogenU,
    availableHydrogenU: Infinity,
    boost: assistedBoost,
    enabled: true,
  });
  const capacity = fastProcessU * (1 + assistedBoost),
    processU = Math.min(oreU, capacity),
    alloyU = processU * yieldFraction * (1 + p.yieldBonus),
    hydrogenU =
      (5 * Math.ceil((Math.floor(alloyU * 1000) * p.hydrogenPerAlloyU) / 5)) /
      1000;
  const deltaProcessU = processU - conventional.processU,
    deltaAlloyU = alloyU - conventional.processU * yieldFraction,
    deltaHydrogenU = hydrogenU - conventional.hydrogenU;
  const capacityRatio =
    baseProcessU > 0 ? capacity / (baseProcessU * (1 + assistedBoost)) : 1;
  const extraOperatingC =
    Math.max(0, deltaProcessU) * processGWhPerU * powerPrice +
    Math.max(0, capacityRatio - 1) *
      (capacity > 0 ? processU / capacity : 0) *
      baseOperatingC;
  const numerator = deltaAlloyU * alloyPrice - extraOperatingC,
    breakEvenC =
      deltaHydrogenU > 0 ? Math.max(0, numerator / deltaHydrogenU) : null;
  return {
    conventional,
    capacity,
    processU,
    alloyU,
    hydrogenU,
    deltaAlloyU,
    deltaHydrogenU,
    extraOperatingC,
    capacityRatio,
    breakEvenC,
    profitable: deltaAlloyU > 0 && numerator > deltaHydrogenU * hydrogenPrice,
  };
}
// Reserve the remaining time's conventional assist before allocating the incremental H.
// This avoids wasting scarce H on reduction while starving a more H-efficient baseline recipe.
export function splitWork422(args, p) {
  const m = marginal422(args, p),
    H = Math.max(0, args.availableHydrogenU),
    hc = m.conventional.hydrogenU,
    hh = m.hydrogenU;
  let time =
    m.profitable && m.capacity > 0 && H >= hc
      ? clamp((H - hc) / Math.max(1e-12, hh - hc))
      : 0;
  let alloyQ = Math.floor(
      m.processU * args.yieldFraction * (1 + p.yieldBonus) * 1000 * time,
    ),
    hrProcess = alloyQ / 1000 / (args.yieldFraction * (1 + p.yieldBonus)),
    hrH = (5 * Math.ceil((alloyQ * p.hydrogenPerAlloyU) / 5)) / 1000;
  time = m.capacity > 0 ? hrProcess / m.capacity : 0;
  // Ceil to exact 0.005U reaction batches without stealing conventional assist quanta.
  while (alloyQ > 0 && hrH + hc * (1 - time) > H + 1e-10) {
    alloyQ = Math.max(0, alloyQ - 5);
    hrProcess = alloyQ / 1000 / (args.yieldFraction * (1 + p.yieldBonus));
    time = m.capacity > 0 ? hrProcess / m.capacity : 0;
    hrH = (5 * Math.ceil((alloyQ * p.hydrogenPerAlloyU) / 5)) / 1000;
  }
  const rest = 1 - time,
    base = args.baseProcessU * rest,
    ore = Math.max(0, args.oreU - hrProcess),
    boostUseful =
      ore > base &&
      base * args.assistedBoost * args.yieldFraction * args.alloyPrice >
        args.maxHydrogenU * rest * args.hydrogenPrice;
  const backup = assistedSmelting({
    oreU: ore,
    baseProcessU: base,
    rawWorkU: args.rawWorkU * rest,
    maxHydrogenU: args.maxHydrogenU * rest,
    availableHydrogenU: Math.max(0, H - hrH),
    boost: args.assistedBoost,
    enabled: boostUseful,
  });
  return {
    processU: hrProcess + backup.processU,
    reductionProcessU: hrProcess,
    yieldBonusAlloyU: hrProcess * args.yieldFraction * p.yieldBonus,
    conventionalHydrogenU: backup.hydrogenU,
    hydrogenU: hrH + backup.hydrogenU,
    desiredHydrogenU: m.profitable
      ? m.hydrogenU
      : m.conventional.desiredHydrogenU,
    reductionTime: time,
    capacityRatio: 1 + time * Math.max(0, m.capacityRatio - 1),
    marginal: m,
  };
}
export function safeSpend422(cashC, monthlyOperatingC, months, requestedC) {
  if (
    ![cashC, monthlyOperatingC, months, requestedC].every(Number.isFinite) ||
    Math.min(cashC, monthlyOperatingC, requestedC) < 0 ||
    months < 1 ||
    months > 6
  )
    throw Error("422 cash quote");
  const floorQ = Math.ceil(monthlyOperatingC * months * 1000),
    cashQ = Math.floor(cashC * 1000 + 1e-7),
    budgetQ = Math.max(0, cashQ - floorQ),
    requestedQ = Math.ceil(requestedC * 1000);
  return {
    floorC: floorQ / 1000,
    spendC: Math.min(budgetQ, requestedQ) / 1000,
    allowed: budgetQ >= requestedQ,
    blocked: budgetQ < requestedQ,
  };
}

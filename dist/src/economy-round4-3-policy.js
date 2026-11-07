// Offline ECON-SIM-4.3: accepted4.2.2 values are immutable; ice costs are provisional.
import { FACILITY_TYPES, MINING } from "./industry-policy.js";
import { validate422 } from "./economy-round4-2-2-policy.js";
export const FIXED42243 = Object.freeze({
  enabled: true,
  yieldBonus: 0.09,
  hydrogenPerAlloyU: 0.96,
  cashReserveMonths: 6,
  waterGateFraction: 0.72,
  waterGateMonths: 12,
  rampSpeed: 0.13,
  lifeLitersPerPersonDay: 0.5,
  waterIntakeCostShare: 0.5,
});
export function hydrogenPolicy43(input = {}) {
  for (const [k, v] of Object.entries(input))
    if (!(k in FIXED42243) || (k !== "enabled" && v !== FIXED42243[k]))
      throw Error("43 fixed4.2.2 " + k);
  return validate422({ ...FIXED42243, ...input });
}
export const POLICY43 = Object.freeze({
  enabled: true,
  iceEnabled: true,
  iceOutputU: 1000,
  iceCapitalScale: 0.6,
  iceMaintenanceScale: 0.6,
  iceGWhPerU: 0.004,
  iceBuildMonths: 6,
  holidayYears: 5,
  oxygenRecycle: 0.5,
  lifeGraceMonths: 12,
});
export const ICE_RESERVES43 = Object.freeze({ moon: 1000000, mars: 10000000 });
export function validate43(input = {}) {
  const p = { ...POLICY43, ...input };
  for (const k of Object.keys(input))
    if (!(k in POLICY43)) throw Error("43 unknown policy " + k);
  for (const k of ["enabled", "iceEnabled"])
    if (typeof p[k] !== "boolean") throw Error("43 boolean " + k);
  for (const [k, lo, hi] of [
    ["iceOutputU", 200, 2000],
    ["iceCapitalScale", 0.3, 1],
    ["iceMaintenanceScale", 0.3, 1],
    ["iceGWhPerU", 0.001, 0.01],
    ["iceBuildMonths", 3, 12],
  ])
    if (!Number.isFinite(p[k]) || p[k] < lo || p[k] > hi)
      throw Error("43 range " + k);
  if (
    !Number.isInteger(p.iceBuildMonths) ||
    ![0, 5, 10].includes(p.holidayYears)
  )
    throw Error("43 integer months/holiday");
  if (p.oxygenRecycle !== 0.5 || p.lifeGraceMonths !== 12)
    throw Error("43 fixed life parameters");
  return Object.freeze(p);
}
export function effectiveTax43({
  body,
  month,
  foundingMonth = 0,
  nationalRate,
  sectorId = null,
  sectorRates = {},
  planetRates = {},
  holidayYears = 5,
}) {
  const valid = (x) => Number.isFinite(x) && x >= 0 && x <= 1;
  if (
    !valid(nationalRate) ||
    ![0, 5, 10].includes(holidayYears) ||
    !Number.isInteger(month) ||
    !Number.isInteger(foundingMonth) ||
    month < foundingMonth
  )
    throw Error("43 tax input");
  const planet = planetRates[body],
    sector = sectorRates[sectorId],
    rate = planet ?? sector ?? nationalRate;
  if (!valid(rate)) throw Error("43 invalid override rate");
  return body !== "earth" && month - foundingMonth < holidayYears * 12
    ? 0
    : rate;
}
export function lifeNeed43(body, population, oxygenRecycle = 0.5) {
  if (
    !(population >= 0 && Number.isFinite(population)) ||
    !(oxygenRecycle >= 0 && oxygenRecycle <= 1)
  )
    throw Error("43 life input");
  return body === "earth"
    ? { waterQ: 0, oxygenQ: 0 }
    : {
        waterQ: Math.ceil(((population * 0.5 * 30) / 4500) * 1000),
        oxygenQ: Math.ceil(
          ((population * 0.84 * (1 - oxygenRecycle) * 30) / 4000) * 1000,
        ),
      };
}
export function iceQuote43(policy) {
  const m = FACILITY_TYPES[MINING];
  return {
    creditC: m.creditC * policy.iceCapitalScale,
    alloyU: m.alloyU * policy.iceCapitalScale,
    hydrogenU: 0,
    maintenanceCreditBasisC: m.creditC * policy.iceMaintenanceScale,
    maintenanceAlloyBasisU: m.alloyU * policy.iceMaintenanceScale,
  };
}

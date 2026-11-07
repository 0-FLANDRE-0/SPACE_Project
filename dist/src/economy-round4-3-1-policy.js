// Offline follow-up. No search axes: adopted 4.3 rounded values stay fixed.
import { validate43, lifeNeed43 } from "./economy-round4-3-policy.js";
export const FIXED43_431 = Object.freeze(
  validate43({
    iceOutputU: 750,
    iceCapitalScale: 0.79,
    iceMaintenanceScale: 0.66,
    iceGWhPerU: 0.0018,
    iceBuildMonths: 6,
    holidayYears: 5,
  }),
);
export const LIFE431 = Object.freeze({
  reserveMonths: 6,
  oxygenCapacityMargin: 1.2,
  colonyTaxFactor: 0.5,
  tankCapitalFraction: 0.1,
  tankBuildMonths: 1,
});
export function validate431(input = {}) {
  for (const [k, v] of Object.entries(input))
    if (!(k in LIFE431) || v !== LIFE431[k])
      throw Error("431 fixed policy " + k);
  return LIFE431;
}
export function fixed43_431(input = {}) {
  for (const [k, v] of Object.entries(input))
    if (!(k in FIXED43_431) || v !== FIXED43_431[k])
      throw Error("431 frozen4.3 " + k);
  return FIXED43_431;
}
export function tax431({
  body,
  month,
  foundingMonth = 0,
  nationalRate = 0.25,
  sectorId = null,
  sectorRates = {},
  planetRates = {},
  holidayYears = 5,
  colonyFactor = 0.5,
  terraformed = false,
}) {
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(foundingMonth) ||
    month < foundingMonth ||
    holidayYears !== 5 ||
    ![0, 0.5, 1].includes(colonyFactor) ||
    typeof terraformed !== "boolean"
  )
    throw Error("431 tax input");
  for (const r of [nationalRate, sectorRates[sectorId], planetRates[body]])
    if (r != null && (!Number.isFinite(r) || r < 0 || r > 1))
      throw Error("431 tax rate");
  if (nationalRate == null) throw Error("431 national rate");
  if (body !== "earth" && month - foundingMonth < 60) return 0;
  return (
    planetRates[body] ??
    sectorRates[sectorId] ??
    nationalRate * (body === "earth" || terraformed ? 1 : colonyFactor)
  );
}
export function reserveTarget431(body, population) {
  const n = lifeNeed43(body, population, 0.5);
  return { waterQ: n.waterQ * 6, oxygenQ: n.oxygenQ * 6 };
}
export function oxygenQuote431(e, capacityQ) {
  if (!Number.isSafeInteger(capacityQ) || capacityQ <= 0)
    throw Error("431 oxygen capacity");
  const ratio = capacityQ / 1000 / e.hydrogenModuleU;
  return {
    creditC: e.hydrogenModuleC * ratio,
    alloyU: Math.ceil(e.hydrogenModuleAlloyU * ratio * 1000) / 1000,
  };
}
export function tankQuote431(e, waterQ, oxygenQ) {
  if (![waterQ, oxygenQ].every((x) => Number.isSafeInteger(x) && x >= 0))
    throw Error("431 tank capacity");
  // Same 4 SCU/U envelope; no transported SCU shell, positive provisional local capex.
  const ratio =
    ((waterQ + oxygenQ) / 1000 / e.waterTankU) * LIFE431.tankCapitalFraction;
  return {
    creditC: e.hydrogenModuleC * ratio,
    alloyU: Math.ceil(e.hydrogenModuleAlloyU * ratio * 1000) / 1000,
  };
}
export function lifeRequired431(scenario) {
  return (
    ["E0", "E2-S", "E5-M"].includes(scenario) ||
    scenario.startsWith("E5-M-L") ||
    scenario.startsWith("H-CUT-")
  );
}

import { simulateRound422Economy as simulate422 } from "./economy-round4-2-2-model.js";
import { NationalLedger43, NATIONAL_C43 } from "./economy-round4-3-ledger.js";
import {
  validate43,
  hydrogenPolicy43,
  lifeNeed43,
  iceQuote43,
  ICE_RESERVES43,
  effectiveTax43,
} from "./economy-round4-3-policy.js";
import { forecastWater43 } from "./economy-round4-3-water.js";
// Static offline4.3 settlement adapter; adds national cash and colony life/ice only. R4.1 has no settlement hooks; its private
// functions are copied once during development, never rewritten/evaluated at runtime.
// National structure stays active for H-OFF. Whole43-OFF comparison delegates immutable4.2.2.
import {
  createRound41Economy as create41,
  simulateRound41Economy as simulate41,
  tickRound41Economy as tick41,
  round41Snapshot as snapshot41,
  assertRound41Economy as assert41,
} from "./economy-round4-1-model.js";
import { forecastWater422 } from "./economy-round4-2-2-water.js";
import {
  validate422,
  validateCut422,
  restart422,
  lifeWater422,
  reductionHydrogenQ422,
  reductionMass422,
  marginal422,
  splitWork422,
  safeSpend422,
} from "./economy-round4-2-2-policy.js";
import {
  createRound4Economy,
  simulateRound4Economy,
  tickRound4Economy,
  round4Snapshot,
  assertRound4Economy,
  ROUND4_SCENARIOS,
  normalizeRound4Energy,
} from "./economy-round4-model.js";
import {
  GRID41,
  validatePolicy41,
  stressDefinition41,
  mediumStress41,
  shockActive41,
  maintenanceBill41 as oldMaintenanceBill41,
  maintenanceNeed41 as oldMaintenanceNeed41,
  updateShortage41,
  priority41 as oldPriority41,
  damageMaintenance41,
  repairMaintenance41,
  emergencyMarket41 as oldEmergencyMarket41,
  protectedExportQ41 as oldProtectedExportQ41,
  assertPolicy41,
} from "./economy-round4-1-policy.js";
import { simulateEnergyEconomy as simulateRound3 } from "./economy-energy-model.js";
import {
  packagingCost,
  transferRound4,
  hydrogenCost as oldHydrogenCost,
  unitConversion,
  ROUND4_RESOURCES,
} from "./economy-round4-units.js";
import {
  powerScale,
  upgradeScale,
  advanceSizedFusionStart,
  round4Bill as oldRound4Bill,
  upkeepPriority,
  restartProfile,
  restartCharge as oldRestartCharge,
  privateAction,
  dismantleQuote,
  R4_SCENARIO_BASE,
} from "./economy-round4-facilities.js";
import {
  simulateEconomy,
  industryExpectation,
  ECON_ROUND2_SCENARIOS,
  ECON_SHIPS,
} from "./economy-model.js";
import { resourceRandom } from "./ore-quality.js";
import { FACILITY_TYPES, MINING, SMELTING } from "./industry-policy.js";
import {
  Ledger,
  account,
  quantize as q,
  trade,
  energyAudit,
} from "./economy-energy-ledger.js";
import {
  POWER_TYPES,
  FUSION,
  industryCapacity as rawIndustryCapacity,
  alloyElectricityMWhPerT,
  advanceFusionStart,
  dispatchFusion,
  constructionQuote,
  upkeepBill,
  balanceStorage,
  assistedSmelting,
  explicitIndustryUnitCost,
} from "./economy-energy-facilities.js";
const ROUND41_SCENARIOS = Object.freeze([
  ...ROUND4_SCENARIOS,
  "E5-M",
  "E11-M",
  ...GRID41.map((x) => x.id),
]);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  sum = (a) => a.reduce((s, x) => s + x, 0),
  mean = (a) => sum(a) / Math.max(1, a.length);
const initialEnergyStats = () => ({
  generationGWh: 0,
  demandGWh: 0,
  servedGWh: 0,
  unservedGWh: 0,
  startInputGWh: 0,
  startGenerationGWh: 0,
  industryDemandGWh: 0,
  industryServedGWh: 0,
  electrolysisGWh: 0,
  storageChargeGWh: 0,
  storageDischargeGWh: 0,
  storageLossGWh: 0,
  curtailedGWh: 0,
  governmentExternalSalesC: 0,
  governmentSelfSalesC: 0,
});
const normal = (seed, m) => {
  const u = Math.max(1e-12, resourceRandom(seed, m, "energy-growth-u")),
    v = resourceRandom(seed, m, "energy-growth-v");
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
function pay(s, planet, from, to, c, tag) {
  const a = account(planet, from),
    b = account(planet, to),
    n = Math.min(s.book.get(a), q(Math.max(0, c)));
  if (n && a !== b) s.book.move(a, b, n, tag);
  return n / 1000;
}
function consume(s, planet, owner, resource, u, tag) {
  const a = account(planet, owner, resource),
    n = Math.min(s.book.get(a), Math.max(0, q(u)));
  if (n) {
    s.book.sink(a, n, tag);
    if (
      resource === "hydrogen" &&
      s.r422?.enabled &&
      s.planets[planet]?.observed422
    ) {
      const o = s.planets[planet].observed422[owner];
      if (!["hydrogen-boiloff", "cut-hydrogen-loss"].includes(tag))
        o.baseHydrogenQ += n;
    }
    if (resource === "hydrogen")
      takeOwn422(
        s,
        planet,
        owner,
        n,
        ["hydrogen-boiloff", "cut-hydrogen-loss"].includes(tag)
          ? "lostOwnQ"
          : "usedOwnQ",
      );
  }
  return n / 1000;
}
function stock(s, planet, owner, resource) {
  return s.book.get(account(planet, owner, resource)) / 1000;
}
function purchase(s, b, owner, resource, u) {
  const seller = owner === "government" ? "private" : "government";
  const reserve =
    owner === "private"
      ? resource === "alloy"
        ? 12 *
          sum(
            b.assets
              .filter(
                (a) => a.owner === "government" && a.completedMonth <= s.month,
              )
              .map((a) => round4Bill(a, s.e, s.r, b.id, s.month).alloyU),
          )
        : Math.max(10, b.hydrogenGovernmentReservationU ?? 0)
      : 0;
  const h422 = s.r422?.enabled && resource === "hydrogen",
    ownReserve =
      h422 && seller === "private"
        ? Math.max(b.h422Required?.private ?? 0, b.h422Potential?.private ?? 0)
        : 0;
  const available =
    h422 && seller === "government"
      ? 0
      : Math.max(
          0,
          stock(s, b.id, seller, resource) - Math.max(reserve, ownReserve),
        );
  const r = trade(s.book, {
    planet: b.id,
    from: seller,
    to: owner,
    resource,
    amountU: Math.min(available, Math.max(0, u)),
    priceC:
      (resource === "alloy" ? b.alloyPrice : b.hydrogenPrice) * s.priceIndex,
    tag: resource + "-purchase",
  });
  if (h422 && r.amountU) {
    takeOwn422(s, b.id, seller, q(r.amountU), "soldOwnQ");
    b.flow.hydrogenMarketSoldU += r.amountU;
    b.flow.hydrogenMarketSalesC += r.cashC;
  }
  b.flow.purchasesC += r.cashC;
  return r;
}
function ensureStock(s, b, owner, resource, u) {
  const need = Math.max(0, u - stock(s, b.id, owner, resource));
  if (need) purchase(s, b, owner, resource, need);
  return stock(s, b.id, owner, resource) >= u - 1e-6;
}
function addAsset(b, asset) {
  const a = {
    id: b.id + "-" + b.serial++,
    lossMonths: 0,
    pausedMonths: 0,
    state: "active",
    health: 1,
    backlogU: 0,
    completedMonth: 0,
    creditBasisC: 0,
    alloyBasisU: 0,
    ...asset,
  };
  a.alloyBasisU = q(a.alloyBasisU) / 1000;
  b.assets.push(a);
  return a;
}
function industryAsset(
  b,
  owner,
  sets,
  completedMonth,
  e,
  { mineRatio = e.mineRatio } = {},
) {
  const mine = FACILITY_TYPES[MINING],
    smelt = FACILITY_TYPES[SMELTING],
    scale = owner === "private" ? e.privateScale : 1;
  return addAsset(b, {
    kind: "industry",
    owner,
    sets,
    mineRatio,
    completedMonth,
    smeltCompletedMonth:
      completedMonth < 0
        ? completedMonth
        : completedMonth + smelt.months - mine.months,
    mineCreditC: mine.creditC * mineRatio * sets * scale,
    mineAlloyU: mine.alloyU * mineRatio * sets * scale,
    creditBasisC: (mine.creditC * mineRatio + smelt.creditC) * sets * scale,
    alloyBasisU: (mine.alloyU * mineRatio + smelt.alloyU) * sets * scale,
    state: completedMonth > 0 ? "construction" : "active",
    hydrogenU: smelt.hydrogenU * sets,
    tag: "mine+smelter",
  });
}
function baseFlow() {
  return {
    producedU: 0,
    privateProducedU: 0,
    governmentProducedU: 0,
    minedU: 0,
    processedU: 0,
    residueU: 0,
    hydrogenProducedU: 0,
    hydrogenUsedU: 0,
    hydrogenUnmetU: 0,
    hydrogenByproductU: 0,
    hydrogenElectrolysisU: 0,
    upkeepRequiredU: 0,
    upkeepPaidU: 0,
    repairU: 0,
    repairC: 0,
    directC: 0,
    purchasesC: 0,
    constructionC: 0,
    constructionAlloyU: 0,
    constructionHydrogenU: 0,
    startC: 0,
    startHydrogenU: 0,
    normalHydrogenU: 0,
    generalAlloyDemandU: 0,
    generalAlloyConsumedU: 0,
    unmetAlloyU: 0,
    governmentSoldU: 0,
    governmentSaleC: 0,
    powerSalesC: 0,
    powerFuelC: 0,
    powerUnpaidC: 0,
    warAlloyU: 0,
    powerDirectC: 0,
    powerUpkeepU: 0,
    governmentPowerDirectC: 0,
    governmentPowerUpkeepU: 0,
    governmentIndustryDirectC: 0,
    governmentIndustryUpkeepU: 0,
    governmentPowerPurchaseC: 0,
    hydrogenDirectC: 0,
    hydrogenUpkeepU: 0,
    hydrogenConstructionC: 0,
    privateExpansionSets: 0,
    governmentPowerGWh: 0,
    packagingGWh: 0,
    packagingGovernmentGWh: 0,
    packagingC: 0,
    shippingAlloyU: 0,
    shippingHydrogenU: 0,
    restartC: 0,
    restartHeaterGWh: 0,
    dismantleC: 0,
    salvageU: 0,
    liquefactionGWh: 0,
    oxygenLiquefactionGWh: 0,
    hydrogenStorageGWh: 0,
    boiloffU: 0,
    pausedFacilities: 0,
    dismantledFacilities: 0,
    healthMin: 1,
    loanC: 0,
    budgetC: 0,
    mandatoryC: 0,
    shipOrders: 0,
    maintenanceByKind: {},
    ...flow422(),
    ...flow43(),
    ...initialEnergyStats(),
  };
}
// PR15's immutable constructor supplies original capital, inventories and units.
export function createRound43Economy(p, e, inputs, options = {}) {
  if (options.round43?.enabled === false)
    throw Error(
      "43 constructor requires enabled; use simulator for legacy control",
    );
  const cut = validateCut422(options.cut),
    requested = options.scenario ?? "E0",
    base = cut
      ? (options.cut.baseScenario ?? "E0")
      : (options.baseScenario43 ?? requested);
  const s = create41(p, e, inputs, { ...options, scenario: base });
  s.r422 = hydrogenPolicy43(options.round422);
  s.r43 = validate43(options.round43);
  s.book = new NationalLedger43(s.book);
  s.initialTreasuryQ43 = s.book.get(NATIONAL_C43);
  s.initialWaterQ43 = s.book.sum((k) => k.endsWith("/water"));
  s.initialOxygenQ43 = s.book.sum((k) => k.endsWith("/oxygen"));
  s.tax43 = structuredClone(
    options.tax43 ?? {
      nationalRate: s.p.bodies.moon.taxRate,
      sectorRates: {},
      planetRates: { earth: s.p.earthTaxRate },
      sectors: { earth: "earth", moon: "moon", mars: "mars" },
    },
  );
  s.round422Off = !s.r422.enabled;
  s.scenario422 = requested;
  s.cut422 = cut ? structuredClone(cut) : null;
  s.events422 = [];
  s.capture422 = options.capture422 ?? false;
  for (const b of Object.values(s.planets)) {
    b.foundingMonth43 = 0;
    b.waterPrice43 = 0.2;
    b.iceInitialQ43 = q(ICE_RESERVES43[b.id] ?? 0);
    if (b.id !== "earth")
      s.book.open(account(b.id, "ground", "ice43"), b.iceInitialQ43);
    b.life43 = { waterUnmetMonths: 0, oxygenUnmetMonths: 0 };
    b.h422 = {
      government: {
        ownQ: 0,
        producedQ: 0,
        usedOwnQ: 0,
        soldOwnQ: 0,
        lostOwnQ: 0,
        exportedOwnQ: 0,
        waterQ: 0,
      },
      private: {
        ownQ: 0,
        producedQ: 0,
        usedOwnQ: 0,
        soldOwnQ: 0,
        lostOwnQ: 0,
        exportedOwnQ: 0,
        waterQ: 0,
      },
    };
    b.flow = baseFlow();
    b.total = baseFlow();
    b.cutPrepared422 = false;
    b.history422 = { government: [], private: [] };
    b.observed422 = {
      government: { waterQ: 0, baseHydrogenQ: 0, byproductHQ: 0 },
      private: { waterQ: 0, baseHydrogenQ: 0, byproductHQ: 0 },
    };
    b.productionMonth422 = -1;
    b.waterProposals422 = [];
    b.pendingWater422 = { government: null, private: null };
    b.guards422 = {
      government: {
        purchaseBlockedMonth: -1,
        investmentBlockedMonth: -1,
        purchases: 0,
        investments: 0,
        minimumPostFloorC: null,
      },
      private: {
        purchaseBlockedMonth: -1,
        investmentBlockedMonth: -1,
        purchases: 0,
        investments: 0,
        minimumPostFloorC: null,
      },
    };
  }
  return s;
}

function transportGrant(s, to, c, alloyU, hydrogenU) {
  const amt = 0; // Country cash is already accessible; goods still require paid SCU.
  scheduleShipment(s, to, "alloy", alloyU);
  scheduleShipment(s, to, "hydrogen", hydrogenU);
  s.events.push({
    month: s.month,
    event: "shipment-requested",
    to,
    alloyU,
    hydrogenU,
    creditC: amt,
  });
}
function borrow(s, b, amount) {
  const n = Math.min(
    q(Math.max(0, amount)),
    s.book.get(account(b.id, "household")),
  );
  if (n) {
    s.book.move(
      account(b.id, "household"),
      account(b.id, "government"),
      n,
      "bond-subscription",
    );
    s.debtC += n / 1000;
    b.flow.loanC += n / 1000;
  }
  return n / 1000;
}
function issue(s, planet, owner, c, tag) {
  if (c <= 0) return;
  s.book.source(account(planet, owner), q(c), tag);
  s.issuedC += q(c) / 1000;
}
function constructionPurchase(
  s,
  b,
  owner,
  { creditC, alloyU, hydrogenU = 0 },
  tag,
) {
  // No partial material payment or free foundation: all three budgets must be
  // present before the atomic order. Government may buy local private stock.
  creditC *= s.priceIndex;
  const extraAlloy = Math.max(0, alloyU - stock(s, b.id, owner, "alloy")),
    extraH = Math.max(0, hydrogenU - stock(s, b.id, owner, "hydrogen"));
  const totalC =
    creditC +
    (extraAlloy * b.alloyPrice + extraH * b.hydrogenPrice) * s.priceIndex;
  if (
    stock(s, b.id, owner, "C") < totalC ||
    stock(s, b.id, owner, "alloy") +
      (owner === "government" ? stock(s, b.id, "private", "alloy") : 0) <
      alloyU ||
    stock(s, b.id, owner, "hydrogen") +
      (owner === "government" ? stock(s, b.id, "private", "hydrogen") : 0) <
      hydrogenU
  )
    return false;
  ensureStock(s, b, owner, "alloy", alloyU);
  ensureStock(s, b, owner, "hydrogen", hydrogenU);
  pay(s, b.id, owner, "household", creditC, "construction:" + tag);
  s.book.move(
    account(b.id, owner, "alloy"),
    account(b.id, owner, tag === "ship" ? "shipAlloy" : "capitalAlloy"),
    q(alloyU),
    "construction-alloy-bond",
  );
  consume(s, b.id, owner, "hydrogen", hydrogenU, "construction-hydrogen");
  b.flow.constructionC += creditC;
  b.flow.constructionAlloyU += alloyU;
  b.flow.constructionHydrogenU += hydrogenU;
  return true;
}
export function orderPowerComplex(
  s,
  planet,
  type,
  modules = 1,
  { size = "large", owner = "government" } = {},
) {
  const b = s.planets[planet],
    e = s.e,
    def = POWER_TYPES[type],
    scaled = powerScale(e, s.r, type, size, s.month);
  if (
    !def ||
    modules < 1 ||
    modules > def.maxModules ||
    !Number.isInteger(modules)
  )
    throw Error("Invalid power complex");
  if (s.disableGovernmentPower && owner === "government") return null;
  const duration = scaled.foundationMonths,
    jobs = b.jobs.filter(
      (j) => j.startMonth < s.month + duration && j.endMonth > s.month,
    ),
    costs = {
      ...e.costs,
      [type]: { base: scaled.base, module: scaled.module },
    },
    quote = constructionQuote({
      type,
      part: "base",
      costs,
      startMonth: s.month,
      jobs,
      experience: b.experience,
      surcharge: owner === "government" ? e.parallelSurcharge : 0,
      learning: e.learning,
    });
  quote.endMonth = s.month + duration;
  if (!constructionPurchase(s, b, owner, quote, type + "-base")) return null;
  const complex = {
    id: planet + "-complex-" + b.complexes.length,
    owner,
    type,
    size,
    foundationEnd: quote.endMonth,
    modules: [],
    wanted: modules,
    foundationPaid: true,
  };
  b.complexes.push(complex);
  addAsset(b, {
    kind: "powerBase",
    owner,
    type,
    complexId: complex.id,
    state: "construction",
    completedMonth: quote.endMonth,
    creditBasisC: quote.creditC,
    alloyBasisU: quote.alloyU,
  });
  b.jobs.push({ ...quote, owner, complexId: complex.id, part: "base" });
  s.events.push({
    month: s.month,
    event: "base-ordered",
    planet,
    type,
    size,
    complexId: complex.id,
    overlap: quote.overlap,
    factor: quote.factor,
  });
  return complex;
}
function orderPowerModule(s, b, c) {
  const def = POWER_TYPES[c.type];
  if (
    c.modules.length >= def.maxModules ||
    c.modules.length >= c.wanted ||
    s.month < c.foundationEnd
  )
    return false;
  const scaled = powerScale(s.e, s.r, c.type, c.size, s.month),
    jobs = b.jobs.filter(
      (j) => j.startMonth < s.month + scaled.months && j.endMonth > s.month,
    ),
    costs = {
      ...s.e.costs,
      [c.type]: { base: scaled.base, module: scaled.module },
    },
    quote = constructionQuote({
      type: c.type,
      costs,
      startMonth: s.month,
      jobs,
      experience: b.experience,
      surcharge: c.owner === "government" ? s.e.parallelSurcharge : 0,
      learning: s.e.learning,
    });
  quote.endMonth =
    s.month +
    scaled.months +
    (c.owner === "private"
      ? Math.max(
          0,
          s.e.privatePowerLagMonths -
            s.e.costs.foundationMonths -
            POWER_TYPES[c.type].months,
        ) * Math.pow(scaled.ratio, s.r.timeExponent)
      : 0);
  quote.hydrogenU = scaled.buildHydrogenU;
  if (!constructionPurchase(s, b, c.owner, quote, c.type + "-module"))
    return false;
  const a = addAsset(b, {
    kind: "powerModule",
    owner: c.owner,
    type: c.type,
    size: c.size,
    ratio: scaled.ratio,
    ratedGW: scaled.ratedGW,
    startC: scaled.startC,
    complexId: c.id,
    state: "construction",
    completedMonth: quote.endMonth,
    creditBasisC: quote.creditC,
    alloyBasisU: quote.alloyU,
    progressHours: 0,
    startPaid: false,
    starts: 0,
  });
  c.modules.push(a.id);
  b.jobs.push({ ...quote, owner: c.owner, part: "module", complexId: c.id });
  s.events.push({
    month: s.month,
    event: "module-ordered",
    planet: b.id,
    type: c.type,
    size: c.size,
    overlap: quote.overlap,
    factor: quote.factor,
  });
  return true;
}
export function orderIndustry(s, b, owner, sets = 1) {
  if (owner === "government" && sets !== 1)
    throw Error("Government industry uses one fixed mining/smelting pair");
  const permitDelay =
    owner === "private"
      ? Math.max(0, s.p.expansionDelayMonths - FACILITY_TYPES[SMELTING].months)
      : 0;
  const a = industryAsset(
    b,
    owner,
    sets,
    s.month + permitDelay + FACILITY_TYPES[MINING].months,
    s.e,
    { mineRatio: owner === "private" ? s.e.mineRatio : 1 },
  );
  const cost = {
    creditC: a.creditBasisC,
    alloyU: a.alloyBasisU,
    hydrogenU: a.hydrogenU,
  };
  const overlap = b.jobs.filter(
    (j) => j.startMonth <= s.month && j.endMonth > s.month,
  ).length;
  if (owner === "government")
    cost.creditC *=
      1 +
      (s.e.parallelSurcharge * overlap) /
        (1 + s.e.learning * Math.sqrt(b.experience));
  if (!constructionPurchase(s, b, owner, cost, "industry")) {
    b.assets.pop();
    return false;
  }
  b.jobs.push({
    startMonth: s.month,
    endMonth: a.smeltCompletedMonth,
    part: "industry",
    owner,
  });
  if (owner === "private") b.flow.privateExpansionSets += sets;
  return true;
}
export function orderHydrogen(s, b, owner, modules = 1) {
  const recycleOnly422 =
    !b.reference.waterHostTile &&
    s.r422?.enabled &&
    b.assets.some(
      (a) =>
        a.kind === "industry" &&
        a.owner === owner &&
        a.completedMonth <= s.month,
    );
  if (
    (!b.reference.waterHostTile &&
      !recycleOnly422 &&
      !b.assets.some((a) => a.kind === "iceMine43" && a.owner === owner)) ||
    (!b.assets.some(
      (a) =>
        a.kind === "industry" &&
        a.owner === owner &&
        a.completedMonth <= s.month,
    ) &&
      !(
        b.id !== "earth" &&
        owner === "government" &&
        (b.reference.waterHostTile ||
          b.assets.some((a) => a.kind === "iceMine43"))
      ))
  )
    return false;
  modules = Math.max(1, Math.ceil(modules));
  const e = s.e,
    cost = {
      creditC: e.hydrogenModuleC * modules,
      alloyU: e.hydrogenModuleAlloyU * modules,
    };
  const water = waterGate422(s, b, owner, modules);
  if (water && !water.allowed) {
    deferWater422(s, b, owner, modules, cost, water);
    return false;
  }
  const guard = investmentGuard422(s, b, owner, cost);
  if (guard && !guard.allowed) return false;
  if (!constructionPurchase(s, b, owner, cost, "hydrogen")) return false;
  addAsset(b, {
    kind: "electrolyzer",
    owner,
    modules,
    hostTile: b.reference.waterHostTile ?? "existing-smelter-recycle",
    waterApproval422: water
      ? {
          startTick: water.startTick,
          readyTick: water.readyTick,
          months: water.months,
          fraction: water.fraction,
          minimumCoverage: water.minimumCoverage,
          operatingMonthsChecked: water.operatingMonthsChecked,
          requestCapacityQ: water.requestCapacityQ,
        }
      : undefined,
    recycleOnly422: recycleOnly422 || !b.reference.waterHostTile,
    essential: b.id !== "earth" && owner === "government",
    life43: b.id !== "earth" && owner === "government",
    completedMonth: s.month + e.hydrogenLagMonths,
    state: "construction",
    capacityU: e.hydrogenModuleU * modules,
    creditBasisC: cost.creditC,
    alloyBasisU: cost.alloyU,
  });
  if (guard) recordGuard422(s, b, owner, guard, "investment");
  const pending = b.pendingWater422[owner];
  if (pending) {
    pending.status = "builtAfterDelay";
    pending.builtMonth = s.month;
    pending.builtModules = modules;
    b.pendingWater422[owner] = null;
  }
  b.flow.hydrogenConstructionC += cost.creditC;
  return true;
}
function orderStorage(s, b) {
  const e = s.e;
  if (b.storage) return false;
  const cost = { creditC: e.storageC, alloyU: e.storageAlloyU };
  if (!constructionPurchase(s, b, "government", cost, "storage")) return false;
  const asset = addAsset(b, {
    kind: "storage",
    owner: "government",
    completedMonth: s.month + 1,
    state: "construction",
    creditBasisC: cost.creditC,
    alloyBasisU: cost.alloyU,
  });
  b.storage = {
    assetId: asset.id,
    socGWh: 0,
    capacityGWh: e.storageGWh,
    rateGW: e.storageGW,
  };
  return true;
}
function scenarioEvents(s) {
  const m = s.month,
    b = s.planets.earth,
    c = mediumStress41(s.scenario)
      ? "E5"
      : (R4_SCENARIO_BASE[s.scenario] ?? s.scenario);
  if (
    m === 0 &&
    [
      "S1",
      "S1-sell",
      "S2",
      "S3-debt",
      "S3-money",
      "S4",
      "E0",
      "E1",
      "E3",
      "E4",
      "E5",
      "E6",
      "E7",
    ].includes(c)
  )
    orderIndustry(s, b, "government");
  if (
    ["S1", "S1-sell", "S2", "S3-debt", "S3-money", "S4"].includes(c) &&
    m > 0 &&
    m % 24 === 0
  )
    orderIndustry(s, b, "government");
  if (c === "E1" && s.scenario !== "E10" && [0, 36, 72].includes(m))
    orderPowerComplex(
      s,
      "earth",
      m === 36 ? "solar" : m === 72 ? "fission" : "fusion",
      m === 0 ? 4 : 2,
    );
  if (c === "E3" && m === 36) orderPowerComplex(s, "earth", "fission", 8);
  if (c === "E4" && m === 0) {
    orderPowerComplex(s, "earth", "fusion", 8);
    orderPowerComplex(s, "moon", "fusion", 1);
  }
  if (c === "E6" && m === 0) orderPowerComplex(s, "earth", "fusion", 2);
  if (c === "E7" && [0, 48].includes(m)) {
    borrow(s, b, 250000);
    for (let i = 0; i < 6; i++)
      orderPowerComplex(s, "earth", ["fusion", "fission", "solar"][i % 3], 4);
  }
  if (
    ["E2", "E8"].includes(c) &&
    !["E2-S", "E9"].includes(s.scenario) &&
    m === 0
  ) {
    for (const id of ["moon", "mars"]) {
      orderPowerComplex(s, id, "solar", 1);
      orderStorage(s, s.planets[id]);
    }
    orderPowerComplex(s, "moon", "fission", 1);
  }
  if (c === "E2" && !["E2-S", "E9"].includes(s.scenario) && m === 60)
    orderPowerComplex(s, "mars", "fission", 1);
  if (c === "S4" && m > 0 && m % s.p.colonyBuildEveryMonths === 0) {
    transportGrant(s, m % 48 ? "moon" : "mars", 5000, 500, 10);
    orderIndustry(s, s.planets[m % 48 ? "moon" : "mars"], "government");
  }
  for (const planet of Object.values(s.planets)) {
    for (const a of planet.assets) {
      if (a.state === "construction" && a.completedMonth <= m) {
        a.state =
          a.kind === "powerModule" && a.type === "fusion"
            ? "coldStopped"
            : "active";
        planet.experience++;
      }
      if (
        c === "E6" &&
        s.scenario !== "E6-R" &&
        a.owner === "government" &&
        a.completedMonth <= m
      ) {
        if (m === 48) {
          a.state =
            a.kind === "powerModule" && a.type === "fusion"
              ? "coldStopped"
              : "paused";
          a.startPaid = false;
          a.progressHours = 0;
        }
        if (m === 60) restartRound4(s, planet, a);
      }
    }
    for (const complex of planet.complexes) {
      while (
        complex.modules.length < complex.wanted &&
        orderPowerModule(s, planet, complex)
      ) {}
    }
  }
  if (["E5", "E5-X", "E11"].includes(c) && m === 60) {
    // Actual military material consumption and no fictitious sale receipts.
    for (const owner of ["government", "private"])
      consume(
        s,
        "earth",
        owner,
        "alloy",
        stock(s, "earth", owner, "alloy") * s.stress41.lossFraction,
        "stress-physical-requisition",
      );
  }
}
export function upkeepRound41(s, b) {
  const e = s.e;
  for (const a of [...b.assets].sort((x, y) =>
    s.r.priorityEnabled
      ? priority41(x, b.shortage41, s.r41) - priority41(y, b.shortage41, s.r41)
      : 0,
  )) {
    if (a.completedMonth > s.month || a.state === "dismantled") continue;
    const bill = maintenanceBill41(a, e, s.r, b.id, s.month),
      kind = a.kind,
      ownBefore = stock(s, b.id, a.owner, "alloy");
    ensureStock(s, b, a.owner, "alloy", bill.alloyU);
    const paid = consume(
        s,
        b.id,
        a.owner,
        "alloy",
        bill.alloyU,
        "alloy-upkeep:" + kind,
      ),
      short = Math.max(0, bill.alloyU - paid);
    const damage = damageMaintenance41(
      a,
      {
        shortU: short,
        billU: bill.alloyU,
        month: s.month,
        damagePerMonth: e.damagePerMonth,
        graceEnabled: s.r41.triageEnabled && b.shortage41.active,
      },
      s.r41,
    );
    Object.assign(a, damage.asset);
    if (damage.usedGrace) b.policyStats41.graceAssetMonths++;
    if (upkeepPriority(a) === 0 && damage.healthLost > 0)
      b.policyStats41.lifeDamageAssetMonths++;
    if (damage.usedGrace || (upkeepPriority(a) === 0 && damage.healthLost > 0))
      s.relief41.grace.push({
        month: s.month,
        planet: b.id,
        asset: a.id,
        usedGrace: damage.usedGrace,
        healthLost: damage.healthLost,
        deferredQ: a.lifeDeferredQ ?? 0,
        age: a.lifeGraceAgeMonths,
        shortU: short,
        priority: priority41(a, b.shortage41, s.r41),
      });
    let repair = 0,
      repairC = 0;
    if (!short && a.backlogU > 0) {
      const possible = Math.min(a.backlogU, bill.alloyU * e.repairRate);
      ensureStock(s, b, a.owner, "alloy", possible);
      repair = Math.min(
        possible,
        stock(s, b.id, a.owner, "alloy"),
        stock(s, b.id, a.owner, "C") / e.repairCPerU,
      );
      if (repair > 0) {
        repair = consume(s, b.id, a.owner, "alloy", repair, "alloy-repair");
        repairC = pay(
          s,
          b.id,
          a.owner,
          "household",
          repair * e.repairCPerU,
          "repair-labour",
        );
        const repayment = repairMaintenance41(
          a,
          repair,
          bill.alloyU,
          e.damagePerMonth,
        );
        Object.assign(a, repayment.asset);
        if (repayment.asset.lifeGraceAgeMonths === undefined)
          delete a.lifeGraceAgeMonths;
        if (repayment.deferredRepaidQ)
          s.relief41.grace.push({
            month: s.month,
            planet: b.id,
            asset: a.id,
            repaidQ: repayment.deferredRepaidQ,
            deferredQ: a.lifeDeferredQ,
          });
      }
    }
    const cash = pay(
      s,
      b.id,
      a.owner,
      "household",
      bill.directC * s.priceIndex,
      "wages-admin:" + kind,
    );
    a.cashFraction = bill.directC
      ? clamp(cash / (bill.directC * s.priceIndex))
      : 1;
    b.flow.upkeepRequiredU += bill.alloyU;
    b.flow.upkeepPaidU += paid;
    b.flow.directC += cash;
    b.flow.repairU += repair;
    b.flow.repairC += repairC;
    b.flow.healthMin = Math.min(b.flow.healthMin, a.health);
    const k = (b.flow.maintenanceByKind[kind] ??= {
      requiredU: 0,
      paidU: 0,
      directC: 0,
      pausedRequiredU: 0,
    });
    k.requiredU += bill.alloyU;
    k.paidU += paid;
    k.directC += cash;
    if (["paused", "coldStopped"].includes(a.state))
      k.pausedRequiredU += bill.alloyU;
    if (["powerBase", "powerModule", "legacyGrid", "storage"].includes(kind)) {
      b.flow.powerDirectC += cash;
      b.flow.powerUpkeepU += paid;
    }
    if (
      a.owner === "government" &&
      ["powerBase", "powerModule", "storage"].includes(kind)
    ) {
      b.flow.governmentPowerDirectC += cash;
      b.flow.governmentPowerUpkeepU += paid;
    }
    if (a.owner === "government" && kind === "industry") {
      b.flow.governmentIndustryDirectC += cash;
      b.flow.governmentIndustryUpkeepU += paid;
    }
    if (kind === "electrolyzer") {
      b.flow.hydrogenDirectC += cash;
      b.flow.hydrogenUpkeepU += paid;
    }
    // Own stock is a material cost, never an invented cash debit. Acquisition
    // money appears only in the atomic purchase above.
    a.lastOwnUpkeepU = Math.min(ownBefore, paid);
    a.lastBill = bill;
  }
}
function legacyIndustryPlan422(s, b, a, m, budgets = null) {
  const e = s.e,
    p = s.p,
    cap = industryCapacity({
      sets: a.sets,
      completedMonth: a.completedMonth,
      month: m,
      difficulty: p.difficulty,
      processingDifficulty: p.processingDifficulty,
      mineRatio: a.mineRatio,
    });
  const smeltCap = industryCapacity({
    sets: a.sets,
    completedMonth: a.smeltCompletedMonth,
    month: m,
    difficulty: p.difficulty,
    processingDifficulty: p.processingDifficulty,
    mineRatio: a.mineRatio,
  });
  cap.processU = smeltCap.processU;
  let factor = a.health * (a.cashFraction ?? 1);
  if (
    a.state === "construction" ||
    a.state === "paused" ||
    a.state === "dismantling" ||
    a.state === "dismantled" ||
    (shockActive41(
      s.scenario,
      m,
      s.stress41 ?? stressDefinition41(s.scenario),
    ) &&
      (!mediumStress41(s.scenario) || b.id === "earth"))
  )
    factor = 0;
  const profile = restartProfile(a, s.r, m),
    mineU = cap.mineU * factor * profile.mineFactor,
    baseProcess = cap.processU * factor * profile.smeltFactor,
    oreAvailable =
      mineU + (budgets?.ore[a.owner] ?? stock(s, b.id, a.owner, "ore"));
  const boostUseful =
    oreAvailable > baseProcess &&
    baseProcess *
      s.inputs.contract.smeltBoost *
      s.tech.yieldFraction *
      b.alloyPrice >
      s.inputs.contract.smeltHydrogenU * a.sets * b.hydrogenPrice;
  const maxH =
    s.inputs.contract.smeltHydrogenU * a.sets * smeltCap.ramp * factor;
  let work = assistedSmelting({
    oreU: oreAvailable,
    baseProcessU: baseProcess,
    rawWorkU:
      FACILITY_TYPES[SMELTING].capacityU * a.sets * smeltCap.ramp * factor,
    maxHydrogenU: maxH,
    availableHydrogenU:
      budgets?.hydrogen[a.owner] ?? stock(s, b.id, a.owner, "hydrogen"),
    boost: s.inputs.contract.smeltBoost,
    enabled: boostUseful,
  });
  const { processU, hydrogenU, desiredHydrogenU } = work,
    alloyU = processU * s.tech.yieldFraction;
  const energyGWh =
    (((mineU * ROUND4_RESOURCES.get("ore").contentMassKgPerU) / 1000) *
      e.mineMWhPerT) /
      1000 +
    (((processU * ROUND4_RESOURCES.get("ore").contentMassKgPerU) / 1000) *
      e.feedMWhPerT) /
      1000 +
    (((alloyU * ROUND4_RESOURCES.get("alloy").contentMassKgPerU) / 1000) *
      alloyElectricityMWhPerT(e.industryMix)) /
      1000 +
    (a.completedMonth > m
      ? 0
      : ((a.sets * e.industryFixedMW * 730) / 1000) *
        (a.state === "paused" || a.state === "dismantling" ? 0.05 : 1));
  if (budgets) {
    budgets.ore[a.owner] = oreAvailable - processU;
    budgets.hydrogen[a.owner] = Math.max(
      0,
      budgets.hydrogen[a.owner] - hydrogenU,
    );
  }
  const heaterGWh =
    a.state === "active"
      ? ((a.sets * e.industryFixedMW) / 1000) *
        profile.heaterHours *
        s.r.smeltHeatMultiplier
      : 0;
  return {
    asset: a,
    mineU,
    processU,
    alloyU,
    hydrogenU,
    desiredHydrogenU,
    energyGWh: energyGWh + heaterGWh,
    heaterGWh,
    baseProcess,
    reduction422: false,
    reductionProcessU422: work.reductionProcessU ?? 0,
  };
}
function industryPlan(s, b, a, m, budgets = null) {
  if (!s.r422.enabled) return legacyIndustryPlan422(s, b, a, m, budgets);
  const x = characteristics422(s, b, a, m),
    available =
      budgets?.hydrogen[a.owner] ??
      Math.max(
        0,
        stock(s, b.id, a.owner, "hydrogen") - fusionNeed422(s, b, a.owner),
      ),
    ore = x.mineU + (budgets?.ore[a.owner] ?? stock(s, b.id, a.owner, "ore"));
  const work = splitWork422(
    { ...x, oreU: ore, availableHydrogenU: available },
    s.r422,
  );
  if (budgets) {
    budgets.ore[a.owner] = Math.max(0, ore - work.processU);
    budgets.hydrogen[a.owner] = Math.max(0, available - work.hydrogenU);
  }
  return {
    asset: a,
    mineU: x.mineU,
    processU: work.processU,
    alloyU: work.processU * s.tech.yieldFraction + work.yieldBonusAlloyU,
    fullProcessCapacity422: x.fastProcessU * (1 + x.assistedBoost),
    hydrogenU: work.hydrogenU,
    desiredHydrogenU: work.desiredHydrogenU,
    energyGWh:
      x.mineEnergyGWh +
      work.processU * x.processGWhPerU +
      x.fixedGWh +
      x.heaterGWh,
    heaterGWh: x.heaterGWh,
    baseProcess: x.baseProcessU,
    reduction422: true,
    reductionProcessU422: work.reductionProcessU,
    conventionalHydrogenU422: work.conventionalHydrogenU,
    reductionTime422: work.reductionTime,
    capacityRatio422: work.capacityRatio,
    marginal422: work.marginal,
  };
}
function industryPlans(s, b, m) {
  const budgets = {
    ore: {
      government: stock(s, b.id, "government", "ore"),
      private: stock(s, b.id, "private", "ore"),
    },
    hydrogen: {
      government: Math.max(
        0,
        stock(s, b.id, "government", "hydrogen") -
          (s.r422.enabled ? fusionNeed422(s, b, "government") : 0),
      ),
      private: Math.max(
        0,
        stock(s, b.id, "private", "hydrogen") -
          (s.r422.enabled ? fusionNeed422(s, b, "private") : 0),
      ),
    },
  };
  return b.assets
    .filter((a) => a.kind === "industry" && a.state !== "dismantled")
    .map((a) => industryPlan(s, b, a, m, budgets));
}
function mergeMaturePrivateCohorts(b, m) {
  return; // Lifecycle cohorts retain their independent vintage and decisions.

  const eligible = b.assets.filter(
    (a) =>
      a.kind === "industry" &&
      a.owner === "private" &&
      a.smeltCompletedMonth < m - 12 &&
      a.health === 1 &&
      a.backlogU === 0 &&
      a.state === "active",
  );
  if (eligible.length < 2) return;
  const first = eligible[0],
    ids = new Set(eligible.slice(1).map((a) => a.id));
  for (const a of eligible.slice(1))
    for (const k of [
      "sets",
      "creditBasisC",
      "alloyBasisU",
      "mineCreditC",
      "mineAlloyU",
    ])
      first[k] += a[k];
  first.completedMonth = -100;
  first.smeltCompletedMonth = -100;
  b.assets = b.assets.filter((a) => !ids.has(a.id));
}
function solarFactor(s, b, m) {
  let cf = s.e.solarEarthCF;
  if (b.id === "moon") cf *= s.e.solarMoonMultiplier;
  if (b.id === "mars") cf *= s.e.solarMarsMultiplier;
  if (s.scenario === "E8" && m >= 36 && m < 108) cf *= 0.25;
  return cf;
}
function openingHydrogenPurchases(s, b, plans) {
  b.hydrogenDesiredUseU = 0;
  if (s.r422?.enabled)
    b.h422Required = Object.fromEntries(
      ["government", "private"].map((o) => [
        o,
        sum(
          plans
            .filter((x) => x.asset.owner === o)
            .map((x) => x.desiredHydrogenU),
        ) + fusionNeed422(s, b, o),
      ]),
    );
  for (const owner of s.r422?.enabled
    ? ["private", "government"]
    : ["government", "private"]) {
    const industryH = sum(
      plans
        .filter((p) => p.asset.owner === owner)
        .map((p) => p.desiredHydrogenU),
    );
    const modules = b.assets.filter(
      (a) =>
        a.owner === owner &&
        a.kind === "powerModule" &&
        a.type === "fusion" &&
        a.completedMonth <= s.month,
    );
    const need =
      industryH +
      sum(
        modules.map((a) =>
          ["coldStopped", "starting"].includes(a.state)
            ? Math.max(
                0,
                FUSION.startHydrogenU *
                  (a.ratio ?? 1) *
                  (1 - a.progressHours / FUSION.startHours),
              )
            : s.fuelU * (a.ratio ?? 1),
        ),
      );
    if (owner === "government") b.hydrogenGovernmentReservationU = need;
    purchase(
      s,
      b,
      owner,
      "hydrogen",
      Math.max(0, need - stock(s, b.id, owner, "hydrogen")),
    );
    b.hydrogenDesiredUseU += need;
    // This is an unfilled opening order, not consumed H minus closing stock.
    b.flow.hydrogenUnmetU += Math.max(
      0,
      need - stock(s, b.id, owner, "hydrogen"),
    );
  }
}
function monthlyPower(s, b, plans) {
  const e = s.e,
    m = s.month,
    pe = b.id === "earth",
    hours = 730;
  const grow = b.potentialGDP / s.p.bodies[b.id].annualGDP;
  let background = pe
    ? Math.max(0, e.earthBaseGW * 730 - b.baselineIndustrialGWh) *
      Math.pow(grow, e.electricDemandGDPExponent)
    : ((b.population * e.colonyKWPerPerson) / 1e6) * 730;
  let existingFactor = 1;
  const peakEvent = s.scenario === "E3" && m >= 48 && m < 60 && pe,
    peakRatio = e.peakGW / e.earthBaseGW;
  if (peakEvent) {
    background *= 0.75 + 0.25 * peakRatio;
    existingFactor = 0.9;
  }
  if (
    ["E2", "E2-S", "E9", "E8"].includes(s.scenario) &&
    !pe &&
    m >= 36 &&
    m < 60
  )
    existingFactor = 0.65;
  const legacy = b.assets.find((a) => a.kind === "legacyGrid"),
    legacyGWh = ![
      "paused",
      "coldStopped",
      "dismantling",
      "dismantled",
    ].includes(legacy.state)
      ? legacy.capacityGW *
        730 *
        existingFactor *
        legacy.health *
        (legacy.cashFraction ?? 1)
      : 0;
  const privateExpansions = b.assets.filter(
    (a) =>
      a.kind === "privateGridExpansion" &&
      a.completedMonth <= m &&
      !["paused", "dismantling", "dismantled"].includes(a.state),
  );
  const privateNewGWh = sum(
    privateExpansions.map(
      (a) =>
        a.capacityGW *
        730 *
        e.fissionAvailability *
        a.health *
        (a.cashFraction ?? 1),
    ),
  );
  let supply = legacyGWh + privateNewGWh,
    governmentGWh = 0,
    startInput = 0,
    startGeneration = 0,
    normalFusionH = 0,
    startGenerationGov = 0;
  const completed = b.assets.filter(
    (a) =>
      a.kind === "powerModule" &&
      a.completedMonth <= m &&
      !a.manualPause &&
      !["paused", "construction", "dismantling", "dismantled"].includes(
        a.state,
      ),
  );
  const fusionHReserved = {
    government: sum(
      plans
        .filter((x) => x.asset.owner === "government")
        .map((x) => x.hydrogenU),
    ),
    private: sum(
      plans.filter((x) => x.asset.owner === "private").map((x) => x.hydrogenU),
    ),
  };
  // Normal fuel is reserved before starts; no two modules can spend the same H.
  for (const a of completed.filter(
    (a) => a.type === "fusion" && ["active", "curtailed"].includes(a.state),
  )) {
    if (s.scenario === "E6" && m >= 48 && m < 60) continue;
    const available = Math.max(
      0,
      stock(s, b.id, a.owner, "hydrogen") - fusionHReserved[a.owner],
    );
    const r = dispatchFusion({
      requestedGWh: (a.ratedGW / (a.ratio ?? 1)) * 730 * a.health,
      availableHydrogenU: available / (a.ratio ?? 1),
      minimumFraction: e.fusionMinimumFraction,
      normalHydrogenU: s.fuelU,
    });
    a.state = r.state;
    if (r.state === "coldStopped") {
      a.startPaid = false;
      a.progressHours = 0;
      continue;
    }
    fusionHReserved[a.owner] += r.hydrogenU * (a.ratio ?? 1);
    a.provisionalGWh = r.energyGWh * (a.ratio ?? 1);
    a.normalHours = 730;
  }
  for (const a of completed.filter((a) => a.type !== "fusion")) {
    const r =
      a.ratedGW *
      730 *
      a.health *
      (a.cashFraction ?? 1) *
      (a.type === "solar" ? solarFactor(s, b, m) : e.fissionAvailability) *
      (a.derateUntil > m ? 1 - a.derateFraction : 1);
    a.provisionalGWh = r;
  }
  const regularGovernment = sum(completed.map((a) => a.provisionalGWh ?? 0));
  const externalSupply = supply + regularGovernment;
  let startupExternalRemaining = Math.max(0, externalSupply - background);
  for (const a of completed.filter(
    (a) => a.type === "fusion" && ["coldStopped", "starting"].includes(a.state),
  )) {
    if (s.scenario === "E6" && m >= 48 && m < 60) continue;
    if (!a.startPaid) {
      if (stock(s, b.id, a.owner, "C") < a.startC * s.priceIndex) continue;
      const c = pay(
        s,
        b.id,
        a.owner,
        "household",
        a.startC * s.priceIndex,
        "fusion-start-labour",
      );
      b.flow.startC += c;
      a.startPaid = true;
      a.startHConsumedQ = 0;
      a.starts++;
      s.normalStarts++;
      s.events.push({
        month: m,
        event: "fusion-start",
        planet: b.id,
        asset: a.id,
        number: a.starts,
      });
    }
    a.state = "starting";
    let wall = 730,
      normalHours = 0,
      steps = 0;
    // At most four startup progress windows per successful boot. The external
    // instantaneous allocation is limited as well as its monthly energy budget.
    while (wall > 1e-8 && a.progressHours < 96 - 1e-8 && steps < 32) {
      const dt = Math.min(24, wall, 96 - a.progressHours),
        available = Math.max(
          0,
          stock(s, b.id, a.owner, "hydrogen") - fusionHReserved[a.owner],
        );
      const stableSurplusGW = Math.max(0, (externalSupply - background) / 730);
      const input = Math.min(
        startupExternalRemaining,
        Math.min(stableSurplusGW, FUSION.inputGW * (a.ratio ?? 1)) * dt,
      );
      const theoreticalUsed =
          (a.progressHours * FUSION.startHydrogenU * (a.ratio ?? 1)) /
          FUSION.startHours,
        paidCredit = Math.max(
          0,
          (a.startHConsumedQ ?? 0) / 1000 - theoreticalUsed,
        ),
        provisional = advanceSizedFusionStart(a, {
          progressHours: a.progressHours,
          wallHours: dt,
          externalGWh: input,
          hydrogenU: available + paidCredit,
        });
      // Fund startup progress with whole material quanta. Sub-quantum resources
      // cannot be spent repeatedly while the same H remains in the account.
      const targetQ = Math.ceil(
          ((provisional.progressHours *
            FUSION.startHydrogenU *
            (a.ratio ?? 1)) /
            FUSION.startHours) *
            1000 -
            1e-7,
        ),
        fundedQ = Math.min(
          q(available),
          Math.max(0, targetQ - (a.startHConsumedQ ?? 0)),
        ),
        fundedH = fundedQ / 1000;
      const r = advanceSizedFusionStart(a, {
        progressHours: a.progressHours,
        wallHours: dt,
        externalGWh: input,
        hydrogenU: fundedH + paidCredit,
      });
      a.progressHours = r.progressHours;
      startInput += r.inputGWh;
      startGeneration += r.generationGWh;
      if (a.owner === "government") startGenerationGov += r.generationGWh;
      startupExternalRemaining -= r.inputGWh;
      const used = consume(
        s,
        b.id,
        a.owner,
        "hydrogen",
        fundedH,
        "fusion-start-hydrogen",
      );
      a.startHConsumedQ = (a.startHConsumedQ ?? 0) + q(used);
      b.flow.startHydrogenU += used;
      b.flow.hydrogenUsedU += used;
      s.bootSubsteps++;
      steps++;
      wall -= dt;
      if (r.advancedHours < 1e-9) break;
      if (r.completed) {
        a.state = "active";
        normalHours = wall;
        break;
      }
    }
    if (normalHours > 0) {
      const available = Math.max(
          0,
          stock(s, b.id, a.owner, "hydrogen") - fusionHReserved[a.owner],
        ),
        r = dispatchFusion({
          requestedGWh: (a.ratedGW / (a.ratio ?? 1)) * normalHours * a.health,
          hours: normalHours,
          availableHydrogenU: available / (a.ratio ?? 1),
          minimumFraction: e.fusionMinimumFraction,
          normalHydrogenU: s.fuelU,
        });
      a.state = r.state;
      a.provisionalGWh = r.energyGWh * (a.ratio ?? 1);
      a.normalHours = normalHours;
      fusionHReserved[a.owner] += r.hydrogenU * (a.ratio ?? 1);
      if (r.state === "coldStopped") {
        a.startPaid = false;
        a.progressHours = 0;
      }
    }
  }
  // Newly started normal operation is included; startup output cannot start
  // itself/another reactor in this settlement, but can supply end-use loads.
  governmentGWh =
    sum(
      completed
        .filter((a) => a.owner === "government")
        .map((a) => a.provisionalGWh ?? 0),
    ) + startGenerationGov;
  supply += sum(completed.map((a) => a.provisionalGWh ?? 0)) + startGeneration;
  const industrial = sum(plans.map((p) => p.energyGWh));
  let iceReserveQ = s.book.get(account(b.id, "ground", "ice43"));
  const icePlans = b.assets
      .filter((a) => a.kind === "iceMine43")
      .sort(
        (a, b) =>
          Number(a.owner !== "government") - Number(b.owner !== "government"),
      )
      .map((a) => {
        const p = icePlan43(s, b, a, m);
        p.units = Math.min(p.units, iceReserveQ / 1000);
        iceReserveQ -= Math.ceil(p.units * 1000);
        p.energyGWh = p.units * s.r43.iceGWhPerU;
        return p;
      }),
    iceEnergy = sum(icePlans.map((p) => p.energyGWh));
  const electrolyzers = b.assets.filter(
    (a) =>
      a.kind === "electrolyzer" &&
      a.completedMonth <= m &&
      !["paused", "dismantling", "dismantled"].includes(a.state),
  );
  const storageH = sum(
      ["government", "private"].map((owner) =>
        stock(s, b.id, owner, "hydrogen"),
      ),
    ),
    storageGWh =
      (storageH *
        ROUND4_RESOURCES.get("hydrogen").contentMassKgPerU *
        s.r.hydrogenStorageKWhKgMonth) /
      1e6;
  let lifeReserve422 = lifeNeed43(
    b.id,
    b.population,
    s.r43.oxygenRecycle,
  ).waterQ;
  const waterBudget422 = {};
  for (const owner of ["government", "private"]) {
    const life = Math.min(
      lifeReserve422,
      s.book.get(account(b.id, owner, "water")),
    );
    waterBudget422[owner] =
      Math.max(0, s.book.get(account(b.id, owner, "water")) - life) / 1000;
    lifeReserve422 -= life;
  }
  let oxygenUnitsRemaining = Math.max(
    0,
    (lifeNeed43(b.id, b.population, s.r43.oxygenRecycle).oxygenQ * 2 -
      sum(
        ["government", "private"].map((o) =>
          s.book.get(account(b.id, o, "oxygen")),
        ),
      )) /
      1000,
  );
  const hPlans = electrolyzers.map((a) => {
    const eligible =
        b.reference.waterTiles.includes(a.hostTile) || a.recycleOnly422,
      target = b.hydrogenTargetU || e.hydrogenModuleU * 3;
    const deficit = Math.max(0, target - stock(s, b.id, a.owner, "hydrogen"));
    const margin =
      (s.r422?.enabled ? internalHydrogen422(s, b, a.owner) : b.hydrogenPrice) -
      ((e.electrolysisGWhPerU +
        (s.r.hydrogenLiquefactionKWhKg *
          ROUND4_RESOURCES.get("hydrogen").contentMassKgPerU) /
          1e6) *
        b.powerPriceC +
        ((s.r.oxygenLiquefactionKWhKg * 4000) / 1e6) * b.powerPriceC +
        s.e.hydrogenVariableCPerU +
        (b.id !== "earth" && !b.reference.waterTiles.includes(a.hostTile)
          ? b.waterPrice43
          : 0));
    let units =
      eligible && margin > 0
        ? Math.min(
            a.capacityU * a.health * (a.cashFraction ?? 1),
            deficit + (b.hydrogenDesiredUseU ?? 0),
            e.waterIntakeU / electrolyzers.length,
          )
        : 0;
    if (s.r422?.enabled) {
      const desired = Math.max(
          target,
          (b.h422Potential?.[a.owner] ?? 0) * s.e.hydrogenInventoryMonths,
        ),
        deficit422 = Math.max(0, desired - stock(s, b.id, a.owner, "hydrogen"));
      units =
        eligible && margin > 0
          ? Math.min(
              a.capacityU * a.health * (a.cashFraction ?? 1),
              deficit422 + (b.h422Required?.[a.owner] ?? 0),
              e.waterIntakeU / electrolyzers.length,
            )
          : 0;
    }
    const desiredLife = a.life43
      ? Math.min(
          a.capacityU * a.health * (a.cashFraction ?? 1),
          oxygenUnitsRemaining,
        )
      : 0;
    units = Math.max(units, desiredLife);
    if (a.recycleOnly422) {
      units = Math.min(units, waterBudget422[a.owner]);
      waterBudget422[a.owner] -= units;
    }
    if (cutActive422(s, b)) units = 0;
    if (!Number.isFinite(units)) units = 0;
    if (s.scenario === "E4" && m >= 48 && m < 84) units = 0;
    const lifeUnits = Math.min(units, desiredLife);
    oxygenUnitsRemaining -= lifeUnits;
    const liquefactionGWh =
      (units *
        s.r.hydrogenLiquefactionKWhKg *
        ROUND4_RESOURCES.get("hydrogen").contentMassKgPerU) /
      1e6;
    const oxygenLiquefactionGWh =
      (units *
        s.r.oxygenLiquefactionKWhKg *
        ROUND4_RESOURCES.get("oxygen").contentMassKgPerU) /
      1e6;
    return {
      asset: a,
      units,
      lifeUnits,
      liquefactionGWh,
      oxygenLiquefactionGWh,
      energyGWh:
        units * e.electrolysisGWhPerU + liquefactionGWh + oxygenLiquefactionGWh,
    };
  });
  const lifeElectrolysis = sum(
    hPlans.map((h) => (h.units ? (h.energyGWh * h.lifeUnits) / h.units : 0)),
  );
  const electrolysis = sum(hPlans.map((p) => p.energyGWh)) + storageGWh,
    packagingGWh = runShipments(
      s,
      b,
      Math.max(
        0,
        supply -
          background * e.essentialShare -
          startInput -
          iceEnergy -
          lifeElectrolysis,
      ),
      fusionHReserved,
    );
  const demand =
    background +
    industrial +
    electrolysis +
    iceEnergy +
    startInput +
    packagingGWh;
  const storageAsset =
      b.storage && b.assets.find((a) => a.id === b.storage.assetId),
    storageEnabled =
      storageAsset &&
      storageAsset.completedMonth <= m &&
      !["paused", "dismantling", "dismantled"].includes(storageAsset.state);
  // Monthly averages cannot represent lunar nights. A two-block clear/night
  // dispatch is used for colony solar/storage; every block conserves energy.
  const split = !pe && completed.some((a) => a.type === "solar");
  const blockHours = [];
  if (split && storageEnabled && b.id === "mars") {
    // A Martian night is about 12.33h, not half a month. Integrate representative
    // sol day/night events; the final partial sol keeps the month exactly730h.
    let left = 730;
    while (left > 1e-8) {
      const h = Math.min(12.33, left);
      blockHours.push(h);
      left -= h;
    }
  } else if (split) blockHours.push(365, 365);
  else if (peakEvent) blockHours.push(182.5, 547.5);
  else blockHours.push(730);
  const dayHours = sum(blockHours.filter((_, i) => i % 2 === 0));
  let served = 0,
    curtailed = 0,
    charge = 0,
    discharge = 0,
    loss = 0,
    usedSupply = 0;
  const solarGWh = sum(
    completed
      .filter((a) => a.type === "solar")
      .map((a) => a.provisionalGWh ?? 0),
  );
  for (let k = 0; k < blockHours.length; k++) {
    const fraction = blockHours[k] / 730;
    const blockSupply = split
      ? (supply - solarGWh) * fraction +
        (k % 2 === 0 ? (solarGWh * blockHours[k]) / dayHours : 0)
      : supply * fraction;
    const blockDemand = peakEvent
      ? (background * fraction * (k === 0 ? peakRatio : 1)) /
          (0.75 + 0.25 * peakRatio) +
        (industrial + electrolysis + iceEnergy + startInput + packagingGWh) *
          fraction
      : demand * fraction;
    let st = { chargeGWh: 0, dischargeGWh: 0, lossGWh: 0 };
    if (storageEnabled) {
      st = balanceStorage({
        ...b.storage,
        efficiency: e.storageEfficiency,
        supplyGWh: blockSupply,
        demandGWh: blockDemand,
        hours: 730 * fraction,
      });
      b.storage.socGWh = st.socGWh;
    }
    const available = blockSupply + st.dischargeGWh - st.chargeGWh,
      delivered = Math.min(available, blockDemand),
      excess = Math.max(0, available - blockDemand);
    const genK = q(blockSupply, 1e6),
      disK = q(st.dischargeGWh, 1e6),
      chargeK = q(st.chargeGWh, 1e6),
      servedK = Math.min(genK + disK - chargeK, q(delivered, 1e6));
    energyAudit({
      generationKWh: genK,
      dischargeKWh: disK,
      servedKWh: servedK,
      chargeKWh: chargeK,
      curtailedKWh: genK + disK - chargeK - servedK,
    });
    served += delivered;
    curtailed += excess;
    charge += st.chargeGWh;
    discharge += st.dischargeGWh;
    loss += st.lossGWh;
    usedSupply += blockSupply - excess;
  }
  // Boot input was reserved out of external supply above; priority then protects
  // explicit ice/O life loads, then basic cities. Remaining industrial/H loads share one grid.
  const usable = Math.max(0, served - startInput - packagingGWh),
    iceRatio = iceEnergy ? clamp(usable / iceEnergy) : 1,
    afterIce = Math.max(0, usable - iceEnergy * iceRatio),
    lifeHydrogenRatio = lifeElectrolysis
      ? clamp(afterIce / lifeElectrolysis)
      : 1,
    afterLife = Math.max(0, afterIce - lifeElectrolysis * lifeHydrogenRatio),
    essential = Math.min(background * e.essentialShare, afterLife),
    remaining = Math.max(0, afterLife - essential),
    ordinaryElectrolysis = electrolysis - lifeElectrolysis;
  const optionalCity = background * (1 - e.essentialShare),
    other = optionalCity + industrial + ordinaryElectrolysis;
  let ratio = other ? clamp(remaining / other) : 1,
    industryRatio = ratio;
  if (e.dispatchPolicy === "industryFirst") {
    industryRatio =
      industrial + ordinaryElectrolysis
        ? clamp(remaining / (industrial + ordinaryElectrolysis))
        : 1;
    ratio = optionalCity
      ? clamp(
          (remaining - (industrial + ordinaryElectrolysis) * industryRatio) /
            optionalCity,
        )
      : 1;
  }
  for (const h of hPlans) {
    h.actualRatio = h.units
      ? (h.lifeUnits * lifeHydrogenRatio +
          (h.units - h.lifeUnits) * industryRatio) /
        h.units
      : 0;
  }
  const actualElectrolysis =
    sum(hPlans.map((h) => h.energyGWh * h.actualRatio)) +
    storageGWh * industryRatio;
  b.cityUtilization = background
    ? clamp((essential + optionalCity * ratio) / background)
    : 1;
  // Settlement curtails actual generation and fuel together. Startup was fixed
  // by progress already and is never retroactively erased by curtailment.
  const dispatchRatio =
    supply > 0
      ? clamp((usedSupply - startGeneration) / (supply - startGeneration || 1))
      : 0;
  b.flow.powerFuelC += pay(
    s,
    b.id,
    "private",
    "household",
    privateNewGWh * dispatchRatio * e.fissionFuelCPerGWh * s.priceIndex,
    "private-fission-fuel-services",
  );
  let actualGovernment = startGenerationGov;
  for (const a of completed) {
    const actual = (a.provisionalGWh ?? 0) * dispatchRatio;
    a.actualGWh = actual;
    if (a.owner === "government") actualGovernment += actual;
    if (a.type === "fusion" && (a.provisionalGWh ?? 0) > 0) {
      const sustainingGWh =
          a.ratedGW * (a.normalHours ?? 730) * e.fusionMinimumFraction,
        fuelOutput = Math.max(actual, sustainingGWh);
      // A running reactor can hold its minimum output and spill unused power.
      // Curtailment does not charge a restart, and sustaining fuel is not free.
      const fuel = consume(
        s,
        b.id,
        a.owner,
        "hydrogen",
        (fuelOutput / 3650) * s.fuelU,
        "fusion-normal-hydrogen",
      );
      normalFusionH += fuel;
      b.flow.hydrogenUsedU += fuel;
      a.state =
        actual < (a.provisionalGWh ?? 0) - 1e-8 ? "curtailed" : "active";
    }
    a.lastUtilization = actual / (a.ratedGW * 730);
    if (a.type === "fission")
      b.flow.powerFuelC += pay(
        s,
        b.id,
        a.owner,
        "household",
        actual * e.fissionFuelCPerGWh * s.priceIndex,
        "fission-fuel-services",
      );
    delete a.provisionalGWh;
  }
  b.flow.normalHydrogenU += normalFusionH;
  b.flow.liquefactionGWh += sum(
    hPlans.map((h) => h.liquefactionGWh * h.actualRatio),
  );
  b.flow.oxygenLiquefactionGWh += sum(
    hPlans.map((h) => h.oxygenLiquefactionGWh * h.actualRatio),
  );
  b.flow.hydrogenStorageGWh += storageGWh * industryRatio;
  b.flow.restartHeaterGWh += sum(plans.map((x) => x.heaterGWh)) * industryRatio;
  // Consumer-to-utility payments are existing GDP expenditure, not new GDP.
  const tariff = b.powerPriceC * s.priceIndex,
    cityServed = background * b.cityUtilization;
  pay(
    s,
    b.id,
    "household",
    "private",
    cityServed * tariff,
    "existing-city-electric-bill",
  );
  const govH =
      sum(
        hPlans
          .filter((h) => h.asset.owner === "government")
          .map((h) => h.energyGWh * h.actualRatio),
      ) +
      storageGWh *
        industryRatio *
        (storageH ? stock(s, b.id, "government", "hydrogen") / storageH : 0),
    govIndustry =
      b.flow.packagingGovernmentGWh +
      govH +
      sum(
        icePlans
          .filter((p) => p.asset.owner === "government")
          .map((p) => p.energyGWh),
      ) *
        iceRatio +
      sum(
        plans
          .filter((p) => p.asset.owner === "government")
          .map((p) => p.energyGWh),
      ) *
        industryRatio,
    privateIndustry =
      packagingGWh -
      b.flow.packagingGovernmentGWh +
      actualElectrolysis -
      govH +
      sum(
        icePlans
          .filter((p) => p.asset.owner === "private")
          .map((p) => p.energyGWh),
      ) *
        iceRatio +
      sum(
        icePlans
          .filter((p) => p.asset.owner === "government")
          .map((p) => p.energyGWh),
      ) *
        iceRatio +
      sum(
        plans
          .filter((p) => p.asset.owner === "private")
          .map((p) => p.energyGWh),
      ) *
        industryRatio;
  const totalDelivered = Math.max(1e-9, served),
    governmentShare = clamp(actualGovernment / totalDelivered),
    govSelf = govIndustry * governmentShare;
  const exported = Math.min(
      actualGovernment - govSelf,
      cityServed + privateIndustry,
    ),
    govBought = Math.max(0, govIndustry - govSelf);
  const sales = pay(
    s,
    b.id,
    "private",
    "government",
    Math.max(0, exported) * tariff,
    "government-external-electric-sale",
  );
  b.flow.governmentPowerPurchaseC += pay(
    s,
    b.id,
    "government",
    "private",
    govBought * tariff,
    "government-electric-purchase",
  );
  b.flow.powerUnpaidC +=
    Math.max(0, Math.max(0, exported) * tariff - sales) +
    Math.max(0, govBought * tariff - b.flow.governmentPowerPurchaseC);
  b.flow.governmentExternalSalesC += sales;
  b.flow.powerSalesC += sales;
  b.flow.governmentPowerGWh += actualGovernment;
  b.flow.generationGWh += supply;
  b.flow.demandGWh += demand;
  b.flow.servedGWh += served;
  b.flow.unservedGWh += Math.max(0, demand - served);
  b.flow.startInputGWh += startInput;
  b.flow.startGenerationGWh += startGeneration;
  b.flow.industryDemandGWh += industrial;
  b.flow.industryServedGWh += industrial * industryRatio;
  b.flow.storageChargeGWh += charge;
  b.flow.storageDischargeGWh += discharge;
  b.flow.storageLossGWh += loss;
  b.flow.curtailedGWh += curtailed;
  b.reserveFraction = demand ? (supply - demand) / demand : 0;
  b.industryUtilization = industryRatio;
  b.flow.iceEnergyDemandGWh43 = iceEnergy;
  b.flow.iceEnergyGWh43 = iceEnergy * iceRatio;
  b.lastIcePowerRatio43 = iceRatio;
  return {
    industryRatio,
    hPlans,
    hydrogenRatio: industryRatio,
    icePlans,
    iceRatio,
  };
}
function produce(s, b, plans, dispatch) {
  const e = s.e,
    m = s.month,
    newHydrogen = [];
  for (const plan of plans) {
    const a = plan.asset,
      r = dispatch.industryRatio,
      ground = account(b.id, "ground", "ore"),
      mined = Math.min(q(plan.mineU * r), s.book.get(ground));
    if (mined)
      s.book.move(
        ground,
        account(b.id, a.owner, "ore"),
        mined,
        "ore-extraction",
      );
    const availableOreQ = s.book.get(account(b.id, a.owner, "ore"));
    const processed = Math.min(q(plan.processU * r), availableOreQ),
      hrProcessed = plan.reduction422
        ? Math.min(processed, Math.floor(plan.reductionProcessU422 * r * 1000))
        : 0,
      baseAlloy = Math.floor(processed * s.tech.yieldFraction),
      hrBaseAlloy = Math.floor(hrProcessed * s.tech.yieldFraction),
      hrAlloy = plan.reduction422
        ? Math.floor(
            hrProcessed * s.tech.yieldFraction * (1 + s.r422.yieldBonus),
          )
        : 0,
      yieldGain = hrAlloy - hrBaseAlloy,
      alloy = baseAlloy + yieldGain,
      residue = processed - alloy;
    if (plan.reduction422) {
      b.flow.yieldBonusAlloyU += yieldGain / 1000;
      b.flow.baselineYieldAlloyU += baseAlloy / 1000;
      const capacity = plan.fullProcessCapacity422 * r;
      if (capacity > 0) {
        b.flow.smeltEligibleMonth422 = 1;
        if (q(capacity) > availableOreQ) {
          b.flow.oreLimitedMonth422 = 1;
          b.flow.oreLimitedAssetCount422++;
        }
      }
    }
    if (processed) {
      s.book.sink(account(b.id, a.owner, "ore"), processed, "smelting-ore");
      s.book.source(account(b.id, a.owner, "alloy"), alloy, "smelting-alloy");
      s.book.source(
        account(b.id, a.owner, "residue"),
        residue,
        "smelting-residue",
      );
    }
    const requestedH = plan.reduction422
        ? reductionHydrogenQ422(hrAlloy, s.r422) / 1000
        : plan.hydrogenU * r,
      ownBefore = b.h422[a.owner].usedOwnQ,
      hydrogen = consume(
        s,
        b.id,
        a.owner,
        "hydrogen",
        requestedH,
        plan.reduction422 ? "reduction-hydrogen" : "smelting-hydrogen",
      ),
      ownReduction = (b.h422[a.owner].usedOwnQ - ownBefore) / 1000,
      conventionalH = plan.reduction422
        ? consume(
            s,
            b.id,
            a.owner,
            "hydrogen",
            (plan.conventionalHydrogenU422 ?? 0) * r,
            "smelting-hydrogen",
          )
        : 0;
    b.flow.hydrogenUsedU += hydrogen + conventionalH;
    if (s.capture422 && a.owner === "government") {
      b.flow.governmentIndustryEnergy422GWh += plan.energyGWh * r;
      b.flow.governmentIndustryHydrogen422U += hydrogen + conventionalH;
    }
    if (plan.reduction422) {
      if (q(hydrogen) !== q(requestedH))
        throw Error("Unfunded reduction output");
      const mass = reductionMass422(q(hydrogen));
      s.book.sink(
        account(b.id, a.owner, "residue"),
        mass.residueOxygenQ,
        "reduction-ore-oxygen",
      );
      s.book.source(
        account(b.id, a.owner, "water"),
        mass.waterQ,
        "reduction-water",
      );
      b.h422[a.owner].waterQ += mass.waterQ;
      b.observed422[a.owner].waterQ += mass.waterQ;
      b.observed422[a.owner].baseHydrogenQ -= mass.hydrogenQ;
      b.flow.reductionWaterU += mass.waterQ / 1000;
      b.flow.reductionOxygenResidueU += mass.residueOxygenQ / 1000;
      b.flow.reductionAlloyU += hrAlloy / 1000;
      b.flow.conventionalFallbackAlloyU += (alloy - hrAlloy) / 1000;
      b.flow.reductionHydrogenU += hydrogen;
      b.flow.reductionOwnHydrogenU += ownReduction;
      b.flow.reductionTime422 += (plan.reductionTime422 ?? 0) * a.sets * r;
      b.flow.smelterTime422 += a.smeltCompletedMonth <= m ? a.sets : 0;
      if (a.owner === "private")
        b.flow.privateReductionAlloyU += hrAlloy / 1000;
    }
    b.flow.minedU += mined / 1000;
    b.flow.processedU += processed / 1000;
    b.flow.residueU += residue / 1000;
    b.flow.producedU += alloy / 1000;
    b.flow[
      a.owner === "government" ? "governmentProducedU" : "privateProducedU"
    ] += alloy / 1000;
    a.lastUtilization =
      plan.baseProcess > 0
        ? Math.min(1, processed / 1000 / plan.baseProcess)
        : 0;
    // Sources and facilities are explicitly co-located. One source is allocated
    // to a single owner, and all withdrawals use the same finite reserve account.
    const sources = b.reference.sources.filter((x) => x.oreEligible);
    const assigned = sources.filter((_, i) =>
      a.owner === "government"
        ? i === 0
        : i > 0 ||
          !b.assets.some(
            (x) =>
              x.kind === "industry" &&
              x.owner === "government" &&
              x.completedMonth <= m,
          ),
    );
    if (mined > 0 && !(s.scenario === "E4" && m >= 48 && m < 84))
      for (const source of assigned) {
        if (newHydrogen.some((x) => x.sourceId === source.sourceId)) continue;
        const u =
            s.inputs.contract.byproductMaximumU *
            Math.min(1, mined / 1000 / 5000, a.sets),
          n = Math.min(
            q(u),
            s.book.get(account(b.id, "ground", source.sourceId)),
          );
        if (n) {
          s.book.sink(
            account(b.id, "ground", source.sourceId),
            n,
            "finite-hydrogen-recovery",
          );
          newHydrogen.push({ owner: a.owner, n, sourceId: source.sourceId });
          b.flow.hydrogenByproductU += n / 1000;
        }
      }
  }
  lifeWaterUse43(s, b);
  for (const h of dispatch.hPlans) {
    const a = h.asset,
      requested = h.units * h.actualRatio,
      existingWater = stock(s, b.id, a.owner, "water"),
      intake = b.reference.waterTiles.includes(a.hostTile)
        ? Math.min(e.waterIntakeU, Math.max(0, requested - existingWater))
        : 0;
    // Surface water is a declared finite per-month intake, not an ore/H deposit.
    if (b.reference.waterTiles.includes(a.hostTile) && intake) {
      s.book.source(
        account(b.id, a.owner, "water"),
        q(intake),
        "metered-surface-water-intake",
      );
      b.flow.waterIntakeU += q(intake) / 1000;
    }
    const u = Math.min(requested, stock(s, b.id, a.owner, "water")),
      n = Math.min(q(u), s.book.get(account(b.id, a.owner, "water")));
    a.lastUtilization = n / 1000 / Math.max(0.001, a.capacityU);
    if (n) {
      consume(s, b.id, a.owner, "water", n / 1000, "electrolysis-water");
      s.book.source(account(b.id, a.owner, "oxygen"), n, "electrolysis-oxygen");
      b.flow.oxygenProducedU43 += n / 1000;
      newHydrogen.push({ owner: a.owner, n, electrolysis: true });
      b.flow.hydrogenElectrolysisU += n / 1000;
      b.flow.electrolysisGWh += (n / 1000) * e.electrolysisGWhPerU;
      const recycleQ = s.r422?.enabled
        ? Math.min(n, b.h422[a.owner].waterQ)
        : 0;
      if (recycleQ) {
        b.h422[a.owner].waterQ -= recycleQ;
        b.flow.waterRecycledU += recycleQ / 1000;
      }
      const variableC = s.r422?.enabled
        ? (n / 1000) *
            e.hydrogenVariableCPerU *
            (1 - s.r422.waterIntakeCostShare) +
          Math.min(n / 1000, intake) *
            e.hydrogenVariableCPerU *
            s.r422.waterIntakeCostShare
        : (n / 1000) * e.hydrogenVariableCPerU;
      b.flow.waterIntakeServicesC += s.r422?.enabled
        ? Math.min(n / 1000, intake) *
          e.hydrogenVariableCPerU *
          s.r422.waterIntakeCostShare *
          s.priceIndex
        : 0;
      b.flow.waterRecycleAvoidedC +=
        (recycleQ / 1000) *
        e.hydrogenVariableCPerU *
        (s.r422?.waterIntakeCostShare ?? 0) *
        s.priceIndex;
      b.flow.hydrogenDirectC += pay(
        s,
        b.id,
        a.owner,
        "household",
        variableC * s.priceIndex,
        "hydrogen-variable-services",
      );
    }
  }
  lifeOxygenUse43(s, b);
  produceIce43(s, b, dispatch);
  // Closing-only H output. It cannot fuel this month's reactor boot or smelter.
  for (const h of newHydrogen) {
    s.book.source(
      account(b.id, h.owner, "hydrogen"),
      h.n,
      h.electrolysis ? "electrolysis-hydrogen" : "byproduct-hydrogen",
    );
    b.flow.hydrogenProducedU += h.n / 1000;
    if (s.r422.enabled && !h.electrolysis)
      b.observed422[h.owner].byproductHQ += h.n;
    if (s.r422?.enabled) {
      b.h422[h.owner].ownQ += h.n;
      b.h422[h.owner].producedQ += h.n;
    }
  }
  b.hydrogenLastUseU = b.flow.hydrogenUsedU;
  b.productionMonth422 = s.month;
}
function marketAndInvestment(s, b) {
  const p = s.p,
    e = s.e,
    m = s.month,
    grow = b.gdp / p.bodies[b.id].annualGDP;
  let demand =
    b.backgroundAlloyU *
    grow *
    Math.pow(b.alloyPrice / p.baseAlloyPrice, -p.demandElasticity);
  if (
    shockActive41(s.scenario, m, s.stress41) &&
    (!mediumStress41(s.scenario) || b.id === "earth")
  )
    demand *= s.stress41.demandMultiplier;
  b.flow.generalAlloyDemandU = demand;
  const available = stock(s, b.id, "private", "alloy"),
    cash = stock(s, b.id, "household", "C"),
    bought = Math.min(demand, available, cash / (b.alloyPrice * s.priceIndex));
  pay(
    s,
    b.id,
    "household",
    "private",
    bought * b.alloyPrice * s.priceIndex,
    "general-alloy-demand",
  );
  consume(s, b.id, "private", "alloy", bought, "general-alloy-consumption");
  b.flow.generalAlloyConsumedU = bought;
  b.flow.unmetAlloyU = Math.max(0, demand - bought);
  if (s.scenario === "S1-sell") {
    const excess = Math.max(
        0,
        stock(s, b.id, "government", "alloy") - p.initialAlloyU,
      ),
      n = Math.min(
        excess * 0.5,
        Math.max(0, b.alloyTargetU - stock(s, b.id, "private", "alloy")),
      );
    const sale = trade(s.book, {
      planet: b.id,
      from: "government",
      to: "private",
      resource: "alloy",
      amountU: n,
      priceC: b.alloyPrice * s.priceIndex,
      tag: "government-alloy-sale",
    });
    b.flow.governmentSoldU += sale.amountU;
    b.flow.governmentSaleC += sale.cashC;
  }
  const totalDemand =
      demand + b.flow.upkeepRequiredU + b.privateCapitalU * grow,
    inventory = stock(s, b.id, "private", "alloy");
  b.alloyTargetU = (totalDemand * p.inventoryDays) / 30;
  b.demandHistory.push(totalDemand);
  b.outputHistory.push(b.flow.privateProducedU);
  const gap = (b.alloyTargetU - inventory) / Math.max(1, b.alloyTargetU),
    price =
      b.alloyPrice *
      Math.exp(
        p.priceAdjustment * clamp(gap, -2, 2) -
          p.priceReversion * Math.log(b.alloyPrice / p.baseAlloyPrice),
      );
  // The numerical quote guard is not a scarcity cure. Unfilled U/GWh orders
  // and health losses remain explicit at any bounded price.
  b.alloyPrice = clamp(price, p.baseAlloyPrice * 0.05, p.baseAlloyPrice * 20);
  const hstock =
      stock(s, b.id, "private", "hydrogen") +
      stock(s, b.id, "government", "hydrogen"),
    htarget = Math.max(
      10,
      (s.r422?.enabled
        ? Math.max(
            b.hydrogenDesiredUseU ?? 0,
            sum(Object.values(b.h422Potential ?? {})),
          )
        : (b.hydrogenDesiredUseU ?? 0)) * e.hydrogenInventoryMonths,
    );
  b.hydrogenPrice = clamp(
    b.hydrogenPrice *
      Math.exp(
        e.hydrogenPriceAdjustment * clamp((htarget - hstock) / htarget, -2, 2) -
          e.hydrogenPriceReversion *
            Math.log(b.hydrogenPrice / s.r.hydrogenPrice),
      ),
    0.02,
    40,
  );
  b.hydrogenTargetU = htarget;
  // Endogenous electricity quote derives from existing GDP spending, not an
  // aluminium-heavy industrial load or an arbitrary scarcity target.
  b.powerPriceC =
    ((e.electricityGDPShare * p.bodies.earth.annualGDP) /
      (e.earthBaseGW * 8760)) *
    Math.exp(e.powerScarcityElasticity * clamp(-b.reserveFraction, 0, 3));
  if (b.id === "earth" && m % 3 === 0) {
    const cap = b.assets
        .filter(
          (a) =>
            a.kind === "industry" &&
            a.owner === "private" &&
            a.state !== "dismantled",
        )
        .reduce((v, a) => v + a.sets, 0),
      output = Math.max(
        1,
        mean(b.outputHistory.slice(-p.privateForecastMonths)),
      ),
      recent = mean(b.demandHistory.slice(-p.privateForecastMonths));
    const creditBasisC =
        (FACILITY_TYPES[MINING].creditC * e.mineRatio +
          FACILITY_TYPES[SMELTING].creditC) *
        e.privateScale,
      alloyBasisU =
        (FACILITY_TYPES[MINING].alloyU * e.mineRatio +
          FACILITY_TYPES[SMELTING].alloyU) *
        e.privateScale;
    const investment =
      creditBasisC +
      alloyBasisU * b.alloyPrice +
      FACILITY_TYPES[SMELTING].hydrogenU * b.hydrogenPrice;
    const full = industryPlan(
      s,
      b,
      {
        sets: 1,
        owner: "private",
        mineRatio: e.mineRatio,
        completedMonth: -100,
        smeltCompletedMonth: -100,
        health: 1,
        state: "active",
      },
      m,
      { ore: { private: 0 }, hydrogen: { private: Infinity } },
    );
    const unitCost = explicitIndustryUnitCost({
      investmentC: investment,
      creditBasisC,
      alloyBasisU,
      outputU: full.alloyU,
      energyGWh: full.energyGWh,
      hydrogenU: full.hydrogenU,
      amortizationMonths: p.privateAmortizationYears * 12,
      directAnnual: e.directAnnual,
      upkeepAnnual: s.r["upkeep_" + b.id],
      alloyPrice: b.alloyPrice,
      hydrogenPrice: b.hydrogenPrice,
      powerPrice: b.powerPriceC,
    });
    b.industryUnitCostC = unitCost;
    const margin = Math.max(0, b.alloyPrice / unitCost - 1 - p.requiredMargin),
      inventoryGap = clamp(
        (b.alloyTargetU - inventory) / Math.max(1, b.alloyTargetU),
        -1,
        1,
      );
    const growth =
      p.expansionBeta * Math.max(0, margin + inventoryGap) +
      p.privateDepreciation / 12;
    const sets = Math.min(
      cap * 0.03,
      cap * growth * 3 * Math.max(0.25, recent / output),
    );
    if (sets > 0.001) orderIndustry(s, b, "private", sets);
    const hCapacity = sum(
        b.assets
          .filter(
            (a) =>
              a.kind === "electrolyzer" &&
              a.owner === "private" &&
              a.state !== "dismantled",
          )
          .map((a) => a.capacityU),
      ),
      hCost = hydrogenCost(p, e, s.r, {
        planet: b.id,
        packaged: false,
      }).totalCPerU;
    b.hydrogenUnitCostC = hCost;
    const internal = s.r422?.enabled
        ? internalHydrogen422(s, b, "private")
        : b.hydrogenPrice,
      hNeed = s.r422?.enabled
        ? Math.max(b.hydrogenDesiredUseU, b.h422Potential?.private ?? 0)
        : b.hydrogenDesiredUseU;
    if (internal > hCost * (1 + p.requiredMargin) && hNeed > hCapacity)
      orderHydrogen(
        s,
        b,
        "private",
        Math.min(2, (hNeed - hCapacity) / e.hydrogenModuleU),
      );
    const scaled = powerScale(e, s.r, "fission", "large", m),
      modules = POWER_TYPES.fission.maxModules,
      creditC = scaled.base.creditC + scaled.module.creditC * modules,
      alloyU = scaled.base.alloyU + scaled.module.alloyU * modules,
      electricOutput = scaled.ratedGW * modules * e.fissionAvailability * 730,
      net =
        electricOutput * (b.powerPriceC - e.fissionFuelCPerGWh) -
        (creditC * e.directAnnual) / 12 -
        (alloyU * s.r["upkeep_" + b.id] * b.alloyPrice) / 12;
    const profitable =
        net > 0 &&
        (creditC + alloyU * b.alloyPrice) / (net * 12) <
          e.privatePowerHorizonYears,
      pending = b.complexes.some(
        (c) =>
          c.owner === "private" &&
          (c.modules.length < c.wanted ||
            b.assets.some(
              (a) =>
                a.complexId === c.id &&
                a.kind === "powerModule" &&
                a.completedMonth > m,
            )),
      );
    if (b.reserveFraction < e.gridReserve * 0.6 && profitable && !pending)
      orderPowerComplex(s, b.id, "fission", modules, { owner: "private" });
  }
}
function fiscal(s) {
  const p = s.p,
    m = s.month,
    war =
      ["S3-debt", "S3-money"].includes(s.scenario) &&
      m >= p.warStartMonth &&
      m < p.warStartMonth + p.warDurationMonths;
  for (const b of Object.values(s.planets)) {
    const tax =
        (b.gdp *
          s.priceIndex *
          effectiveTax43({
            body: b.id,
            month: m,
            foundingMonth: b.foundingMonth43,
            ...s.tax43,
            sectorId: s.tax43.sectors[b.id],
            holidayYears: s.r43.holidayYears,
          })) /
        12,
      budget = tax * (war ? p.warStrategyShare : p.strategyShare);
    // Tax and fixed civilian expenditure are separate paired transfers. Their
    // difference, not a fresh-money source, funds the discretionary treasury.
    let remaining = tax;
    for (const owner of ["household", "private"]) {
      const paid = pay(s, b.id, owner, "government", remaining, "tax");
      remaining -= paid;
    }
    pay(
      s,
      b.id,
      "government",
      "household",
      Math.max(0, tax - budget - remaining),
      "fixed-civilian-spending",
    );
    const f = s.book.fiscal43[b.id];
    b.flow.budgetC =
      (f.taxQ + (f.byTag[b.id + ":fixed-civilian-spending"] ?? 0)) / 1000;
  }
  const earth = s.planets.earth,
    interest = (s.debtC * p.debtInterestRate) / 12;
  if (stock(s, "earth", "government", "C") < interest)
    borrow(s, earth, interest - stock(s, "earth", "government", "C"));
  earth.flow.mandatoryC += pay(
    s,
    "earth",
    "government",
    "household",
    interest,
    "bond-interest",
  );
  if (war && m < p.warStartMonth + p.warPurchaseMonths) {
    const u = p.warAlloyU / p.warPurchaseMonths,
      cost = u * earth.alloyPrice * s.priceIndex;
    if (s.scenario === "S3-money")
      issue(
        s,
        "earth",
        "government",
        cost * p.warMonetizationFraction,
        "explicit-war-issuance",
      );
    else
      borrow(
        s,
        earth,
        Math.max(0, cost - stock(s, "earth", "government", "C")),
      );
    purchase(s, earth, "government", "alloy", u);
    earth.flow.warAlloyU += consume(
      s,
      "earth",
      "government",
      "alloy",
      u,
      "war-procurement-consumption",
    );
  }
  if (["S2", "S3-debt", "S3-money", "S4"].includes(s.scenario)) {
    const mature = s.ships.filter((x) => x.completedMonth <= m),
      cost =
        (sum(mature.map((x) => ECON_SHIPS[x.kind].creditC)) *
          p.shipMaintenanceRate) /
        12;
    earth.flow.mandatoryC += pay(
      s,
      "earth",
      "government",
      "household",
      cost * s.priceIndex,
      "ship-maintenance-services",
    );
    if (
      s.shipQueue.filter((x) => x.completedMonth > m).length < p.shipyardSlots
    ) {
      const kind = s.ships.length % 3 === 0 ? "support" : "explorer",
        def = ECON_SHIPS[kind];
      if (
        constructionPurchase(
          s,
          earth,
          "government",
          { creditC: def.creditC, alloyU: def.alloyU },
          "ship",
        )
      ) {
        const ship = {
          kind,
          completedMonth: m + def.months,
          alloyBasisQ: q(def.alloyU),
        };
        s.ships.push(ship);
        s.shipQueue.push(ship);
        earth.flow.shipOrders++;
      }
    }
  }
}
function accrueTotals(b) {
  for (const [k, v] of Object.entries(b.flow))
    if (typeof v === "number" && k !== "healthMin") b.total[k] += v;
  b.total.healthMin = Math.min(b.total.healthMin, b.flow.healthMin);
  for (const [kind, v] of Object.entries(b.flow.maintenanceByKind)) {
    const dst = (b.total.maintenanceByKind[kind] ??= {
      requiredU: 0,
      paidU: 0,
      directC: 0,
      pausedRequiredU: 0,
    });
    for (const k of Object.keys(v)) dst[k] += v[k];
  }
}
export function round43Snapshot(s) {
  const row = round4Snapshot(s);
  if (s.round41Off) return row;
  row.round41 = Object.fromEntries(
    Object.values(s.planets).map((b) => [
      b.id,
      {
        ...b.shortage41,
        triageApplied: Boolean(s.r41.triageEnabled && b.shortage41.active),
        ...b.policyStats41,
        deferredU: sum(b.assets.map((a) => (a.lifeDeferredQ ?? 0) / 1000)),
        accruedU: sum(b.assets.map((a) => (a.lifeAccruedQ ?? 0) / 1000)),
        repaidU: sum(b.assets.map((a) => (a.lifeRepaidQ ?? 0) / 1000)),
        lifeHealthMin: Math.min(
          1,
          ...b.assets
            .filter((a) => upkeepPriority(a) === 0 && a.state !== "dismantled")
            .map((a) => a.health),
        ),
      },
    ]),
  );
  row.round422 = Object.fromEntries(
    Object.values(s.planets).map((b) => [b.id, snapshot422(s, b)]),
  );
  row.treasuryC = s.book.get(NATIONAL_C43) / 1000;
  row.round43 = {
    treasuryC: row.treasuryC,
    nationalBudgetC: sum(Object.values(s.planets).map((b) => b.flow.budgetC)),
    fiscal: structuredClone(s.book.fiscal43),
    cumulativeFiscal: structuredClone(s.book.totalFiscal43),
    bodies: Object.fromEntries(
      Object.values(s.planets).map((b) => [b.id, snapshot43(s, b)]),
    ),
  };
  for (const b of Object.values(row.planets)) b.governmentC = null;
  return row;
}
export function assertRound43Economy(s) {
  assertRound4Economy(s);
  if (!s.round41Off) assertPolicy41(s);
  assert422Economy(s);
  assert43(s);
  return true;
}
export function tickRound43Economy(s) {
  if (s.round41Off) throw Error("43 requires frozenR4.1 profile");
  s.book.begin43(s.month);
  const p = s.p,
    e = s.e,
    m = s.month;
  for (const b of Object.values(s.planets)) {
    b.flow = baseFlow();
    b.observed422 = {
      government: { waterQ: 0, baseHydrogenQ: 0, byproductHQ: 0 },
      private: { waterQ: 0, baseHydrogenQ: 0, byproductHQ: 0 },
    };
    for (const owner of ["government", "private"]) {
      const loss = consume(
        s,
        b.id,
        owner,
        "hydrogen",
        stock(s, b.id, owner, "hydrogen") * s.r.boiloffMonthly,
        "hydrogen-boiloff",
      );
      b.flow.boiloffU += loss;
    }
    const shock = (p.productivityShock * normal(s.seed, m)) / Math.sqrt(12);
    b.potentialGDP *=
      Math.pow(1 + p.productivityGrowth, 1 / 12) *
      Math.exp(shock) *
      (b.id === "earth"
        ? Math.pow(1 + p.earthPopulationGrowth, 1 / 12)
        : Math.pow(1 + p.colonyPopulationGrowth, 1 / 12));
    b.population *= Math.pow(
      1 +
        (b.id === "earth" ? p.earthPopulationGrowth : p.colonyPopulationGrowth),
      1 / 12,
    );
    b.powerPriceC =
      ((e.electricityGDPShare * p.bodies.earth.annualGDP) /
        (e.earthBaseGW * 8760)) *
      Math.exp(
        e.powerScarcityElasticity * clamp(-(b.reserveFraction ?? 0), 0, 3),
      );
  }
  fiscal(s);
  colonyDecisions43(s);
  scenarioEvents(s);
  aggregatePrivatePower(s);
  round4Events(s);
  cutPreparation422(s);
  for (const b of Object.values(s.planets)) {
    cutLoss422(s, b);
    if (s.r422?.enabled) prepareDispatch422(s, b);
  }
  for (const b of Object.values(s.planets)) {
    completeDismantles(s, b);
    lifecycleDecisions(s, b);
    planColonySupply(s, b);
  }
  for (const b of Object.values(s.planets)) {
    const observation = {
      freeU: sum(
        ["government", "private"].map((owner) =>
          stock(s, b.id, owner, "alloy"),
        ),
      ),
      needU: maintenanceNeed41(b, s.e, s.r, m),
      month: m,
    };
    b.shortage41 = updateShortage41(b.shortage41, observation, s.r41);
    if (b.shortage41.changed)
      s.relief41.mode.push({ planet: b.id, month: m, ...b.shortage41 });
    const purchase = emergencyMarket41(s, b, s.r41);
    if (purchase) {
      s.relief41.market.push(purchase);
      b.policyStats41.marketU += purchase.amountU;
      b.policyStats41.marketC += purchase.cashC;
      b.flow.purchasesC += purchase.cashC;
    }
  }
  planEmergencyImports41(s);
  // When imports exist, settle their actual source grids first in this same
  // month; delivered material is then available for Earth's maintenance.
  const order = s.shipments.some((x) => x.emergency41)
    ? [s.planets.moon, s.planets.mars, s.planets.earth]
    : Object.values(s.planets);
  for (const b of order) {
    if (s.r422.enabled) {
      openingPurchases422(s, b);
      for (const plan of industryPlans(s, b, m))
        plan.asset.activeFraction = plan.capacityRatio422 ?? 1;
    }
    upkeepRound41(s, b);
    if (m % 12 === 0) mergeMaturePrivateCohorts(b, m);
    let plans = industryPlans(s, b, m);
    if (!s.r422.enabled) {
      openingHydrogenPurchases(s, b, plans);
      plans = industryPlans(s, b, m);
    }
    prepareLifeWater43(s, b);
    const dispatch = monthlyPower(s, b, plans);
    produce(s, b, plans, dispatch);
    const materialFactor = b.demandHistory.length
      ? clamp(
          stock(s, b.id, "private", "alloy") /
            Math.max(1, b.demandHistory.at(-1)),
          0.1,
          1,
        )
      : 1;
    const powerFactor = clamp(
      (b.cityUtilization ?? 1) * (1 - e.industryGDPWeight) +
        dispatch.industryRatio * e.industryGDPWeight,
      0.05,
      1,
    );
    b.gdp =
      b.potentialGDP *
      powerFactor *
      (1 - p.supplyConstraintStrength * (1 - materialFactor));
    waterMarket43(s, b);
    marketAndInvestment(s, b);
    // Capital replacement wears actual cohorts, not an extra legacy operating
    // proxy. Pipeline additions are paid before entry and readiness ramps.
    for (const a of b.assets.filter(
      (a) =>
        a.kind === "industry" &&
        a.owner === "private" &&
        a.state !== "dismantled" &&
        a.completedMonth <= m,
    ))
      a.sets *= 1 - p.privateDepreciation / 12;
    // Aggregate residual wages/dividends recycle existing private liquidity;
    // this is distribution of GDP, not currency creation or extra output.
    const turnover = (b.gdp * s.priceIndex) / 12;
    pay(
      s,
      b.id,
      "household",
      "private",
      turnover * 0.35,
      "existing-services-turnover",
    );
    const reserve = b.id === "earth" ? b.gdp * s.priceIndex * 0.06 : 10;
    pay(
      s,
      b.id,
      "private",
      "household",
      Math.max(0, stock(s, b.id, "private", "C") - reserve),
      "wages-dividends-distribution",
    );
    if (s.r422.enabled)
      for (const owner of ["government", "private"])
        b.history422[owner].push({ month: m, ...b.observed422[owner] });
    if (s.month - b.foundingMonth43 >= s.r43.lifeGraceMonths) {
      if (
        b.flow.lifeWaterDemandU > 0 &&
        b.flow.lifeWaterServedU / b.flow.lifeWaterDemandU < 0.99
      )
        b.life43.waterUnmetMonths++;
      if (
        b.flow.oxygenLifeDemandU43 > 0 &&
        b.flow.oxygenLifeServedU43 / b.flow.oxygenLifeDemandU43 < 0.99
      )
        b.life43.oxygenUnmetMonths++;
    }
    accrueTotals(b);
  }
  s.previousGDP = s.realGDP;
  s.realGDP = sum(Object.values(s.planets).map((b) => b.gdp));
  // Growth-linked issuance is explicit. The deflation arm burns available cash,
  // never uses a negative balance; the exact MV=PY identity uses closing M.
  const desired =
      s.moneyQ *
      (s.realGDP / s.previousGDP) *
      Math.pow(1 + p.targetInflation, 1 / 12),
    change = Math.round(desired - s.moneyQ);
  if (change >= 0)
    issue(s, "earth", "household", change / 1000, "normal-growth-issuance");
  else {
    let need = -change;
    for (const b of Object.values(s.planets))
      for (const owner of ["household", "private", "government"]) {
        const key = account(b.id, owner),
          take = Math.min(need, s.book.get(key));
        if (take) {
          s.book.sink(key, take, "normal-growth-burn");
          need -= take;
          s.burnedC += take / 1000;
        }
      }
  }
  s.moneyQ = s.book.sum((k) => k.endsWith("/C"));
  s.priceIndex = ((s.moneyQ / 1000) * p.velocity) / s.realGDP;
  s.month++;
  assertRound43Economy(s);
  return round43Snapshot(s);
}
export function simulateRound43Economy(p, e, inputs, options = {}) {
  if (options.round43?.enabled === false)
    return simulate422(p, e, inputs, {
      ...options,
      round422: hydrogenPolicy43(options.round422),
    });
  const s = createRound43Economy(p, e, inputs, options),
    rows = [round43Snapshot(s)];
  for (let i = 0; i < (options.months ?? 240); i++)
    rows.push(tickRound43Economy(s));
  return { state: s, rows };
}

function scheduleShipment(
  s,
  to,
  resourceId,
  u,
  { fromOwner = "government", toOwner = "government", priceC = 0 } = {},
) {
  const amountQ = q(u);
  if (!amountQ) return;
  const pending = s.shipments.find(
    (x) =>
      x.to.planet === to &&
      x.resourceId === resourceId &&
      x.from.owner === fromOwner &&
      x.to.owner === toOwner,
  );
  if (pending) {
    pending.amountQ = Math.max(pending.amountQ, amountQ);
    return;
  }
  s.shipments.push({
    from: { planet: "earth", owner: fromOwner },
    to: { planet: to, owner: toOwner },
    resourceId,
    amountQ,
    marketPriceC: priceC,
    month: s.month,
  });
}
function runShipments(s, b, budgetGWh, reservedHydrogen = {}) {
  const budget = { remainingGWh: Math.max(0, budgetGWh), usedGWh: 0 };
  for (const request of [...s.shipments].filter(
    (x) => x.from.planet === b.id,
  )) {
    try {
      if (request.emergency41) {
        const bounded = protectedExportQ41(
          s,
          b,
          request.from.owner,
          request.amountQ,
          s.r41,
        );
        if (!bounded.amountQ) continue;
        request.amountQ = bounded.amountQ;
        request.sourceReserveQ = bounded.reserveQ;
        request.sourcePlanetReserveQ = bounded.planetReserveQ;
      }
      if (
        request.resourceId === "hydrogen" &&
        request.amountQ / 1000 >
          Math.max(
            0,
            stock(s, b.id, request.from.owner, "hydrogen") -
              (reservedHydrogen[request.from.owner] ?? 0),
          )
      )
        continue;
      const record = s.book.withBody43(request.to.planet, () =>
        transferRound4(s.book, request, s.r, {
          powerBudget: budget,
          priceIndex: s.priceIndex,
          recovery: s.packageRecovery,
          trace: s.shipmentHistory,
        }),
      );
      if (s.r422?.enabled && request.resourceId === "hydrogen")
        takeOwn422(
          s,
          b.id,
          request.from.owner,
          request.amountQ,
          "exportedOwnQ",
        );
      if (request.emergency41) {
        record.sourceAfterQ = s.book.get(
          account(b.id, request.from.owner, "alloy"),
        );
        record.sourcePlanetAfterQ = sum(
          ["government", "private"].map((owner) =>
            s.book.get(account(b.id, owner, "alloy")),
          ),
        );
        s.relief41.imports.push(record);
        const t = s.planets[request.to.planet].policyStats41;
        t.importU += record.amountQ / 1000;
        t.importGoodsC += record.goodsPaymentC;
        t.importServiceC += record.servicesC;
        t.importEnergyGWh += record.energyGWh;
      }
      b.flow.packagingC += record.servicesC;
      if (request.from.owner === "government")
        b.flow.packagingGovernmentGWh += record.energyGWh;
      b.flow.shippingAlloyU +=
        request.resourceId === "alloy" ? request.amountQ / 1000 : 0;
      b.flow.shippingHydrogenU +=
        request.resourceId === "hydrogen" ? request.amountQ / 1000 : 0;
      s.shipments.splice(s.shipments.indexOf(request), 1);
      s.events.push({ event: "paid-SCU-shipment", month: s.month, ...record });
    } catch (error) {
      if (!/unavailable/.test(error.message)) throw error;
    }
  }
  b.flow.packagingGWh += budget.usedGWh;
  return budget.usedGWh;
}
export function pauseRound4(s, b, a) {
  if (
    a.completedMonth > s.month ||
    ["paused", "dismantling", "dismantled"].includes(a.state)
  )
    return false;
  a.state =
    a.kind === "powerModule" && a.type === "fusion" ? "coldStopped" : "paused";
  a.manualPause = true;
  a.progressHours = 0;
  a.startPaid = false;
  a.pausedMonths = 0;
  s.events.push({
    event: "facility-paused",
    month: s.month,
    planet: b.id,
    owner: a.owner,
    asset: a.id,
  });
  return true;
}
export function restartRound4(s, b, a) {
  if (!["paused", "coldStopped"].includes(a.state)) return false;
  if (a.kind === "powerModule" && a.type === "fusion") {
    a.state = "coldStopped";
    a.manualPause = false;
    return true;
  }
  const cost = restartCharge(a, s.r).creditC * s.priceIndex;
  if (stock(s, b.id, a.owner, "C") < cost) return false;
  const paid = pay(s, b.id, a.owner, "household", cost, "facility-restart:C");
  b.flow.restartC += paid;
  a.state = "active";
  a.manualPause = false;
  a.restartMonth = s.month;
  a.pausedMonths = 0;
  a.lossMonths = 0;
  s.events.push({
    event: "facility-restart",
    month: s.month,
    planet: b.id,
    asset: a.id,
    owner: a.owner,
    creditC: paid,
    miningHours: ["industry", "iceMine43"].includes(a.kind) ? 48 : 0,
    smelterHeatHours: a.kind === "industry" ? 96 : 0,
  });
  return true;
}
export function dismantleRound4(s, b, a, { governmentPolicy = false } = {}) {
  if (a.owner === "government" && !governmentPolicy) return false;
  const quote = dismantleQuote(a, s.r, s.month),
    cost = quote.creditC * s.priceIndex;
  if (stock(s, b.id, a.owner, "C") < cost) return false;
  b.flow.dismantleC += pay(
    s,
    b.id,
    a.owner,
    "household",
    cost,
    "dismantling:C",
  );
  a.state = "dismantling";
  a.dismantleEnd = quote.endMonth;
  a.salvageU = quote.returnedU;
  s.events.push({
    event: "dismantling-ordered",
    month: s.month,
    planet: b.id,
    owner: a.owner,
    asset: a.id,
    ...quote,
  });
  return true;
}
function completeDismantles(s, b) {
  for (const a of b.assets.filter(
    (a) => a.state === "dismantling" && a.dismantleEnd <= s.month,
  )) {
    const amountQ = q(a.alloyBasisU),
      returnedQ = Math.floor(amountQ * s.r.salvageFraction),
      capital = account(b.id, a.owner, "capitalAlloy");
    if (returnedQ)
      s.book.move(
        capital,
        account(b.id, a.owner, "alloy"),
        returnedQ,
        "dismantling-salvage",
      );
    if (amountQ - returnedQ)
      s.book.sink(capital, amountQ - returnedQ, "dismantling-loss");
    a.state = "dismantled";
    a.lastUtilization = 0;
    b.flow.salvageU += returnedQ / 1000;
    s.events.push({
      event: "dismantled",
      month: s.month,
      planet: b.id,
      owner: a.owner,
      asset: a.id,
      returnedU: returnedQ / 1000,
      lostU: (amountQ - returnedQ) / 1000,
    });
  }
}
export function expectedMargin41(s, b, a) {
  if (a.kind === "iceMine43") return iceMargin43(s, b, a);
  const bill = round4Bill(
    { ...a, state: "active", lastUtilization: 1 },
    s.e,
    s.r,
    b.id,
    s.month,
  );
  if (a.kind === "industry") {
    const plan = industryPlan(
      s,
      b,
      {
        ...a,
        state: "active",
        health: 1,
        cashFraction: 1,
        restartMonth: undefined,
      },
      s.month,
      { ore: { [a.owner]: 0 }, hydrogen: { [a.owner]: 1e15 } },
    );
    return (
      plan.alloyU * b.alloyPrice -
      bill.directC -
      bill.alloyU * b.alloyPrice -
      plan.energyGWh * b.powerPriceC -
      plan.hydrogenU * b.hydrogenPrice
    );
  }
  if (a.kind === "electrolyzer")
    return (
      a.capacityU *
      ((s.r422?.enabled
        ? internalHydrogen422(s, b, a.owner)
        : b.hydrogenPrice) -
        hydrogenCost(s.p, s.e, s.r, { planet: b.id, packaged: false })
          .totalCPerU)
    );
  if (a.kind === "legacyGrid")
    return b.population > 0
      ? Math.max(
          1,
          a.capacityGW * 730 * b.powerPriceC -
            bill.directC -
            bill.alloyU * b.alloyPrice,
        )
      : -bill.directC;
  if (a.kind === "powerModule" || a.kind === "privateGridExpansion")
    return (
      (a.ratedGW ?? a.capacityGW ?? POWER_TYPES[a.type]?.ratedGW ?? 0) *
        730 *
        (a.type === "solar"
          ? solarFactor(s, b, s.month)
          : s.e.fissionAvailability) *
        b.powerPriceC -
      bill.directC -
      bill.alloyU * b.alloyPrice
    );
  return 1;
}
function lifecycleDecisions(s, b) {
  if (!s.r.lifecycleEnabled) return;
  for (const a of b.assets) {
    if (a.completedMonth > s.month || a.state === "dismantled") continue;
    if (a.owner === "private" && s.r.privateLifecycleEnabled !== false) {
      const margin = expectedMargin41(s, b, a);
      a.lossMonths = margin < 0 ? (a.lossMonths ?? 0) + 1 : 0;
      if (["paused", "coldStopped"].includes(a.state)) a.pausedMonths++;
      const action = privateAction(a, s.r, {
        expectedMonthlyMargin: margin,
        restartCostC: restartCharge(a, s.r).creditC,
        month: s.month,
      });
      if (s.capturePrivateDecisions)
        s.relief41.privateDecisions.push({
          month: s.month,
          planet: b.id,
          asset: a.id,
          kind: a.kind,
          state: a.state,
          margin,
          lossMonths: a.lossMonths,
          pausedMonths: a.pausedMonths,
          threshold: s.r.privateDismantleMonths,
          action,
        });
      if (action === "pause") pauseRound4(s, b, a);
      else if (action === "restart") restartRound4(s, b, a);
      else if (action === "dismantle" && s.r.dismantleEnabled !== false)
        dismantleRound4(s, b, a);
    }
  }
}
function planColonySupply(s, b) {
  if (b.id === "earth" || s.scenario === "E4") return;
  if (
    s.r.publicColonyResponse &&
    ["S0", "S1", "S2", "E0", "E1"].includes(s.scenario) &&
    s.month % 12 === 0 &&
    !b.complexes.some((c) => c.autoResponse)
  ) {
    const legacy = b.assets.find((a) => a.kind === "legacyGrid"),
      demand = (b.population * s.e.colonyKWPerPerson) / 1e6;
    if (legacy.capacityGW < demand * (1 + s.e.gridReserve)) {
      const size = powerScale(s.e, s.r, "fission", "small", s.month),
        needed =
          size.base.alloyU +
          size.module.alloyU -
          stock(s, b.id, "government", "alloy");
      if (needed > 0) scheduleShipment(s, b.id, "alloy", needed);
      const c = orderPowerComplex(s, b.id, "fission", 1, { size: "small" });
      if (c) {
        c.autoResponse = true;
        s.events.push({
          event: "funded-public-colony-response",
          month: s.month,
          planet: b.id,
          demandGW: demand,
          ratedGW: size.ratedGW,
        });
      }
    }
  }
  // The existing lunar/Martian settlements have demand even in E0. Recurring
  // supply is paid, finite, packaged and may fail at the source.
  if (s.month % 3 !== 0) return;
  for (const owner of ["government", "private"]) {
    const generalTargetU =
      owner === "private"
        ? Math.max(b.initialGeneralAlloyU, b.flow.generalAlloyDemandU ?? 0) * 3
        : 0;
    const need = Math.max(
      0,
      generalTargetU +
        sum(
          b.assets
            .filter(
              (a) =>
                a.owner === owner &&
                a.completedMonth <= s.month &&
                a.state !== "dismantled",
            )
            .map((a) => round4Bill(a, s.e, s.r, b.id, s.month).alloyU),
        ) *
          12 -
        stock(s, b.id, owner, "alloy"),
    );
    const price = s.planets.earth.alloyPrice,
      affordable =
        owner === "private"
          ? (stock(s, b.id, owner, "C") * 0.8) /
            (price + 4 * (s.r.packCPerSCU + s.r.freightCPerSCU))
          : need,
      amount = Math.min(need, affordable);
    if (amount > 0.001)
      scheduleShipment(s, b.id, "alloy", amount, {
        fromOwner: owner,
        toOwner: owner,
        priceC: owner === "private" ? price : 0,
      });
  }
}
export function upgradeRound4Power(s, b, c, toSize) {
  const siteId = c.modules[0],
    fromSize = c.siteSizes?.[siteId] ?? c.size,
    quote = upgradeScale(s.e, s.r, c.type, fromSize, toSize, s.month),
    old = b.assets.filter(
      (a) =>
        (a.id === siteId || a.siteId === siteId) &&
        a.kind === "powerModule" &&
        a.state !== "dismantled",
    );
  if (!old.length) return false;
  const cost = {
    creditC: quote.base.creditC + quote.module.creditC,
    alloyU: (q(quote.base.alloyU) + q(quote.module.alloyU)) / 1000,
    hydrogenU: quote.buildHydrogenU,
  };
  if (!constructionPurchase(s, b, c.owner, cost, "same-site-upgrade"))
    return false;
  for (const a of old) {
    a.derateUntil = s.month + quote.months;
    a.derateFraction = quote.derateFraction;
  }
  addAsset(b, {
    kind: "powerBase",
    type: c.type,
    owner: c.owner,
    complexId: c.id,
    completedMonth: s.month + quote.months,
    state: "construction",
    creditBasisC: quote.base.creditC,
    alloyBasisU: quote.base.alloyU,
  });
  const a = addAsset(b, {
    kind: "powerModule",
    type: c.type,
    owner: c.owner,
    complexId: c.id,
    siteId: c.modules[0],
    size: toSize,
    ratio: quote.ratio,
    ratedGW: quote.addedGW,
    startC: quote.startC,
    completedMonth: s.month + quote.months,
    state: "construction",
    creditBasisC: quote.module.creditC,
    alloyBasisU: quote.module.alloyU,
    progressHours: 0,
    startPaid: false,
    starts: 0,
  });
  c.siteSizes ??= {};
  c.siteSizes[siteId] = toSize;
  s.events.push({
    event: "same-site-upgrade",
    month: s.month,
    planet: b.id,
    asset: a.id,
    ...quote,
  });
  return true;
}
function round4Events(s) {
  const m = s.month,
    c = s.scenario,
    b = s.planets.earth;
  if (["E2-S", "E9"].includes(c))
    for (const id of ["moon", "mars"]) {
      const body = s.planets[id];
      if (!body.complexes.length) {
        const def = powerScale(s.e, s.r, "fission", "small", m),
          modules = Math.min(
            POWER_TYPES.fission.maxModules,
            Math.max(
              1,
              Math.ceil(
                (((body.population * s.e.colonyKWPerPerson) / 1e6) * 0.4) /
                  (def.ratedGW * s.e.fissionAvailability),
              ),
            ),
          );
        orderPowerComplex(s, id, "fission", modules, { size: "small" });
      }
      const active = body.complexes.find((x) => x.type === "fission");
      if (active && m === 36) upgradeRound4Power(s, body, active, "medium");
      if (active && m === 120) upgradeRound4Power(s, body, active, "large");
      if (c === "E9" && m === s.r.fusionUnlockMonth)
        orderPowerComplex(s, id, "fusion", 1, { size: "medium" });
    }
  if (c === "E10") {
    if (!b.complexes.length)
      orderPowerComplex(s, "earth", "fission", 1, {
        size: s.r.directLarge ? "large" : "small",
      });
    const site = b.complexes[0];
    if (site && !s.r.directLarge && [36, 84].includes(m))
      upgradeRound4Power(s, b, site, m === 36 ? "medium" : "large");
  }
  if (
    (["E5-X", "E11"].includes(c) || mediumStress41(c)) &&
    s.r.lifecycleEnabled
  ) {
    if (m === 60)
      for (const a of b.assets.filter(
        (a) =>
          ["industry", "electrolyzer"].includes(a.kind) &&
          (a.owner === "government"
            ? s.r.governmentLifecycleEnabled !== false
            : s.r.privateLifecycleEnabled !== false),
      ))
        pauseRound4(s, b, a);
    if (
      m === s.stress41.startMonth + s.stress41.stopMonths &&
      s.r.governmentLifecycleEnabled !== false
    )
      for (const a of b.assets.filter((a) => a.owner === "government"))
        restartRound4(s, b, a);
    if ((["E11", "E11-M"].includes(c) || s.r.governmentDismantle) && m === 66) {
      const a = b.assets.find(
        (a) =>
          a.kind === "industry" &&
          a.owner === "government" &&
          a.completedMonth <= m,
      );
      if (a) dismantleRound4(s, b, a, { governmentPolicy: true });
    }
  }
  if (c === "E6-R" && m % 12 === 0 && m >= 36 && m <= 120) {
    for (const a of b.assets.filter(
      (a) => a.owner === "government" && a.completedMonth <= m,
    ))
      if (m % 24 === 12) pauseRound4(s, b, a);
      else restartRound4(s, b, a);
  }
}

// Cache the imported unit-capacity function, then scale its linear sets/ratio.
// Policies, efficiencies and ramp shape remain owned by the actual Round3 helper.
const capacityCache = new Map();
function industryCapacity(args) {
  const age = Math.max(
      -1,
      Math.min(50, args.month - (args.completedMonth ?? -100)),
    ),
    key = [args.difficulty, args.processingDifficulty, age].join("|");
  let unit = capacityCache.get(key);
  if (!unit) {
    unit = rawIndustryCapacity({
      ...args,
      sets: 1,
      mineRatio: 1,
      completedMonth: 0,
      month: age,
    });
    capacityCache.set(key, unit);
  }
  return {
    mineU: unit.mineU * args.sets * (args.mineRatio ?? 1),
    processU: unit.processU * args.sets,
    ramp: unit.ramp,
  };
}

function weightedHealth(assets) {
  return (
    sum(assets.map((a) => a.health * (a.moduleCount ?? 1))) /
    Math.max(1, sum(assets.map((a) => a.moduleCount ?? 1)))
  );
}
function aggregatePrivatePower(s) {
  for (const b of Object.values(s.planets)) {
    const groups = new Map(),
      remove = new Set();
    for (const a of b.assets)
      if (
        a.kind === "powerModule" &&
        a.owner === "private" &&
        a.type === "fission" &&
        a.state === "active" &&
        a.health === 1 &&
        a.backlogU === 0 &&
        !a.manualPause
      ) {
        const key = [
          a.complexId,
          a.completedMonth,
          a.lastUtilization ?? 1,
        ].join("|");
        const first = groups.get(key);
        if (!first) {
          groups.set(key, a);
          continue;
        }
        for (const field of ["ratedGW", "creditBasisC", "alloyBasisU"])
          first[field] += a[field];
        first.alloyBasisU = q(first.alloyBasisU) / 1000;
        first.moduleCount = (first.moduleCount ?? 1) + (a.moduleCount ?? 1);
        remove.add(a.id);
      }
    if (remove.size) b.assets = b.assets.filter((a) => !remove.has(a.id));
  }
}

function planEmergencyImports41(s) {
  // Failed offers are reconsidered against THIS month's shortage and donor
  // budget; a stale offer may not ship after the emergency has ended.
  s.shipments = s.shipments.filter((x) => !x.emergency41);
  if (!s.r41.importRelief || !s.planets.earth.shortage41.active) return;
  const earth = s.planets.earth,
    needU = Math.max(
      0,
      maintenanceNeed41(earth, s.e, s.r, s.month) * s.r41.enterMonths +
        sum(
          earth.assets
            .filter((a) => a.state !== "dismantled")
            .map((a) => a.backlogU),
        ) -
        stock(s, "earth", "government", "alloy"),
    );
  let remainingQ = q(needU);
  // Existing settlements only; no invented donor reserves or outside source.
  for (const id of ["moon", "mars"])
    for (const owner of ["government", "private"]) {
      if (remainingQ <= 0) return;
      if (
        s.shipments.some(
          (x) =>
            x.emergency41 && x.from.planet === id && x.from.owner === owner,
        )
      )
        continue;
      const b = s.planets[id],
        bounded = protectedExportQ41(s, b, owner, remainingQ, s.r41);
      if (!bounded.amountQ) continue;
      s.shipments.push({
        from: { planet: id, owner },
        to: { planet: "earth", owner: "government" },
        resourceId: "alloy",
        amountQ: bounded.amountQ,
        marketPriceC: b.alloyPrice,
        month: s.month,
        emergency41: true,
        sourceReserveQ: bounded.reserveQ,
        sourcePlanetReserveQ: bounded.planetReserveQ,
      });
      remainingQ -= bounded.amountQ;
    }
}

function flow422() {
  return {
    yieldBonusAlloyU: 0,
    baselineYieldAlloyU: 0,
    oreLimitedMonth422: 0,
    smeltEligibleMonth422: 0,
    oreLimitedAssetCount422: 0,
    waterDeferredOwners422: 0,
    waterDeferredProposals422: 0,
    waterDeferredFirstQuoteC422: 0,
    reductionTime422: 0,
    smelterTime422: 0,
    cashPurchaseBlocked422: 0,
    cashInvestmentBlocked422: 0,
    governmentIndustryEnergy422GWh: 0,
    governmentIndustryHydrogen422U: 0,
    reductionAlloyU: 0,
    conventionalFallbackAlloyU: 0,
    privateReductionAlloyU: 0,
    reductionHydrogenU: 0,
    reductionOwnHydrogenU: 0,
    reductionWaterU: 0,
    reductionOxygenResidueU: 0,
    lifeWaterDemandU: 0,
    lifeWaterServedU: 0,
    waterRecycledU: 0,
    waterIntakeU: 0,
    waterIntakeServicesC: 0,
    waterRecycleAvoidedC: 0,
    hydrogenMarketSoldU: 0,
    hydrogenMarketSalesC: 0,
  };
}
function takeOwn422(s, body, owner, n, field) {
  if (!s.r422?.enabled) return 0;
  const a = s.planets[body]?.h422?.[owner];
  if (!a) return 0;
  const own = Math.min(n, a.ownQ);
  a.ownQ -= own;
  a[field] += own;
  return own;
}
function fusionNeed422(s, b, owner) {
  return sum(
    b.assets
      .filter(
        (a) =>
          a.owner === owner &&
          a.kind === "powerModule" &&
          a.type === "fusion" &&
          a.completedMonth <= s.month &&
          a.state !== "dismantled",
      )
      .map((a) =>
        ["coldStopped", "starting"].includes(a.state)
          ? Math.max(
              0,
              FUSION.startHydrogenU *
                (a.ratio ?? 1) *
                (1 - a.progressHours / 96),
            )
          : s.fuelU * (a.ratio ?? 1),
      ),
  );
}
function internalHydrogen422(s, b, owner) {
  const q = b.potential422?.[owner];
  if (!q || q.requiredU <= 0) return b.hydrogenPrice;
  const cap = sum(
    b.assets
      .filter(
        (a) =>
          a.kind === "electrolyzer" &&
          a.owner === owner &&
          a.state !== "dismantled",
      )
      .map((a) => a.capacityU),
  );
  const share = clamp(q.requiredU / Math.max(s.e.hydrogenModuleU, cap));
  return b.hydrogenPrice + share * Math.max(0, q.breakEvenC - b.hydrogenPrice);
}
function prepareDispatch422(s, b) {
  b.potential422 = {
    government: {
      requiredU: 0,
      weightedBreakEven: 0,
      breakEvenC: 0,
      quotedU: 0,
      quotedC: 0,
      capacityQuotedU: 0,
      capacityQuotedC: 0,
      oreLimitedAssets: 0,
    },
    private: {
      requiredU: 0,
      weightedBreakEven: 0,
      breakEvenC: 0,
      quotedU: 0,
      quotedC: 0,
      capacityQuotedU: 0,
      capacityQuotedC: 0,
      oreLimitedAssets: 0,
    },
  };
  const budgets = { government: Infinity, private: Infinity };
  for (const a of b.assets.filter(
    (a) => a.kind === "industry" && a.state !== "dismantled",
  )) {
    const x = characteristics422(s, b, { ...a, cashFraction: 1 }, s.month),
      m = marginal422(
        { ...x, oreU: x.mineU + stock(s, b.id, a.owner, "ore") },
        s.r422,
      );
    a.activeFraction = 1;
    const q = b.potential422[a.owner],
      technical = marginal422({ ...x, oreU: Infinity }, s.r422);
    if (m.breakEvenC !== null) {
      q.quotedU += m.hydrogenU;
      q.quotedC += m.hydrogenU * m.breakEvenC;
    }
    if (technical.breakEvenC !== null) {
      q.capacityQuotedU += technical.hydrogenU;
      q.capacityQuotedC += technical.hydrogenU * technical.breakEvenC;
    }
    if (m.processU + 1e-8 < technical.processU) q.oreLimitedAssets++;
    if (m.profitable) {
      q.requiredU += m.hydrogenU;
      q.weightedBreakEven += m.hydrogenU * m.breakEvenC;
    }
  }
  for (const owner of ["government", "private"]) {
    const q = b.potential422[owner];
    q.breakEvenC = q.requiredU ? q.weightedBreakEven / q.requiredU : 0;
  }
  b.h422Potential = Object.fromEntries(
    ["government", "private"].map((o) => [o, b.potential422[o].requiredU]),
  );
}
function lifeSupport422(s, b) {
  let remaining = q(lifeWater422(b.id, b.population, s.r422));
  b.flow.lifeWaterDemandU = remaining / 1000;
  for (const owner of ["government", "private"]) {
    const n = Math.min(remaining, b.h422[owner].waterQ);
    if (n) {
      s.book.sink(
        account(b.id, owner, "water"),
        n,
        "reduction-life-support-water",
      );
      b.h422[owner].waterQ -= n;
      b.flow.lifeWaterServedU += n / 1000;
      remaining -= n;
    }
  }
}
function cutActive422(s, b) {
  const c = s.cut422;
  return Boolean(
    c &&
      c.enabled &&
      c.body === b.id &&
      s.month >= c.startMonth &&
      s.month < c.startMonth + c.durationMonths,
  );
}
function cutLoss422(s, b) {
  const c = s.cut422;
  if (
    c &&
    c.enabled &&
    c.body === b.id &&
    s.month === c.startMonth &&
    c.inventoryLossFraction
  ) {
    for (const owner of ["government", "private"])
      consume(
        s,
        b.id,
        owner,
        "hydrogen",
        stock(s, b.id, owner, "hydrogen") * c.inventoryLossFraction,
        "cut-hydrogen-loss",
      );
  }
}
function cutPreparation422(s) {
  const c = s.cut422;
  if (!c?.fundedColonyFixture) return;
  if (s.month === 0)
    for (const id of ["moon", "mars"]) {
      transportGrant(s, id, 0, 5500, 200);
      s.events422.push({
        event: "explicit-paid-cut-fixture-request",
        month: 0,
        body: id,
        fundingMode43: "direct-national-no-transfer",
        requestedAlloyU: 5500,
        requestedHydrogenU: 200,
      });
    }
  if ([0, 24].includes(s.month))
    for (const id of ["moon", "mars"])
      scheduleShipment(s, id, "hydrogen", 5000, {
        fromOwner: "private",
        toOwner: "government",
        priceC: s.planets.earth.hydrogenPrice,
      });
  for (const id of ["moon", "mars"]) {
    const b = s.planets[id];
    if (!b.cutPrepared422) {
      if (orderIndustry(s, b, "government")) b.cutPrepared422 = true;
    }
    if (
      b.cutPrepared422 &&
      !b.assets.some(
        (a) => a.kind === "electrolyzer" && a.owner === "government",
      )
    )
      orderHydrogen(s, b, "government", 2);
  }
}
function snapshot422(s, b) {
  const capacity = b.assets
    .filter(
      (a) =>
        a.kind === "electrolyzer" &&
        a.completedMonth < s.month &&
        a.state !== "dismantled",
    )
    .reduce((n, a) => n + a.capacityU, 0);
  return {
    enabled: s.r422.enabled,
    cutActive: cutActive422({ ...s, month: Math.max(0, s.month - 1) }, b),
    ownedHydrogenQ: Object.fromEntries(
      ["government", "private"].map((o) => [o, { ...b.h422[o] }]),
    ),
    waterPoolU: sum(Object.values(b.h422).map((x) => x.waterQ)) / 1000,
    electrolyzerCapacityU: capacity,
    potentialHydrogenU: sum(Object.values(b.h422Potential ?? {})),
    breakEvenCPerU: b.potential422
      ? sum(Object.values(b.potential422).map((x) => x.quotedC)) /
        Math.max(
          1e-12,
          sum(Object.values(b.potential422).map((x) => x.quotedU)),
        )
      : 0,
    capacityBreakEvenCPerU: b.potential422
      ? sum(Object.values(b.potential422).map((x) => x.capacityQuotedC)) /
        Math.max(
          1e-12,
          sum(Object.values(b.potential422).map((x) => x.capacityQuotedU)),
        )
      : 0,
    oreLimitedAssets: b.flow.oreLimitedAssetCount422,
    cashGuards: Object.fromEntries(
      ["government", "private"].map((o) => [
        o,
        { ...(b.guards422?.[o] ?? {}) },
      ]),
    ),
    ...Object.fromEntries(Object.keys(flow422()).map((k) => [k, b.flow[k]])),
  };
}
export function assert422Economy(s) {
  if (!s.r422?.enabled) return true;
  const turn = s.book.turnover,
    h = turn["reduction-hydrogen"] ?? 0,
    w = turn["reduction-water"] ?? 0,
    o = turn["reduction-ore-oxygen"] ?? 0;
  if (h !== w || h * 500 + o * 10000 !== w * 4500)
    throw Error("422 reduction mass balance");
  for (const b of Object.values(s.planets)) {
    let pool = 0;
    for (const owner of ["government", "private"]) {
      const x = b.h422[owner];
      if (!Object.values(x).every((n) => Number.isSafeInteger(n) && n >= 0))
        throw Error("422 exact custody integer");
      if (
        x.ownQ > s.book.get(account(b.id, owner, "hydrogen")) ||
        x.waterQ > s.book.get(account(b.id, owner, "water"))
      )
        throw Error("422 provenance exceeds physical inventory");
      if (
        x.producedQ !==
        x.ownQ + x.usedOwnQ + x.soldOwnQ + x.lostOwnQ + x.exportedOwnQ
      )
        throw Error("422 own-H conservation");
      pool += x.waterQ;
    }
    if (
      Math.round(b.total.reductionWaterU * 1000) !==
      pool +
        Math.round(
          (b.total.byproductLifeWaterU43 + b.total.waterRecycledU) * 1000,
        )
    )
      throw Error("422 byproduct water allocation");
  }
  for (const b of Object.values(s.planets)) {
    if (
      Math.round(
        (b.total.baselineYieldAlloyU + b.total.yieldBonusAlloyU) * 1000,
      ) !== Math.round(b.total.producedU * 1000)
    )
      throw Error("422 yield recipe totals");
  }
  for (const b of Object.values(s.planets))
    for (const a of b.assets) {
      const w = a.waterApproval422;
      if (
        w &&
        (w.minimumCoverage < w.fraction ||
          w.operatingMonthsChecked !== w.months ||
          w.requestCapacityQ !== q(a.capacityU))
      )
        throw Error("422 invalid constructed water approval");
    }
  return true;
}
export function strip422Rows(rows) {
  return rows.map(({ round422, ...row }) => ({
    ...row,
    planets: Object.fromEntries(
      Object.entries(row.planets).map(([id, b]) => [
        id,
        {
          ...b,
          flow: Object.fromEntries(
            Object.entries(b.flow).filter(([k]) => !(k in flow422())),
          ),
        },
      ]),
    ),
  }));
}
export { industryPlan as industryPlan422 };

function characteristics422(s, b, a, m) {
  const e = s.e,
    p = s.p,
    cap = industryCapacity({
      sets: a.sets,
      completedMonth: a.completedMonth,
      month: m,
      difficulty: p.difficulty,
      processingDifficulty: p.processingDifficulty,
      mineRatio: a.mineRatio,
    }),
    smelt = industryCapacity({
      sets: a.sets,
      completedMonth: a.smeltCompletedMonth,
      month: m,
      difficulty: p.difficulty,
      processingDifficulty: p.processingDifficulty,
      mineRatio: a.mineRatio,
    });
  let factor = a.health * (a.cashFraction ?? 1);
  if (
    ["construction", "paused", "dismantling", "dismantled"].includes(a.state) ||
    (shockActive41(
      s.scenario,
      m,
      s.stress41 ?? stressDefinition41(s.scenario),
    ) &&
      (!mediumStress41(s.scenario) || b.id === "earth"))
  )
    factor = 0;
  const ordinary = restartProfile(a, s.r, m),
    fast = restart422(a, s.r, m, s.r422),
    mineU = cap.mineU * factor * ordinary.mineFactor,
    scale = a.owner === "private" ? e.privateScale : 1;
  const valued = {
    ...a,
    activeFraction: 1,
    creditBasisC:
      a.creditBasisC ??
      (FACILITY_TYPES[MINING].creditC * (a.mineRatio ?? e.mineRatio) +
        FACILITY_TYPES[SMELTING].creditC) *
        a.sets *
        scale,
    alloyBasisU:
      a.alloyBasisU ??
      (FACILITY_TYPES[MINING].alloyU * (a.mineRatio ?? e.mineRatio) +
        FACILITY_TYPES[SMELTING].alloyU) *
        a.sets *
        scale,
  };
  const bill = maintenanceBill41(valued, e, s.r, b.id, m),
    oreT = ROUND4_RESOURCES.get("ore").contentMassKgPerU / 1000,
    alloyT = ROUND4_RESOURCES.get("alloy").contentMassKgPerU / 1000;
  return {
    baseProcessU: smelt.processU * factor * ordinary.smeltFactor,
    fastProcessU: smelt.processU * factor * fast.smeltFactor,
    rawWorkU: FACILITY_TYPES[SMELTING].capacityU * a.sets * smelt.ramp * factor,
    maxHydrogenU:
      s.inputs.contract.smeltHydrogenU * a.sets * smelt.ramp * factor,
    yieldFraction: s.tech.yieldFraction,
    assistedBoost: s.inputs.contract.smeltBoost,
    alloyPrice: b.alloyPrice,
    hydrogenPrice: b.hydrogenPrice,
    powerPrice:
      b.powerPriceC ??
      (s.e.electricityGDPShare * s.p.bodies.earth.annualGDP) /
        (s.e.earthBaseGW * 8760),
    baseOperatingC: bill.directC + bill.alloyU * b.alloyPrice,
    processGWhPerU:
      (oreT * e.feedMWhPerT +
        s.tech.yieldFraction *
          alloyT *
          alloyElectricityMWhPerT(e.industryMix)) /
      1000,
    mineU,
    mineEnergyGWh: (mineU * oreT * e.mineMWhPerT) / 1000,
    fixedGWh:
      a.completedMonth > m
        ? 0
        : ((a.sets * e.industryFixedMW * 730) / 1000) *
          (["paused", "dismantling"].includes(a.state) ? 0.05 : 1),
    heaterGWh:
      a.state === "active"
        ? ((a.sets * e.industryFixedMW) / 1000) *
          ordinary.heaterHours *
          s.r.smeltHeatMultiplier
        : 0,
  };
}
// Conservative current-owner operating-cost quote, not a second ledger charge.
// Upkeep is valued even when stock owned; electricity at the local tariff even if self-generated.
function localOperatingCost43(s, b, owner) {
  const powerPrice =
    b.powerPriceC ??
    (s.e.electricityGDPShare * s.p.bodies.earth.annualGDP) /
      (s.e.earthBaseGW * 8760);
  let real = 0;
  for (const a of b.assets.filter(
    (a) =>
      a.owner === owner &&
      a.completedMonth <= s.month &&
      a.state !== "dismantled",
  )) {
    let activity = Math.max(1, a.activeFraction ?? 1);
    if (a.kind === "industry") {
      const x = characteristics422(s, b, { ...a, cashFraction: 1 }, s.month),
        m = marginal422(
          { ...x, oreU: x.mineU + stock(s, b.id, owner, "ore") },
          s.r422,
        ),
        process =
          s.r422.enabled && m.profitable ? m.processU : m.conventional.processU;
      // Protect the operations of the proposed full feasible reduction workload,
      // including its incremental O/M, rather than only the prior/base bill.
      if (m.profitable && m.capacity > 0)
        activity = Math.max(
          activity,
          1 + ((m.capacityRatio - 1) * m.processU) / m.capacity,
        );
      real +=
        (s.r422.enabled && m.profitable
          ? m.hydrogenU
          : m.conventional.hydrogenU) * b.hydrogenPrice;
      real +=
        (x.mineEnergyGWh +
          process * x.processGWhPerU +
          x.fixedGWh +
          x.heaterGWh) *
        powerPrice;
    }
    if (a.kind === "iceMine43")
      real +=
        icePlan43(s, b, { ...a, cashFraction: 1 }, s.month).energyGWh *
        powerPrice;
    const bill = maintenanceBill41(
      { ...a, activeFraction: activity },
      s.e,
      s.r,
      b.id,
      s.month,
    );
    real += bill.directC + bill.alloyU * b.alloyPrice;
    const repairU = Math.min(a.backlogU ?? 0, bill.alloyU * s.e.repairRate);
    real += repairU * (b.alloyPrice + s.e.repairCPerU);
    if (
      a.kind === "electrolyzer" &&
      !["paused", "dismantling"].includes(a.state)
    )
      real +=
        a.capacityU *
        ((s.e.electrolysisGWhPerU +
          (s.r.hydrogenLiquefactionKWhKg * 500 +
            s.r.oxygenLiquefactionKWhKg * 4000) /
            1e6) *
          powerPrice +
          s.e.hydrogenVariableCPerU);
    if (
      a.kind === "powerModule" &&
      !["coldStopped", "paused", "dismantling"].includes(a.state)
    ) {
      if (a.type === "fission")
        real +=
          a.ratedGW * 730 * s.e.fissionAvailability * s.e.fissionFuelCPerGWh;
      if (a.type === "fusion")
        real += s.fuelU * (a.ratio ?? 1) * b.hydrogenPrice;
    }
  }
  const storedH = stock(s, b.id, owner, "hydrogen");
  real +=
    storedH *
    (((500 * s.r.hydrogenStorageKWhKgMonth) / 1e6) * powerPrice +
      s.r.boiloffMonthly * b.hydrogenPrice);
  const out = real * s.priceIndex;
  if (!(out >= 0 && Number.isFinite(out)))
    throw Error("422 invalid operating quote");
  return out;
}
function blocked422(s, b, owner, type) {
  const a = b.guards422[owner],
    k = type + "BlockedMonth";
  if (a[k] !== s.month) {
    a[k] = s.month;
    b.flow[
      type === "purchase"
        ? "cashPurchaseBlocked422"
        : "cashInvestmentBlocked422"
    ]++;
  }
}
function recordGuard422(s, b, owner, quote, type) {
  const after = stock(s, b.id, owner, "C"),
    margin = after - quote.floorC;
  if (margin < -1e-7) throw Error("422 cash reserve breached at " + type);
  const a = b.guards422[owner];
  a[type === "purchase" ? "purchases" : "investments"]++;
  a.minimumPostFloorC =
    a.minimumPostFloorC === null
      ? margin
      : Math.min(a.minimumPostFloorC, margin);
}
function investmentGuard422(s, b, owner, cost) {
  const extra = Math.max(0, cost.alloyU - stock(s, b.id, owner, "alloy")),
    requestedC =
      (Math.ceil(cost.creditC * s.priceIndex * 1000) +
        Math.ceil(extra * b.alloyPrice * s.priceIndex * 1000)) /
      1000,
    quote = safeSpend422(
      stock(s, b.id, owner, "C"),
      monthlyOperatingCost422(s, b, owner),
      s.r422.cashReserveMonths,
      requestedC,
    );
  if (!quote.allowed) blocked422(s, b, owner, "investment");
  return quote;
}
export function openingPurchases422(s, b) {
  prepareDispatch422(s, b);
  const unlimited = {
      ore: {
        government: stock(s, b.id, "government", "ore"),
        private: stock(s, b.id, "private", "ore"),
      },
      hydrogen: { government: Infinity, private: Infinity },
    },
    assets = b.assets.filter(
      (a) => a.kind === "industry" && a.state !== "dismantled",
    ),
    ideal = assets.map((a) =>
      industryPlan(s, b, { ...a, cashFraction: 1 }, s.month, unlimited),
    ),
    baseBudgets = {
      ore: {
        government: stock(s, b.id, "government", "ore"),
        private: stock(s, b.id, "private", "ore"),
      },
      hydrogen: { government: Infinity, private: Infinity },
    },
    ordinary = assets.map((a) =>
      legacyIndustryPlan422(
        s,
        b,
        { ...a, cashFraction: 1 },
        s.month,
        baseBudgets,
      ),
    );
  b.h422Required = Object.fromEntries(
    ["government", "private"].map((o) => [
      o,
      sum(
        ideal.filter((x) => x.asset.owner === o).map((x) => x.desiredHydrogenU),
      ) + fusionNeed422(s, b, o),
    ]),
  );
  b.hydrogenDesiredUseU = 0;
  for (const owner of ["private", "government"]) {
    const fusion = fusionNeed422(s, b, owner),
      base =
        fusion +
        sum(
          ordinary
            .filter((x) => x.asset.owner === owner)
            .map((x) => x.desiredHydrogenU),
        ),
      needed = Math.max(base, b.h422Required[owner]);
    if (owner === "government") b.hydrogenGovernmentReservationU = needed;
    purchase(
      s,
      b,
      owner,
      "hydrogen",
      Math.max(0, base - stock(s, b.id, owner, "hydrogen")),
    );
    const extra = Math.max(0, needed - stock(s, b.id, owner, "hydrogen")),
      price = b.hydrogenPrice * s.priceIndex;
    if (extra > 0) {
      const guard = safeSpend422(
        stock(s, b.id, owner, "C"),
        monthlyOperatingCost422(s, b, owner),
        s.r422.cashReserveMonths,
        extra * price,
      );
      if (guard.blocked) blocked422(s, b, owner, "purchase");
      const units = Math.min(
          extra,
          Math.floor((guard.spendC * 1000) / price) / 1000,
        ),
        r = purchase(s, b, owner, "hydrogen", units);
      if (r.amountU > 0) recordGuard422(s, b, owner, guard, "purchase");
    }
    b.hydrogenDesiredUseU += needed;
    b.flow.hydrogenUnmetU += Math.max(
      0,
      needed - stock(s, b.id, owner, "hydrogen"),
    );
  }
}
export {
  characteristics422,
  industryPlans as industryPlans422,
  cutPreparation422,
};

export function waterGate422(s, b, owner, modules = 1) {
  const currentSettled = b.productionMonth422 === s.month,
    startTick = s.month + (currentSettled ? 1 : 0),
    readyTick = s.month + Math.ceil(s.e.hydrogenLagMonths),
    source = b.reference.sources.filter((x) => x.oreEligible),
    hasGovernment = b.assets.some(
      (a) =>
        a.kind === "industry" &&
        a.owner === "government" &&
        a.completedMonth <= s.month,
    ),
    ordinaryBudgets = {
      ore: {
        government: stock(s, b.id, "government", "ore"),
        private: stock(s, b.id, "private", "ore"),
      },
      hydrogen: { government: Infinity, private: Infinity },
    },
    ordinary = b.assets
      .filter((a) => a.kind === "industry" && a.state !== "dismantled")
      .map((a) =>
        legacyIndustryPlan422(
          s,
          b,
          { ...a, cashFraction: 1 },
          s.month,
          ordinaryBudgets,
        ),
      ),
    data = {};
  for (const o of ["government", "private"]) {
    const assigned = source.filter((_, i) =>
        o === "government" ? i === 0 : i > 0 || !hasGovernment,
      ),
      history = [...b.history422[o]];
    if (currentSettled) history.push({ month: s.month, ...b.observed422[o] });
    data[o] = {
      waterQ: s.book.get(account(b.id, o, "water")),
      byproductWaterQ: b.h422[o].waterQ,
      hydrogenQ: s.book.get(account(b.id, o, "hydrogen")),
      finiteByproductHQ: sum(
        assigned.map((x) => s.book.get(account(b.id, "ground", x.sourceId))),
      ),
      byproductRateCapQ: q(
        s.inputs.contract.byproductMaximumU * assigned.length,
      ),
      baseNeedHQ: q(
        fusionNeed422(s, b, o) +
          sum(
            ordinary
              .filter((a) => a.asset.owner === o)
              .map((a) => a.desiredHydrogenU),
          ),
      ),
      history,
      plants: b.assets
        .filter(
          (a) =>
            a.kind === "electrolyzer" &&
            a.owner === o &&
            a.state !== "dismantled",
        )
        .map((a) => ({
          capacityQ: q(a.capacityU),
          completedTick: a.completedMonth,
          active: !["paused", "coldStopped", "dismantling"].includes(a.state),
          natural: b.reference.waterTiles.includes(a.hostTile),
          utilization: Math.max(0, Math.min(1, a.lastUtilization ?? 0)),
        })),
    };
  }
  return forecastWater43({
    nowTick: s.month,
    startTick,
    readyTick,
    months: s.r422.waterGateMonths,
    fraction: s.r422.waterGateFraction,
    requestOwner: owner,
    iceSchedule: iceSchedule43(
      s,
      b,
      startTick,
      readyTick + s.r422.waterGateMonths,
    ),
    requestCapacityQ: q(s.e.hydrogenModuleU * Math.ceil(modules)),
    naturalCapacityQ: b.reference.waterHostTile ? q(s.e.waterIntakeU) : 0,
    candidateNatural: Boolean(b.reference.waterHostTile),
    body: b.id,
    population: b.population,
    growth: s.p.colonyPopulationGrowth,
    litersPerDay: s.r422.lifeLitersPerPersonDay,
    boiloff: s.r.boiloffMonthly,
    owners: data,
  });
}
function deferWater422(s, b, owner, modules, cost, gate) {
  let p = b.pendingWater422[owner];
  const quote = cost.creditC * s.priceIndex;
  if (!p) {
    p = {
      id: b.id + "/" + owner + "/" + b.waterProposals422.length,
      owner,
      firstMonth: s.month,
      lastMonth: s.month,
      modules,
      attempts: 0,
      firstQuoteC: quote,
      latestQuoteC: quote,
      status: "waterDeferred",
    };
    b.pendingWater422[owner] = p;
    b.waterProposals422.push(p);
    b.flow.waterDeferredProposals422++;
    b.flow.waterDeferredFirstQuoteC422 += quote;
  }
  if (p.lastAttemptMonth !== s.month) {
    p.attempts++;
    p.lastAttemptMonth = s.month;
    b.flow.waterDeferredOwners422++;
  }
  p.lastMonth = s.month;
  p.modules = modules;
  p.latestQuoteC = quote;
  p.minimumCoverage = gate.minimumCoverage;
  p.firstShortTick = gate.firstShortTick;
  p.readyTick = gate.readyTick;
  p.gateMonths = gate.months;
  p.gateFraction = gate.fraction;
}

function flow43() {
  return {
    iceProducedU43: 0,
    iceEnergyGWh43: 0,
    iceEnergyDemandGWh43: 0,
    oxygenProducedU43: 0,
    oxygenLifeDemandU43: 0,
    oxygenLifeServedU43: 0,
    byproductLifeWaterU43: 0,
    waterMarketU43: 0,
    waterMarketC43: 0,
    lifeWaterPurchaseC43: 0,
  };
}
function maintenanceBill41(a, e, r, planet, month) {
  return oldMaintenanceBill41(
    a.kind === "iceMine43"
      ? {
          ...a,
          creditBasisC: a.maintenanceCreditBasisC,
          alloyBasisU: a.maintenanceAlloyBasisU,
        }
      : a,
    e,
    r,
    planet,
    month,
  );
}
function maintenanceNeed41(b, e, r, month, owner = null) {
  return sum(
    b.assets
      .filter(
        (a) =>
          (owner === null || a.owner === owner) &&
          a.completedMonth <= month &&
          a.state !== "dismantled",
      )
      .map((a) => maintenanceBill41(a, e, r, b.id, month).alloyU),
  );
}
function priority41(a, shortage, p) {
  return a.kind === "iceMine43" || a.life43
    ? -2
    : oldPriority41(a, shortage, p);
}
function restartCharge(a, r) {
  return a.kind === "iceMine43" && ["paused", "coldStopped"].includes(a.state)
    ? { creditC: a.creditBasisC * r.mineRestartFraction, changed: true }
    : oldRestartCharge(a, r);
}
export function monthlyOperatingCost422(s, b, owner) {
  return owner === "government"
    ? sum(
        Object.values(s.planets).map((x) => localOperatingCost43(s, x, owner)),
      )
    : localOperatingCost43(s, b, owner);
}
export function orderIce43(s, b, owner, modules = 1) {
  if (
    !s.r43.iceEnabled ||
    b.id === "earth" ||
    !Number.isInteger(modules) ||
    modules < 1 ||
    !["government", "private"].includes(owner)
  )
    return false;
  if (!s.book.get(account(b.id, "ground", "ice43"))) return false;
  const cost = iceQuote43(s.r43),
    quote = { creditC: cost.creditC * modules, alloyU: cost.alloyU * modules };
  if (!constructionPurchase(s, b, owner, quote, "ice43")) return false;
  const a = addAsset(b, {
    kind: "iceMine43",
    owner,
    modules,
    essential: true,
    completedMonth: s.month + s.r43.iceBuildMonths,
    state: "construction",
    creditBasisC: quote.creditC,
    alloyBasisU: quote.alloyU,
    maintenanceCreditBasisC: cost.maintenanceCreditBasisC * modules,
    maintenanceAlloyBasisU: cost.maintenanceAlloyBasisU * modules,
    capacityU: s.r43.iceOutputU * modules,
  });
  b.jobs.push({
    startMonth: s.month,
    endMonth: a.completedMonth,
    part: "ice43",
    owner,
  });
  s.events.push({
    event: "ice-ordered43",
    planet: b.id,
    owner,
    month: s.month,
    modules,
    creditC: quote.creditC,
    alloyU: quote.alloyU,
  });
  return a;
}
function icePlan43(s, b, a, m) {
  const active =
    a.completedMonth <= m &&
    ![
      "paused",
      "coldStopped",
      "dismantling",
      "dismantled",
      "construction",
    ].includes(a.state);
  const units = active
    ? a.capacityU *
      a.health *
      (a.cashFraction ?? 1) *
      restartProfile(a, s.r, m).mineFactor
    : 0;
  return { asset: a, units, energyGWh: units * s.r43.iceGWhPerU };
}
function produceIce43(s, b, dispatch) {
  for (const p of dispatch.icePlans) {
    const n = Math.min(
      Math.floor(p.units * dispatch.iceRatio * 1000 + 1e-8),
      s.book.get(account(b.id, "ground", "ice43")),
    );
    if (!n) continue;
    s.book.sink(account(b.id, "ground", "ice43"), n, "finite-ice43");
    s.book.source(account(b.id, p.asset.owner, "water"), n, "ice-water43");
    b.flow.iceProducedU43 += n / 1000;
    p.asset.lastUtilization = n / 1000 / p.asset.capacityU;
  }
}
function iceSchedule43(s, b, start, end) {
  let reserve = s.book.get(account(b.id, "ground", "ice43"));
  return Array.from({ length: end - start }, (_, i) => {
    const tick = start + i,
      out = { tick, government: 0, private: 0 };
    for (const a of b.assets.filter(
      (a) =>
        a.kind === "iceMine43" &&
        !["paused", "coldStopped", "dismantling", "dismantled"].includes(
          a.state,
        ) &&
        a.completedMonth <= tick,
    )) {
      const plan =
          a.state === "construction"
            ? { units: a.capacityU * a.health }
            : icePlan43(s, b, a, tick),
        n = Math.min(reserve, q(plan.units * (b.lastIcePowerRatio43 ?? 1)));
      reserve -= n;
      out[a.owner] += n;
    }
    return out;
  });
}
function waterTrade43(s, b, from, to, amountU) {
  if (!(amountU > 0) || from === to) return { amountU: 0, cashC: 0 };
  const r = trade(s.book, {
      planet: b.id,
      from,
      to,
      resource: "water",
      amountU,
      priceC: b.waterPrice43 * s.priceIndex,
      tag: "water-market43",
    }),
    bp = Math.min(q(r.amountU), b.h422[from].waterQ);
  b.h422[from].waterQ -= bp;
  b.h422[to].waterQ += bp;
  b.flow.waterMarketU43 += r.amountU;
  b.flow.waterMarketC43 += r.cashC;
  return r;
}
function prepareLifeWater43(s, b) {
  const need = lifeNeed43(b.id, b.population, s.r43.oxygenRecycle),
    oxygenStock = sum(
      ["government", "private"].map((o) => stock(s, b.id, o, "oxygen")),
    ),
    lifeElectro = Math.max(0, (need.oxygenQ * 2) / 1000 - oxygenStock),
    target = need.waterQ / 1000 + lifeElectro;
  const buy = waterTrade43(
    s,
    b,
    "private",
    "government",
    Math.max(0, target - stock(s, b.id, "government", "water")),
  );
  b.flow.lifeWaterPurchaseC43 += buy.cashC;
}
function lifeWaterUse43(s, b) {
  const need = lifeNeed43(b.id, b.population, s.r43.oxygenRecycle).waterQ;
  b.flow.lifeWaterDemandU = need / 1000;
  const used = Math.min(need, s.book.get(account(b.id, "government", "water"))),
    bp = Math.min(used, b.h422.government.waterQ);
  if (used)
    s.book.sink(account(b.id, "government", "water"), used, "life-water43");
  b.h422.government.waterQ -= bp;
  b.flow.byproductLifeWaterU43 += bp / 1000;
  b.flow.lifeWaterServedU = used / 1000;
}
function lifeOxygenUse43(s, b) {
  const need = lifeNeed43(b.id, b.population, s.r43.oxygenRecycle).oxygenQ;
  b.flow.oxygenLifeDemandU43 = need / 1000;
  let remaining = need;
  for (const owner of ["government", "private"]) {
    const used = Math.min(
      remaining,
      s.book.get(account(b.id, owner, "oxygen")),
    );
    if (used)
      s.book.sink(account(b.id, owner, "oxygen"), used, "life-oxygen43");
    remaining -= used;
  }
  b.flow.oxygenLifeServedU43 = (need - remaining) / 1000;
  // Existing municipal essential-power/services cost already includes life operation;
  // no new unpriced C fee is invented. Water purchases and facility expenses are explicit.
}
function waterDemand43(s, b) {
  const need = lifeNeed43(b.id, b.population, s.r43.oxygenRecycle);
  return (need.waterQ + need.oxygenQ) / 1000;
}
function requestLifeAlloy43(s, b, amountU) {
  if (amountU <= 0) return;
  scheduleShipment(s, b.id, "alloy", amountU, {
    fromOwner: "private",
    toOwner: "government",
    priceC: s.planets.earth.alloyPrice,
  });
}
function colonyDecisions43(s) {
  for (const b of Object.values(s.planets)) {
    if (b.id === "earth") continue;
    const futurePopulation =
        b.population *
        Math.pow(
          1 + s.p.colonyPopulationGrowth,
          (s.r43.iceBuildMonths + 1) / 12,
        ),
      futureNeed = lifeNeed43(b.id, futurePopulation, s.r43.oxygenRecycle),
      target = (futureNeed.waterQ + futureNeed.oxygenQ) / 1000;
    const capacity = sum(
      b.assets
        .filter(
          (a) =>
            a.kind === "iceMine43" &&
            a.owner === "government" &&
            !["dismantled", "dismantling"].includes(a.state),
        )
        .map((a) => a.capacityU * a.health),
    );
    if (
      s.r43.iceEnabled &&
      capacity < target &&
      stock(s, b.id, "government", "water") +
        Math.min(
          stock(s, b.id, "private", "water"),
          stock(s, b.id, "government", "C") / (b.waterPrice43 * s.priceIndex),
        ) <
        target * (s.r43.iceBuildMonths + 2)
    ) {
      const modules = Math.max(
          1,
          Math.ceil((target - capacity) / s.r43.iceOutputU),
        ),
        cost = iceQuote43(s.r43);
      if (!orderIce43(s, b, "government", modules))
        requestLifeAlloy43(
          s,
          b,
          Math.max(
            0,
            cost.alloyU * modules - stock(s, b.id, "government", "alloy"),
          ) +
            (12 *
              cost.maintenanceAlloyBasisU *
              modules *
              s.r["upkeep_" + b.id]) /
              12,
        );
    }
    // Keep public maintenance material physically funded via the existing paid SCU path.
    const publicNeed =
      maintenanceNeed41(b, s.e, s.r, s.month, "government") * 12;
    if (stock(s, b.id, "government", "alloy") < publicNeed)
      requestLifeAlloy43(
        s,
        b,
        publicNeed - stock(s, b.id, "government", "alloy"),
      );
    const oxygenNeed = futureNeed.oxygenQ / 1000,
      elec = sum(
        b.assets
          .filter(
            (a) =>
              a.kind === "electrolyzer" &&
              a.owner === "government" &&
              !["dismantled", "dismantling"].includes(a.state),
          )
          .map((a) => a.capacityU),
      );
    if (elec < oxygenNeed) {
      const modules = Math.max(
        1,
        Math.ceil((oxygenNeed - elec) / s.e.hydrogenModuleU),
      );
      if (!orderHydrogen(s, b, "government", modules))
        requestLifeAlloy43(
          s,
          b,
          Math.max(
            0,
            s.e.hydrogenModuleAlloyU * modules -
              stock(s, b.id, "government", "alloy"),
          ),
        );
    }
    if (s.r43.iceEnabled && s.month % 3 === 0) {
      const probe = {
          kind: "iceMine43",
          capacityU: s.r43.iceOutputU,
          creditBasisC: iceQuote43(s.r43).creditC,
          alloyBasisU: iceQuote43(s.r43).alloyU,
          maintenanceCreditBasisC: iceQuote43(s.r43).maintenanceCreditBasisC,
          maintenanceAlloyBasisU: iceQuote43(s.r43).maintenanceAlloyBasisU,
          state: "active",
          completedMonth: 0,
          health: 1,
        },
        margin = iceMargin43(s, b, probe),
        invest = probe.creditBasisC + probe.alloyBasisU * b.alloyPrice;
      const privateCapacity = sum(
        b.assets
          .filter(
            (a) =>
              a.kind === "iceMine43" &&
              a.owner === "private" &&
              !["dismantled", "dismantling"].includes(a.state),
          )
          .map((a) => a.capacityU),
      );
      const demand = Math.max(
        0,
        waterDemand43(s, b) +
          sum(
            b.assets
              .filter((a) => a.kind === "electrolyzer" && a.owner === "private")
              .map((a) => a.capacityU),
          ) -
          capacity -
          privateCapacity,
      );
      if (
        margin > 0 &&
        invest / (margin * 12) < s.e.privatePowerHorizonYears &&
        demand > 0
      )
        orderIce43(s, b, "private", 1);
    }
  }
}
function iceMargin43(s, b, a) {
  const bill = maintenanceBill41(a, s.e, s.r, b.id, s.month),
    output = a.capacityU * a.health,
    unitEnergy = s.r43.iceGWhPerU * b.powerPriceC;
  const governmentSupply = sum(
    b.assets
      .filter(
        (x) =>
          x.kind === "iceMine43" &&
          x.owner === "government" &&
          !["dismantled", "dismantling"].includes(x.state),
      )
      .map((x) => x.capacityU * x.health),
  );
  const localWaterDemand =
    lifeNeed43(b.id, b.population, s.r43.oxygenRecycle).waterQ / 1000 +
    sum(
      b.assets
        .filter((x) => x.kind === "electrolyzer" && x.state !== "dismantled")
        .map((x) => x.capacityU),
    );
  const privateSupply =
    sum(
      b.assets
        .filter(
          (x) =>
            x.kind === "iceMine43" &&
            x.owner === "private" &&
            !["dismantled", "dismantling"].includes(x.state),
        )
        .map((x) => x.capacityU * x.health),
    ) + (b.assets.includes(a) ? 0 : output);
  const expectedSales = Math.min(
    output,
    (Math.max(0, localWaterDemand - governmentSupply) * output) /
      Math.max(output, privateSupply),
  );
  return (
    expectedSales * b.waterPrice43 -
    output * unitEnergy -
    bill.directC -
    bill.alloyU * b.alloyPrice
  );
}
function waterMarket43(s, b) {
  if (b.id === "earth") return;
  const demand = Math.max(
      1,
      waterDemand43(s, b) +
        sum(
          b.assets
            .filter(
              (a) =>
                a.kind === "electrolyzer" &&
                a.owner === "private" &&
                a.completedMonth <= s.month &&
                a.state !== "dismantled",
            )
            .map((a) => a.capacityU),
        ),
    ),
    inventory = sum(
      ["government", "private"].map((o) => stock(s, b.id, o, "water")),
    ),
    target = demand * s.e.hydrogenInventoryMonths;
  b.waterPrice43 = clamp(
    b.waterPrice43 *
      Math.exp(
        s.e.hydrogenPriceAdjustment *
          clamp((target - inventory) / target, -2, 2) -
          s.e.hydrogenPriceReversion * Math.log(b.waterPrice43 / 0.2),
      ),
    0.001,
    40,
  );
  for (const owner of ["government", "private"]) {
    if (
      !b.assets.some(
        (a) =>
          a.kind === "electrolyzer" &&
          a.owner === owner &&
          a.completedMonth <= s.month &&
          a.state !== "dismantled",
      )
    )
      continue;
    if (
      owner === "private" &&
      internalHydrogen422(s, b, owner) <
        b.waterPrice43 +
          (s.e.electrolysisGWhPerU +
            (s.r.hydrogenLiquefactionKWhKg * 500 +
              s.r.oxygenLiquefactionKWhKg * 4000) /
              1e6) *
            b.powerPriceC +
          s.e.hydrogenVariableCPerU * (1 - s.r422.waterIntakeCostShare)
    )
      continue;
    const other = owner === "government" ? "private" : "government",
      ownReserve = owner === "government" ? waterDemand43(s, b) * 2 : 0;
    const targetUse = sum(
      b.assets
        .filter(
          (a) =>
            a.kind === "electrolyzer" &&
            a.owner === owner &&
            a.completedMonth <= s.month &&
            a.state !== "dismantled",
        )
        .map((a) => a.capacityU),
    );
    const available = Math.max(
      0,
      stock(s, b.id, other, "water") -
        (other === "government" ? waterDemand43(s, b) * 2 : 0),
    );
    waterTrade43(
      s,
      b,
      other,
      owner,
      Math.min(
        available,
        Math.max(0, targetUse + ownReserve - stock(s, b.id, owner, "water")),
      ),
    );
  }
}
function snapshot43(s, b) {
  const taxRate = effectiveTax43({
    body: b.id,
    month: s.month,
    foundingMonth: b.foundingMonth43,
    ...s.tax43,
    sectorId: s.tax43.sectors[b.id],
    holidayYears: s.r43.holidayYears,
  });
  return {
    taxRate,
    foundingMonth: b.foundingMonth43,
    waterPrice: b.waterPrice43,
    waterStockU: sum(
      ["government", "private"].map((o) => stock(s, b.id, o, "water")),
    ),
    oxygenStockU: sum(
      ["government", "private"].map((o) => stock(s, b.id, o, "oxygen")),
    ),
    iceRemainingU: s.book.get(account(b.id, "ground", "ice43")) / 1000,
    iceInitialU: b.iceInitialQ43 / 1000,
    iceModules: sum(
      b.assets
        .filter((a) => a.kind === "iceMine43" && a.state !== "dismantled")
        .map((a) => a.modules),
    ),
    life: structuredClone(b.life43),
  };
}
function assert43(s) {
  if (s.book.get(NATIONAL_C43) < 0) throw Error("43 negative national cash");
  const flow = s.book.turnover,
    ice = flow["finite-ice43"] ?? 0;
  if (ice !== (flow["ice-water43"] ?? 0))
    throw Error("43 ice/water conversion");
  let remaining = 0,
    initial = 0,
    oxygen = 0;
  for (const b of Object.values(s.planets)) {
    remaining += s.book.get(account(b.id, "ground", "ice43"));
    initial += b.iceInitialQ43;
    oxygen += sum(
      ["government", "private"].map((o) =>
        s.book.get(account(b.id, o, "oxygen")),
      ),
    );
  }
  if (initial - remaining !== ice) throw Error("43 finite ice reserve");
  if (
    oxygen !==
    s.initialOxygenQ43 +
      (flow["electrolysis-oxygen"] ?? 0) -
      (flow["life-oxygen43"] ?? 0)
  )
    throw Error("43 oxygen custody");
  const water = s.book.sum((k) => k.endsWith("/water")),
    initialWater = s.initialWaterQ43;
  if (
    water !==
    initialWater +
      (flow["reduction-water"] ?? 0) +
      (flow["ice-water43"] ?? 0) +
      (flow["metered-surface-water-intake"] ?? 0) -
      (flow["life-water43"] ?? 0) -
      (flow["electrolysis-water"] ?? 0)
  )
    throw Error("43 whole water custody");
  const fiscal = Object.values(s.book.totalFiscal43),
    net = sum(fiscal.map((f) => f.inQ - f.outQ));
  if (s.initialTreasuryQ43 + net !== s.book.get(NATIONAL_C43))
    throw Error("43 national fiscal reconciliation");
}
export {
  waterTrade43,
  lifeWaterUse43,
  lifeOxygenUse43,
  iceSchedule43,
  icePlan43,
  monthlyPower as monthlyPower43,
  produce as produce43,
  produceIce43,
};

function hydrogenCost(p, e, r, options) {
  return oldHydrogenCost(p, e, { ...r, oxygenStored: true }, options);
}

function maintenanceAsset43(a) {
  return a.kind === "iceMine43"
    ? {
        ...a,
        creditBasisC: a.maintenanceCreditBasisC,
        alloyBasisU: a.maintenanceAlloyBasisU,
      }
    : a;
}
function maintenanceBody43(b) {
  return { ...b, assets: b.assets.map(maintenanceAsset43) };
}
function round4Bill(a, e, r, planet, month) {
  return oldRound4Bill(maintenanceAsset43(a), e, r, planet, month);
}
function emergencyMarket41(s, b, p) {
  return oldEmergencyMarket41(s, maintenanceBody43(b), p);
}
function protectedExportQ41(s, b, owner, n, p) {
  return oldProtectedExportQ41(s, maintenanceBody43(b), owner, n, p);
}
export {
  maintenanceNeed41 as maintenanceNeed43,
  protectedExportQ41 as protectedExport43,
};

// Offline, conservative planning quote. It never posts resources, cash, or future shocks.
const owners = ["government", "private"],
  sum = (a) => a.reduce((n, x) => n + x, 0),
  clamp = (x) => Math.max(0, Math.min(1, x));
export function forecastWater431(input) {
  const {
    nowTick,
    startTick,
    readyTick,
    months,
    fraction,
    requestOwner,
    requestCapacityQ,
    naturalCapacityQ,
    body,
    population,
    growth,
    litersPerDay,
    boiloff,
  } = input;
  if (
    !owners.includes(requestOwner) ||
    !Number.isInteger(months) ||
    months < 3 ||
    months > 12 ||
    !(fraction >= 0.5 && fraction <= 1) ||
    ![nowTick, startTick, readyTick, requestCapacityQ, naturalCapacityQ].every(
      Number.isSafeInteger,
    ) ||
    requestCapacityQ <= 0 ||
    naturalCapacityQ < 0 ||
    readyTick < startTick ||
    ![population, growth, litersPerDay, boiloff].every(Number.isFinite)
  )
    throw Error("431 water forecast input");
  const state = {};
  for (const owner of owners) {
    const a = input.owners[owner],
      h = a.history.slice(-months);
    if (
      !a.history.every((r) =>
        ["waterQ", "baseHydrogenQ", "byproductHQ"].every(
          (k) => Number.isSafeInteger(r[k]) && r[k] >= 0,
        ),
      ) ||
      !a.plants.every(
        (p) =>
          Number.isSafeInteger(p.capacityQ) &&
          p.capacityQ >= 0 &&
          Number.isFinite(p.completedTick) &&
          typeof p.active === "boolean" &&
          typeof p.natural === "boolean" &&
          Number.isFinite(p.utilization) &&
          p.utilization >= 0 &&
          p.utilization <= 1,
      )
    )
      throw Error("431 water forecast history/plants");
    const minimum = (k) => (h.length ? Math.min(...h.map((r) => r[k])) : 0);
    if (
      ![
        a.waterQ,
        a.byproductWaterQ,
        a.hydrogenQ,
        a.finiteByproductHQ,
        a.byproductRateCapQ,
        a.baseNeedHQ,
      ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      a.byproductWaterQ > a.waterQ
    )
      throw Error("43 water custody quote");
    state[owner] = {
      waterQ: a.waterQ,
      bpQ: a.byproductWaterQ,
      hQ: a.hydrogenQ,
      finiteHQ: a.finiteByproductHQ,
      waterRateQ: minimum("waterQ"),
      byproductRateQ: Math.min(minimum("byproductHQ"), a.byproductRateCapQ),
      baseNeedQ: Math.max(a.baseNeedHQ, ...h.map((r) => r.baseHydrogenQ)),
      plants: a.plants,
    };
  }
  const requiredQ = Math.ceil(requestCapacityQ * fraction),
    forecast = [];
  let minCoverage = 1,
    firstShortTick = null,
    operatingChecked = 0,
    maxNaturalIntakeQ = 0;
  let heldReserveQ = input.reserveHeldQ ?? 0;
  for (let tick = startTick; tick < readyTick + months; tick++) {
    const operating = tick >= readyTick,
      drinkingQ =
        body === "earth"
          ? 0
          : Math.ceil(
              ((population *
                Math.pow(1 + growth, (tick - nowTick) / 12) *
                litersPerDay *
                30) /
                4500) *
                1000,
            ),
      lifeQ =
        drinkingQ +
        (body === "earth"
          ? 0
          : Math.ceil(
              (drinkingQ * (input.oxygenWaterLitersPerDay ?? 0)) / litersPerDay,
            )),
      fillGapQ = Math.max(
        0,
        drinkingQ * (input.reserveMonths ?? 6) - heldReserveQ,
      ),
      openingLife = {};
    // Owned locked stock was removed by the caller. Additional reserve filling has
    // priority over all ordinary electrolyzers, with no future-shock knowledge.
    const fillQ = Math.min(
      fillGapQ,
      Math.max(0, sum(owners.map((o) => state[o].waterQ)) - lifeQ),
    );
    heldReserveQ += fillQ;
    let reserve = lifeQ + fillQ;
    for (const owner of owners) {
      openingLife[owner] = Math.min(reserve, state[owner].waterQ);
      reserve -= openingLife[owner];
    }
    const plants = {},
      design = {},
      naturalDesign = {};
    for (const owner of owners) {
      plants[owner] = state[owner].plants.filter(
        (p) => p.completedTick <= tick && p.active,
      );
      design[owner] = sum(plants[owner].map((p) => p.capacityQ));
      naturalDesign[owner] =
        sum(plants[owner].filter((p) => p.natural).map((p) => p.capacityQ)) +
        (operating && owner === requestOwner && input.candidateNatural
          ? requestCapacityQ
          : 0);
    }
    const naturalTotal = sum(Object.values(naturalDesign)),
      intake = {},
      drawExisting = {},
      drawNew = {},
      generated = {};
    for (const owner of owners) {
      const a = state[owner],
        share = naturalTotal
          ? Math.floor((naturalCapacityQ * naturalDesign[owner]) / naturalTotal)
          : 0,
        candidate = operating && owner === requestOwner ? requestCapacityQ : 0,
        opening = Math.max(0, a.waterQ - openingLife[owner]);
      intake[owner] = Math.min(
        share,
        Math.max(0, design[owner] + candidate - opening),
      );
      const available = opening + intake[owner];
      drawExisting[owner] = Math.min(available, design[owner]);
      drawNew[owner] = Math.min(
        candidate,
        Math.max(0, available - design[owner]),
      );
      if (candidate) {
        const coverage = drawNew[owner] / requestCapacityQ;
        minCoverage = Math.min(minCoverage, coverage);
        operatingChecked++;
        if (drawNew[owner] < requiredQ && firstShortTick === null)
          firstShortTick = tick;
      }
      // Closing H production cannot fund this month's reduction. Reserve baseline H first.
      if (tick > nowTick) a.hQ = Math.max(0, Math.floor(a.hQ * (1 - boiloff)));
      const base = Math.min(a.hQ, a.baseNeedQ);
      a.hQ -= base;
      generated[owner] = 5 * Math.floor(Math.min(a.waterRateQ, a.hQ) / 5);
      a.hQ -= generated[owner];
      a.waterQ += generated[owner];
      a.bpQ += generated[owner];
    }
    let lifeRemaining = lifeQ + fillQ;
    const life = {};
    for (const owner of owners) {
      const a = state[owner];
      life[owner] = Math.min(lifeRemaining, a.waterQ);
      a.bpQ -= Math.min(a.bpQ, life[owner]);
      a.waterQ -= life[owner];
      lifeRemaining -= life[owner];
    }
    for (const owner of owners) {
      const a = state[owner],
        draw = drawExisting[owner] + drawNew[owner];
      a.waterQ += intake[owner];
      if (a.waterQ < draw) throw Error("43 forecast overpledged water");
      a.waterQ -= draw;
      a.bpQ -= Math.min(a.bpQ, draw);
      let remainingDraw = drawExisting[owner],
        existingHQ = 0;
      for (const plant of plants[owner]) {
        const n = Math.min(remainingDraw, plant.capacityQ);
        remainingDraw -= n;
        existingHQ += Math.min(
          n,
          Math.floor(plant.capacityQ * clamp(plant.utilization)),
        );
      }
      const finite = Math.min(a.finiteHQ, a.byproductRateQ);
      a.finiteHQ -= finite;
      a.hQ += finite + existingHQ;
      const iceQ =
        input.iceSchedule?.find((r) => r.tick === tick)?.[owner] ?? 0;
      if (!Number.isSafeInteger(iceQ) || iceQ < 0)
        throw Error("43 ice forecast quantum");
      a.waterQ += iceQ;
    }
    const totalIntake = sum(Object.values(intake));
    if (totalIntake > naturalCapacityQ)
      throw Error("43 intake capacity overbooked");
    maxNaturalIntakeQ = Math.max(maxNaturalIntakeQ, totalIntake);
    forecast.push({
      tick,
      operating,
      coverage: operating ? drawNew[requestOwner] / requestCapacityQ : null,
      naturalIntakeQ: intake,
      lifeWaterQ: life,
      reserveFillQ: fillQ,
      protectedReserveQ: heldReserveQ,
      generatedWaterQ: generated,
      existingDrawQ: drawExisting,
      newDrawQ: drawNew,
      ending: Object.fromEntries(
        owners.map((o) => [
          o,
          {
            waterQ: state[o].waterQ,
            hydrogenQ: state[o].hQ,
            byproductWaterQ: state[o].bpQ,
          },
        ]),
      ),
    });
  }
  return {
    allowed: firstShortTick === null,
    minimumCoverage: minCoverage,
    firstShortTick,
    operatingMonthsChecked: operatingChecked,
    readyTick,
    startTick,
    months,
    fraction,
    requestCapacityQ,
    requiredQ,
    maxNaturalIntakeQ,
    forecast,
  };
}

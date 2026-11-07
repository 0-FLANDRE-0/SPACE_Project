import assert from "node:assert/strict";
import {
  inputs43,
  read43,
  write43,
  lane43,
  hash43,
} from "./econ-round4-3-inputs.mjs";
import {
  createRound43Economy,
  tickRound43Economy,
  round43Snapshot,
} from "../dist/src/economy-round4-3-model.js";
import { NATIONAL_C43 } from "../dist/src/economy-round4-3-ledger.js";
import { compact43 } from "./econ-round4-3-analysis.mjs";
const root = "docs/econ-sim/round4-3",
  { p, e, inputs, profile, hydrogenPolicy, config } = inputs43(),
  all = ["survival-runs", "no-cut-controls", "h-cut", "final-runs"].flatMap(
    (n) => read43(root + "/" + n + ".json"),
  ),
  runs = [];
for (const scenario of [
  "C43-ICE1-TAX5",
  "C43-ICE0-TAX5",
  "H-CUT-CONTROL",
  "H-CUT-moon-M9-L100",
  "E8",
  "E5-M-L70-S12-D2",
]) {
  const ref = all.find(
      (r) =>
        r.id === "R43-rounded" &&
        r.lane === "self" &&
        r.enabled &&
        r.seed === config.seeds[0] &&
        r.scenario === scenario,
    ),
    s = createRound43Economy(p, e, inputs, {
      round4: profile.parameters,
      round41: lane43(profile.policy41, "self"),
      round422: hydrogenPolicy,
      round43: ref.policy,
      tax43: config.tax,
      scenario,
      baseScenario43: ref.baseScenario,
      seed: ref.seed,
      cut:
        ref.scenario === "H-CUT-CONTROL"
          ? {
              body: "earth",
              startMonth: 60,
              durationMonths: 9,
              inventoryLossFraction: 1,
              fundedColonyFixture: true,
              enabled: false,
            }
          : ref.cut,
      trace: true,
    }),
    rows = [round43Snapshot(s)],
    sample = [];
  for (let m = 0; m < 240; m++) {
    rows.push(tickRound43Economy(s));
    for (const t of s.book.trace)
      if (
        (t.from === NATIONAL_C43 || t.to === NATIONAL_C43) &&
        sample.length < 30
      )
        sample.push({ month: m + 1, ...t });
    s.book.trace.length = 0;
  }
  assert.equal(hash43(compact43(rows)), ref.pathHash);
  const ratio = (row, id, k) => {
    const f = row.planets[id].flow,
      need = k === "water" ? f.lifeWaterDemandU : f.oxygenLifeDemandU43,
      served = k === "water" ? f.lifeWaterServedU : f.oxygenLifeServedU43;
    return need ? served / need : null;
  };
  const perBody = Object.fromEntries(
    ["moon", "mars"].map((id) => [
      id,
      Object.fromEntries(
        ["water", "oxygen"].map((k) => {
          const post = rows.slice(13),
            first = post.find((r) => ratio(r, id, k) < 0.99);
          return [
            k,
            {
              firstAfterGraceShortMonth: first?.month ?? null,
              monthsAfterGraceBelow99: post.filter(
                (r) => ratio(r, id, k) < 0.99,
              ).length,
              first12ConsecutiveGoodStart:
                rows
                  .slice(1)
                  .find(
                    (r, i) =>
                      i + 12 <= 240 &&
                      rows
                        .slice(i + 1, i + 13)
                        .every((v) => ratio(v, id, k) >= 0.99),
                  )?.month ?? null,
            },
          ];
        }),
      ),
    ]),
  );
  runs.push({
    scenario,
    seed: ref.seed,
    lane: "self",
    hydrogen: true,
    pathHash: ref.pathHash,
    traceDoesNotChangePath: true,
    sampleNationalTransactions: sample,
    initialWaterByBody: Object.fromEntries(
      ["earth", "moon", "mars"].map((id) => [
        id,
        rows[0].round43.bodies[id].waterStockU,
      ]),
    ),
    lifeWindows: perBody,
    cumulativeFiscal: structuredClone(s.book.totalFiscal43),
    monthly: rows.map((row) => ({
      month: row.month,
      treasuryC: row.treasuryC,
      ...Object.fromEntries(
        ["moon", "mars"].flatMap((id) => [
          [id + "WaterFraction", ratio(row, id, "water")],
          [id + "OxygenFraction", ratio(row, id, "oxygen")],
          [id + "WaterStockU", row.round43.bodies[id].waterStockU],
          [id + "OxygenStockU", row.round43.bodies[id].oxygenStockU],
          [id + "IceU", row.planets[id].flow.iceProducedU43],
          [id + "OxygenProducedU", row.planets[id].flow.oxygenProducedU43],
          [id + "UnservedGWh", row.planets[id].flow.unservedGWh],
          [id + "CityUtilization", row.planets[id].cityUtilization],
          [id + "IndustryUtilization", row.planets[id].industryUtilization],
          [id + "Health", row.planets[id].meanHealth],
          [id + "GovernmentAlloyU", row.planets[id].governmentAlloyU],
        ]),
      ),
    })),
  });
}
write43(root + "/fiscal-life-diagnostics.json", {
  executions: runs.length,
  scope:
    "Rounded/firstseed/self/H-ON. Passive trace with exact original hash; all diagnosis windows refer to this one seed. No extra model money or resources.",
  runs,
});
console.log("PASS6 passive fiscal/life traces; paths exact");

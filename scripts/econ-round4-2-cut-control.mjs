import assert from "node:assert/strict";
import {
  inputs42,
  read42,
  write42,
  hash42,
  lane42,
} from "./econ-round4-2-inputs.mjs";
import { simulateRound42Economy } from "../dist/src/economy-round4-2-model.js";
import { compact42 } from "./econ-round4-2-analysis.mjs";
const root = "docs/econ-sim/round4-2",
  { p, e, inputs, config } = inputs42(),
  choices = read42(root + "/candidates.json").choices,
  records = read42(root + "/h-cut.json"),
  rows = [],
  prefixChecks = [];
let executions = 0;
const sum = (a) => a.reduce((n, v) => n + v, 0),
  mean = (a) => sum(a) / a.length;
for (const c of choices)
  for (const lane of ["self", "relief"])
    for (const enabled of [false, true])
      for (const seed of config.seeds) {
        const common = {
            round4: c.profile.parameters,
            round41: lane42(c.profile.policy41, lane),
            round42: { ...c.policy, enabled },
            seed,
          },
          cut = {
            body: "earth",
            startMonth: 60,
            durationMonths: 9,
            inventoryLossFraction: 1,
            fundedColonyFixture: true,
            enabled: false,
          },
          control = simulateRound42Economy(p, e, inputs, {
            ...common,
            scenario: "H-CUT-CONTROL",
            cut,
          });
        executions++;
        for (const r of records.filter(
          (r) =>
            r.id === c.id &&
            r.lane === lane &&
            r.enabled === enabled &&
            r.seed === seed,
        )) {
          const id = r.cut.body,
            window = control.rows.filter(
              (x) => x.month > 60 && x.month <= 60 + r.cut.durationMonths,
            ),
            noCutProducedU = sum(
              window.map((x) => x.planets[id].flow.producedU),
            ),
            pre = control.rows.filter((x) => x.month > 48 && x.month <= 60);
          rows.push({
            id: c.id,
            lane,
            enabled,
            seed,
            scenario: r.scenario,
            body: id,
            cutProducedU: r.cut.producedU,
            sameTechnologyNoCutProducedU: noCutProducedU,
            cutToOwnNoCutRatio:
              noCutProducedU > 0 ? r.cut.producedU / noCutProducedU : null,
            preCutMeanProductionU: mean(
              pre.map((x) => x.planets[id].flow.producedU),
            ),
            preCutMeanGovernmentC: mean(
              pre.map((x) => x.planets[id].governmentC),
            ),
            preCutMeanIndustrialUtilization: mean(
              pre.map((x) => x.planets[id].industryUtilization),
            ),
            preCutHealth: mean(pre.map((x) => x.planets[id].meanHealth)),
            preCutReductionU: sum(
              pre.map((x) => x.planets[id].flow.reductionAlloyU ?? 0),
            ),
          });
        }
        if (seed === config.seeds[0])
          for (const body of ["earth", "moon", "mars"]) {
            const scenario = `H-CUT-${body}-M9-L100`,
              r = records.find(
                (r) =>
                  r.id === c.id &&
                  r.lane === lane &&
                  r.enabled === enabled &&
                  r.seed === seed &&
                  r.scenario === scenario,
              ),
              actual = simulateRound42Economy(p, e, inputs, {
                ...common,
                scenario,
                cut: { ...cut, body, enabled: true },
              });
            executions++;
            assert.equal(hash42(compact42(actual.rows)), r.pathHash);
            assert.equal(
              hash42(compact42(actual.rows.slice(0, 61))),
              hash42(compact42(control.rows.slice(0, 61))),
            );
            prefixChecks.push({
              id: c.id,
              lane,
              enabled,
              body,
              pathHash: r.pathHash,
              preCutMonth0Through60Equal: true,
            });
          }
      }
write42(root + "/h-cut-controls.json", {
  executions,
  rows,
  prefixChecks,
  criteriaChanged: false,
  meaning:
    "Additional same-technology no-cut counterfactual. Official95% ON/OFF criterion remains unchanged; pre-cut differences between technologies are separately observable.",
});
console.log(
  JSON.stringify({
    executions,
    prefixChecks: prefixChecks.length,
    rows: rows.length,
    criteriaChanged: false,
  }),
);

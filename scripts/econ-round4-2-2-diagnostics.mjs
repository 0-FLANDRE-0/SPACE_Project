import assert from "node:assert/strict";
import {
  inputs422,
  read422,
  write422,
  lane422,
  hash422,
} from "./econ-round4-2-2-inputs.mjs";
import {
  createRound422Economy,
  tickRound422Economy,
  round422Snapshot,
} from "../dist/src/economy-round4-2-2-model.js";
import { compact422 } from "./econ-round4-2-2-analysis.mjs";
const root = "docs/econ-sim/round4-2-2",
  { p, e, inputs, profile, config } = inputs422(),
  policy = read422(root + "/candidates.json").choices.find(
    (c) => c.id === "R422-rounded",
  ).policy,
  controls = read422(root + "/no-cut-controls.json"),
  out = [];
for (const enabled of [false, true]) {
  const s = createRound422Economy(p, e, inputs, {
      round4: profile.parameters,
      round41: lane422(profile.policy41, "self"),
      round422: { ...policy, enabled },
      scenario: "H-CUT-CONTROL",
      seed: config.seeds[0],
      cut: {
        body: "earth",
        startMonth: 60,
        durationMonths: 9,
        inventoryLossFraction: 1,
        fundedColonyFixture: true,
        enabled: false,
      },
      trace: true,
    }),
    rows = [round422Snapshot(s)],
    cash = Object.fromEntries(
      ["earth", "moon", "mars"].map((b) => [
        b,
        {
          monthly: [],
          waterProposals: [],
          waterApprovals: [],
          outflowC: {},
          inflowC: {},
          outflowThrough60C: {},
          inflowThrough60C: {},
        },
      ]),
    );
  for (let m = 0; m < 240; m++) {
    const start = s.book.trace.length;
    rows.push(tickRound422Economy(s));
    for (const body of ["earth", "moon", "mars"]) {
      const a = cash[body],
        account = body + "/government/C";
      for (const t of s.book.trace.slice(start)) {
        if (t.from === account) {
          a.outflowC[t.tag] = (a.outflowC[t.tag] ?? 0) + t.n / 1000;
          if (m < 60)
            a.outflowThrough60C[t.tag] =
              (a.outflowThrough60C[t.tag] ?? 0) + t.n / 1000;
        }
        if (t.to === account) {
          a.inflowC[t.tag] = (a.inflowC[t.tag] ?? 0) + t.n / 1000;
          if (m < 60)
            a.inflowThrough60C[t.tag] =
              (a.inflowThrough60C[t.tag] ?? 0) + t.n / 1000;
        }
      }
      a.monthly.push({
        month: m + 1,
        cashC: rows.at(-1).planets[body].governmentC,
        producedU: rows.at(-1).planets[body].flow.producedU,
        yieldBonusAlloyU: rows.at(-1).planets[body].flow.yieldBonusAlloyU,
        waterDeferred: rows.at(-1).planets[body].flow.waterDeferredOwners422,
        cashBlocked:
          rows.at(-1).planets[body].flow.cashPurchaseBlocked422 +
          rows.at(-1).planets[body].flow.cashInvestmentBlocked422,
      });
    }
  }
  for (const body of ["earth", "moon", "mars"]) {
    cash[body].waterProposals = structuredClone(
      s.planets[body].waterProposals422,
    );
    cash[body].waterApprovals = s.planets[body].assets
      .filter((a) => a.waterApproval422)
      .map((a) => ({ asset: a.id, owner: a.owner, ...a.waterApproval422 }));
  }
  const reference = controls.find(
    (r) =>
      r.id === "R422-rounded" &&
      r.lane === "self" &&
      r.enabled === enabled &&
      r.seed === config.seeds[0],
  );
  assert.equal(hash422(compact422(rows)), reference.pathHash);
  out.push({
    enabled,
    seed: config.seeds[0],
    lane: "self",
    world: "H-CUT-CONTROL",
    pathHash: reference.pathHash,
    traceDoesNotChangePath: true,
    cash,
  });
}
write422(root + "/cash-diagnostics.json", {
  executions: 2,
  scope:
    "First seed, rounded proposal, self lane, same paid no-cut preparation. Exact path-hash verified passive ledger trace; cash amounts nominal, not extra model expenses.",
  runs: out,
});
console.log("PASS2 passive cash-ledger diagnostics, original paths exact");

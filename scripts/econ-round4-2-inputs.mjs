import fs from "node:fs";
import crypto from "node:crypto";
import { readRound3Inputs } from "./econ-round3-inputs.mjs";
export const read42 = (p) => JSON.parse(fs.readFileSync(p));
export const hash42 = (x) =>
  crypto
    .createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
export function inputs42() {
  const m = read42("docs/econ-sim/round4-1/input-manifest.json"),
    c = read42("docs/econ-sim/round4-1/candidates.json");
  return {
    p: m.macro,
    e: m.baselineEnergy,
    inputs: readRound3Inputs(),
    config: {
      ...read42("scripts/econ-round4-2.config.json"),
      criteria41: read42("scripts/econ-round4-1.config.json").criteria,
    },
    config41: read42("scripts/econ-round4-1.config.json"),
    profiles: [...c.finalists, c.rounded].map((x) => ({
      id: x.id,
      baseId: x.baseId,
      parameters: m.baseCandidates.find((b) => b.id === x.baseId).parameters,
      policy41: x.policy,
    })),
  };
}
export const lane42 = (p, lane) => ({
  ...p,
  marketRelief: lane === "relief",
  importRelief: lane === "relief",
});
export function output42(path) {
  const root = "docs/econ-sim/round4-2";
  if (path !== root && !path.startsWith("artifacts/econ42"))
    throw Error("42 outputs only");
  fs.mkdirSync(path, { recursive: true });
  return path;
}
export function write42(path, x) {
  fs.writeFileSync(path, JSON.stringify(x, null, 2) + "\n");
}

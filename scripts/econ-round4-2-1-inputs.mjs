import fs from "node:fs";
import {
  inputs42,
  read42,
  hash42,
  lane42,
  write42,
} from "./econ-round4-2-inputs.mjs";
export {
  read42 as read421,
  hash42 as hash421,
  lane42 as lane421,
  write42 as write421,
};
export function inputs421() {
  const x = inputs42(),
    profile = x.profiles.find((p) => p.id === "R41-rounded");
  if (!profile) throw Error("Frozen rounded profile unavailable");
  return {
    p: x.p,
    e: x.e,
    inputs: x.inputs,
    profile,
    config: {
      ...read42("scripts/econ-round4-2-1.config.json"),
      criteria41: read42("scripts/econ-round4-1.config.json").criteria,
    },
  };
}
export function output421(p) {
  if (
    p !== "docs/econ-sim/round4-2-1" &&
    !/^artifacts\/econ421[\w/-]*$/.test(p)
  )
    throw Error("421 outputs only");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

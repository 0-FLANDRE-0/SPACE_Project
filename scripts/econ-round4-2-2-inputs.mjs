import fs from "node:fs";
import {
  inputs42,
  read42,
  hash42,
  lane42,
  write42,
} from "./econ-round4-2-inputs.mjs";
export {
  read42 as read422,
  hash42 as hash422,
  lane42 as lane422,
  write42 as write422,
};
export function inputs422() {
  const x = inputs42(),
    profile = x.profiles.find((p) => p.id === "R41-rounded");
  if (!profile) throw Error("Frozen rounded profile unavailable");
  return {
    p: x.p,
    e: x.e,
    inputs: x.inputs,
    profile,
    config: {
      ...read42("scripts/econ-round4-2-2.config.json"),
      criteria41: read42("scripts/econ-round4-1.config.json").criteria,
    },
  };
}
export function output422(p) {
  if (
    p !== "docs/econ-sim/round4-2-2" &&
    !/^artifacts\/econ422[\w/-]*$/.test(p)
  )
    throw Error("422 outputs only");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

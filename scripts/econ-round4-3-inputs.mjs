import fs from "node:fs";
import assert from "node:assert/strict";
import {
  inputs422,
  read422,
  hash422,
  lane422,
  write422,
} from "./econ-round4-2-2-inputs.mjs";
import {
  FIXED42243,
  ICE_RESERVES43,
} from "../dist/src/economy-round4-3-policy.js";
export {
  read422 as read43,
  hash422 as hash43,
  lane422 as lane43,
  write422 as write43,
};
export function inputs43() {
  const old = inputs422(),
    config = {
      ...read422("scripts/econ-round4-3.config.json"),
      criteria41: read422("scripts/econ-round4-1.config.json").criteria,
    };
  assert.deepEqual(
    FIXED42243,
    read422("docs/econ-sim/round4-2-2/candidates.json").choices.find(
      (x) => x.id === "R422-rounded",
    ).policy,
  );
  assert.deepEqual(config.iceReservesU, ICE_RESERVES43);
  return {
    p: old.p,
    e: old.e,
    inputs: old.inputs,
    profile: old.profile,
    hydrogenPolicy: FIXED42243,
    config,
  };
}
export function output43(path) {
  if (
    path !== "docs/econ-sim/round4-3" &&
    !/^artifacts\/econ43[\w/-]*$/.test(path)
  )
    throw Error("43 outputs only");
  fs.mkdirSync(path, { recursive: true });
  return path;
}

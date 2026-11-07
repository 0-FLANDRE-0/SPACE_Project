import fs from "node:fs";
import assert from "node:assert/strict";
import {
  inputs43,
  read43,
  write43,
  hash43,
  lane43,
} from "./econ-round4-3-inputs.mjs";
import { FIXED43_431, LIFE431 } from "../dist/src/economy-round4-3-1-policy.js";
export {
  read43 as read431,
  write43 as write431,
  hash43 as hash431,
  lane43 as lane431,
};
export const ROOT431 = "docs/econ-sim/round4-3-1";
export function inputs431() {
  const old = inputs43(),
    config = {
      ...read43("scripts/econ-round4-3-1.config.json"),
      criteria41: old.config.criteria41,
    };
  assert.deepEqual(
    read43("docs/econ-sim/round4-3/candidates.json").choices.find(
      (x) => x.id === "R43-rounded",
    ).policy,
    FIXED43_431,
  );
  assert.deepEqual(config.life, LIFE431);
  return { ...old, config, policy43: FIXED43_431 };
}
export function output431(path) {
  if (path !== ROOT431 && !/^artifacts\/econ431[\w/-]*$/.test(path))
    throw Error("431 output scope");
  fs.mkdirSync(path, { recursive: true });
  return path;
}

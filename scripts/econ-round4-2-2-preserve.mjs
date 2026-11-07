import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const m = JSON.parse(
    fs.readFileSync("docs/econ-sim/round4-2-2/preservation-manifest.json"),
  ),
  hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
for (const [p, h] of Object.entries(m.files)) {
  assert.equal(hash(fs.readFileSync(p)), h, p);
  assert.equal(
    hash(
      execFileSync("git", ["show", m.base + ":" + p], {
        maxBuffer: 128 * 1024 * 1024,
      }),
    ),
    h,
    "baseline " + p,
  );
}
const paths = (a) =>
    execFileSync("git", a).toString().split("\0").filter(Boolean),
  changed = new Set([
    ...paths(["diff", "--name-only", "-z", m.base]),
    ...paths(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
for (const p of changed) {
  assert.ok(!(p in m.files), "Existing file changed " + p);
  assert.match(
    p,
    /^(dist\/src\/economy-round4-2-2-[^/]+\.js|scripts\/econ-round4-2-2(?:-[^/]+\.mjs|\.config\.json)|tests\/(?:economy-round4-2-2[^/]*\.test\.js|browser-economy-round4-2-2-report\.mjs)|docs\/econ-sim\/round4-2-2\/)/,
  );
}
console.log(
  `PASS ${Object.keys(m.files).length} existing files SHA256 and Git blobs unchanged; new-file-only4.2.2 scope.`,
);

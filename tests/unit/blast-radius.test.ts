import { test } from "node:test";
import assert from "node:assert/strict";
import type { RepoIndex } from "../../src/core/index-store.js";
import { computeBlastRadius } from "../../src/ticket/blast-radius.js";

const issue = (severity: "minor" | "major" | "critical") => ({ problem: "p", fix: "f", severity, ruleId: "r" });
// git.ts flagged major → 91; index-store flagged minor → 97; model.ts clean → 100 (absent).
const index: RepoIndex = {
  lastSha: null,
  problems: { "src/core/git.ts": [issue("major")], "src/core/index-store.ts": [issue("minor")] },
  repoIssues: [],
};

test("base = a single flagged file's cached score (read-only, not re-scored)", () => {
  const r = computeBlastRadius(index, ["src/core/git.ts"]);
  assert.equal(r.base, 91);
  assert.equal(r.degraded, false);
  assert.deepEqual(r.files, [{ path: "src/core/git.ts", score: 91 }]);
});

test("a clean (absent) file scores 100", () => {
  assert.equal(computeBlastRadius(index, ["src/core/model.ts"]).base, 100);
});

test("base = AVERAGE of the blast-radius files (not min, not sum)", () => {
  // (91 + 97 + 100) / 3 = 96
  assert.equal(computeBlastRadius(index, ["src/core/git.ts", "src/core/index-store.ts", "src/core/model.ts"]).base, 96);
});

test("empty blast radius → base 100, degraded (FR-005)", () => {
  const r = computeBlastRadius(index, []);
  assert.equal(r.base, 100);
  assert.equal(r.degraded, true);
});

test("SC-002: a flagged blast radius yields a lower base than a clean one", () => {
  const flagged = computeBlastRadius(index, ["src/core/git.ts"]).base;
  const clean = computeBlastRadius(index, ["src/core/model.ts"]).base;
  assert.ok(flagged < clean, `flagged base ${flagged} should be < clean base ${clean}`);
  // …so the SAME well-specified ticket (0 spec penalty) scores base−0: 91 vs 100.
});

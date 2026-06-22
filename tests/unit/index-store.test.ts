import { test } from "node:test";
import assert from "node:assert/strict";
import { record, remove, repoScore, type RepoIndex } from "../../src/core/index-store.js";
import type { IdentifiedIssue } from "../../src/core/score.js";

const issue = (severity: IdentifiedIssue["severity"]): IdentifiedIssue => ({
  ruleId: "r",
  problem: "p",
  fix: "f",
  severity,
});

test("clean files are never stored (absence = 100)", () => {
  const idx: RepoIndex = { lastSha: null, problems: {} };
  record(idx, "a.ts", []);
  assert.deepEqual(idx.problems, {});
});

test("flagged files are stored; going clean removes the record", () => {
  const idx: RepoIndex = { lastSha: null, problems: {} };
  record(idx, "a.ts", [issue("major")]);
  assert.ok(idx.problems["a.ts"]);
  record(idx, "a.ts", []); // re-scored, now clean
  assert.equal(idx.problems["a.ts"], undefined);
});

test("repoScore: all clean → 100, invariant to file count", () => {
  const idx: RepoIndex = { lastSha: null, problems: {} };
  assert.equal(repoScore(idx, 10), 100);
  assert.equal(repoScore(idx, 100000), 100);
});

test("repoScore averages in the flagged deficits", () => {
  const idx: RepoIndex = { lastSha: null, problems: {} };
  record(idx, "a.ts", [issue("critical")]); // file score 73 → deficit 27
  // 1 flagged of 10 files: (100*10 − 27) / 10 = 97.3 → 97
  assert.equal(repoScore(idx, 10), 97);
});

test("deleted files drop out", () => {
  const idx: RepoIndex = { lastSha: null, problems: { "a.ts": [issue("minor")] } };
  remove(idx, "a.ts");
  assert.deepEqual(idx.problems, {});
});

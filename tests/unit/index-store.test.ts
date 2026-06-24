import { test } from "node:test";
import assert from "node:assert/strict";
import { record, remove, repoScore, repoHealth, worstFile, type RepoIndex } from "../../src/core/index-store.js";
import type { IdentifiedIssue } from "../../src/core/score.js";

const issue = (severity: IdentifiedIssue["severity"]): IdentifiedIssue => ({
  ruleId: "r",
  problem: "p",
  fix: "f",
  severity,
});

test("clean files are never stored (absence = 100)", () => {
  const idx: RepoIndex = { lastScan: null, problems: {}, repoIssues: [] };
  record(idx, "a.ts", []);
  assert.deepEqual(idx.problems, {});
});

test("flagged files are stored; going clean removes the record", () => {
  const idx: RepoIndex = { lastScan: null, problems: {}, repoIssues: [] };
  record(idx, "a.ts", [issue("major")]);
  assert.ok(idx.problems["a.ts"]);
  record(idx, "a.ts", []); // re-scored, now clean
  assert.equal(idx.problems["a.ts"], undefined);
});

test("all clean → score and health are both 100", () => {
  const idx: RepoIndex = { lastScan: null, problems: {}, repoIssues: [] };
  assert.equal(repoScore(idx), 100);
  assert.equal(repoHealth(idx, 10), 100);
  assert.equal(worstFile(idx), null);
});

test("repoScore v2: the WORST file dominates the headline, not the average (#66)", () => {
  const idx: RepoIndex = { lastScan: null, problems: {}, repoIssues: [] };
  record(idx, "a.ts", [issue("critical")]); // file score 73 → deficit 27
  // Headline = worst file (73), regardless of how many clean files surround it.
  assert.equal(repoScore(idx), 73);
  assert.deepEqual(worstFile(idx), { file: "a.ts", score: 73 });
  // …and it stays 73 even in a huge repo — a critical file can't hide.
  record(idx, "b.ts", [issue("minor")]); // 97, not the worst
  assert.equal(repoScore(idx), 73);
});

test("repoHealth: count-invariant average deficit (the secondary number)", () => {
  const idx: RepoIndex = { lastScan: null, problems: {}, repoIssues: [] };
  record(idx, "a.ts", [issue("critical")]); // file score 73 → deficit 27
  // 1 flagged of 10 files: (100*10 − 27) / 10 = 97.3 → 97
  assert.equal(repoHealth(idx, 10), 97);
  // health dilutes as the repo grows (this is exactly why it's NOT the headline)
  assert.equal(repoHealth(idx, 1000), 100);
});

test("repo-level penalties are absolute (hit both score and health, not averaged)", () => {
  const idx: RepoIndex = { lastScan: null, problems: {}, repoIssues: [issue("major"), issue("minor")] };
  // repo penalties = 9 (major) + 3 (minor) = 12 → 88, regardless of file count
  assert.equal(repoScore(idx), 88);
  assert.equal(repoHealth(idx, 50), 88);
  assert.equal(repoHealth(idx, 5), 88);
});

test("deleted files drop out", () => {
  const idx: RepoIndex = { lastScan: null, problems: { "a.ts": [issue("minor")] }, repoIssues: [] };
  remove(idx, "a.ts");
  assert.deepEqual(idx.problems, {});
});

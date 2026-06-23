import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesize } from "../../src/ticket/review/panel.js";

const issue = (problem: string, fix = "do the thing", severity: "info" | "minor" = "minor") => ({ problem, fix, severity });

test("synthesize: collapses near-duplicate issues from different reviewers, merging attribution", () => {
  const out = synthesize([
    issue("[Architect] the RepoIndex schema change has no migration for existing files"),
    issue("[Developer] no migration provided for the changed RepoIndex schema in existing files"),
  ]);
  assert.equal(out.length, 1, "two phrasings of the same gap collapse to one");
  assert.match(out[0]!.problem, /\[Architect, Developer\]/, "attribution is merged");
});

test("synthesize: keeps genuinely distinct issues", () => {
  const out = synthesize([
    issue("[Architect] the schema change in index-store has no migration"),
    issue("[QA] there is no test for the empty-input edge case"),
  ]);
  assert.equal(out.length, 2);
});

test("synthesize: exact duplicates collapse to one", () => {
  const dup = "[QA] no test covers the failure path";
  assert.equal(synthesize([issue(dup), issue(dup)]).length, 1);
});

test("synthesize: keeps the worst severity when merging", () => {
  const out = synthesize([
    issue("[Architect] the migration for the schema change is missing entirely", "add migration", "info"),
    issue("[Developer] migration missing for the schema change", "add migration", "minor"),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.severity, "minor", "the worse of the two severities is kept");
});

test("synthesize: empty in → empty out (panel contributes no penalty)", () => {
  assert.deepEqual(synthesize([]), []);
});

test("#88: same gap phrased differently by two reviewers collapses via a shared code anchor", () => {
  // ~0.3 token overlap — below the HIGH bar — but both cite `lastModel`/`loadIndex`,
  // so the anchored rule merges them (this is the real panel case that under-deduped).
  const out = synthesize([
    issue("[Architect] the RepoIndex gains lastModel but loadIndex has no migration for old files", "add a migration"),
    issue("[Developer] no migration provided in loadIndex for the new lastModel on existing files", "add a migration"),
  ]);
  assert.equal(out.length, 1, "the same gap should collapse to one");
  assert.match(out[0]!.problem, /\[Architect, Developer\]/);
});

test("#88: sharing an anchor is NOT enough — genuinely distinct fixes stay separate", () => {
  // Both mention `lastModel`, but one is a migration concern and the other a test
  // concern — low overlap, so they must remain two distinct issues.
  const out = synthesize([
    issue("[Architect] loadIndex has no migration for the lastModel field", "add a migration"),
    issue("[QA] no test covers the lastModel round-trip in saveIndex", "add a round-trip test"),
  ]);
  assert.equal(out.length, 2);
});

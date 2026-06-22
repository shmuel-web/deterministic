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

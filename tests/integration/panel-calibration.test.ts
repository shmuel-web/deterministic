import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ModelClient } from "../../src/core/rule.js";
import { settings } from "../../src/core/settings.js";
import { reviewPanel } from "../../src/ticket/review/panel.js";
import { resolveBlastRadius } from "../../src/ticket/scout.js";
import { listSourceFiles } from "../../src/core/git.js";

/**
 * CI-safe guard for the calibration fixtures (#80). The REAL precision check is
 * the on-demand `npm run calibrate` harness (it needs the model — a stub can't be
 * chatty). Here we deterministically lock the two things CI *can* verify without
 * a model: the fixtures resolve the blast radius we expect, and the panel's
 * plumbing propagates silence / attributes & caps a grounded issue.
 */
const stub = (json: string): ModelClient => ({ complete: async () => json });
const read = (rel: string) => fs.readFile(path.join(process.cwd(), rel), "utf8");

async function withReview<T>(fn: () => Promise<T>): Promise<T> {
  const prev = settings.review.enabled;
  settings.review.enabled = true;
  try {
    return await fn();
  } finally {
    settings.review.enabled = prev;
  }
}

test("fixtures: the schema fixture resolves its blast radius to index-store.ts (Scout)", async () => {
  const content = await read("examples/tickets/panel-schema-no-migration.md");
  const files = resolveBlastRadius(content, listSourceFiles());
  assert.ok(files.includes("src/core/index-store.ts"), `expected index-store.ts in blast radius, got ${files.join(", ")}`);
});

test("plumbing: a grounded model issue is attributed + capped, on the real fixture", async () => {
  const content = await read("examples/tickets/panel-schema-no-migration.md");
  const grounded = '{"issues":[{"problem":"src/core/index-store.ts changes the persisted shape with no migration","fix":"default the field in loadIndex","severity":"major"}]}';
  const { issues } = await withReview(async () => reviewPanel.run({ target: "ticket", path: "T.md", content, model: stub(grounded) }));
  assert.equal(issues.length, 1); // both reviewers raise the same grounded gap → synthesizer dedups to one
  assert.match(issues[0]!.problem, /^\[Architect/); // attribution may merge reviewers (e.g. "[Architect, Developer]")
  assert.equal(issues[0]!.severity, "minor"); // major capped to minor (panel issues are nudges)
});

test("plumbing: silence propagates — an empty model verdict yields no panel issues", async () => {
  const content = await read("examples/tickets/panel-clean.md");
  const { issues } = await withReview(async () => reviewPanel.run({ target: "ticket", path: "T.md", content, model: stub('{"issues":[]}') }));
  assert.deepEqual(issues, []);
});

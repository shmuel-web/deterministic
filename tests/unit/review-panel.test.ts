import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelClient } from "../../src/core/rule.js";
import { settings } from "../../src/core/settings.js";
import { reviewPanel } from "../../src/ticket/review/panel.js";

/**
 * Slice 1 (#76): the Architect-only panel scaffold. We toggle the opt-in setting
 * per test and restore it, and pin the model with a stub so the funnel's shape is
 * verified deterministically (no Ollama). The blast radius is grounded in a real
 * repo file (src/core/git.ts exists) so gatherBlastRadius can read it.
 */
const stub = (json: string): ModelClient => ({ complete: async () => json });
/** A model that returns queued responses in order (gate call, then draft call, …). */
const seqStub = (...responses: string[]): ModelClient => {
  let i = 0;
  return { complete: async () => responses[Math.min(i++, responses.length - 1)]! };
};
const ARCH_ISSUE = '{"issues":[{"problem":"the enum change in src/core/git.ts has no migration","fix":"add a migration step","severity":"major"}]}';

async function withReview<T>(enabled: boolean, fn: () => Promise<T>): Promise<T> {
  const prev = settings.review.enabled;
  settings.review.enabled = enabled;
  try {
    return await fn();
  } finally {
    settings.review.enabled = prev;
  }
}

const run = async (content: string, model: ModelClient) =>
  reviewPanel.run({ target: "ticket", path: "T.md", content, model });

test("panel is silent when review is disabled (opt-in; no model call)", async () => {
  let called = false;
  const spy: ModelClient = { complete: async () => ((called = true), ARCH_ISSUE) };
  const { issues } = await withReview(false, () => run("Change the enum in `src/core/git.ts`", spy));
  assert.deepEqual(issues, []);
  assert.equal(called, false, "a disabled panel must not call the model");
});

test("panel stays silent when no blast radius resolves (FR-008 degrade)", async () => {
  const { issues } = await withReview(true, () => run("Make everything 10x better 🚀", stub(ARCH_ISSUE)));
  assert.deepEqual(issues, [], "no files named → no grounding → no issues");
});

test("enabled + grounded: Architect issue is attributed and capped to minor", async () => {
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", stub(ARCH_ISSUE)));
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.problem, /^\[Architect\] /, "issue must be attributed to the reviewer");
  assert.equal(issues[0]!.severity, "minor", "major must be capped to minor (panel issues are nudges)");
});

test("unparseable model output → no fabricated issues", async () => {
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", stub("sorry, I cannot help")));
  assert.deepEqual(issues, []);
});

test("applicability gate (FR-004): gate says no → reviewer drafts nothing", async () => {
  // Constant 'applies:false' answers the gate; the draft is never reached.
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", stub('{"applies": false}')));
  assert.deepEqual(issues, []);
});

test("evidence filter (FR-005): a draft that cites no blast-radius file is dropped", async () => {
  // gate → applies:true, then draft → an ungrounded 'consider metrics' issue.
  const ungrounded = '{"issues":[{"problem":"consider adding metrics","fix":"add metrics","severity":"minor"}]}';
  const { issues } = await withReview(true, () =>
    run("Change the enum in src/core/git.ts", seqStub('{"applies": true}', ungrounded)),
  );
  assert.deepEqual(issues, [], "an issue citing no blast-radius file must be filtered out");
});

test("evidence filter keeps an issue that DOES cite a blast-radius file", async () => {
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", seqStub('{"applies": true}', ARCH_ISSUE)));
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.problem, /^\[Architect\] /);
});

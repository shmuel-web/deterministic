import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelClient } from "../../src/core/rule.js";
import { settings } from "../../src/core/settings.js";
import { reviewPanel } from "../../src/ticket/review/panel.js";

const stub = (json: string): ModelClient => ({ complete: async () => json });
/**
 * Content-routing stub: answers by WHICH funnel call is asking (gate / draft /
 * defender), inferred from the prompt — so it's robust to multiple reviewers
 * running concurrently (call order is non-deterministic across reviewers).
 */
const routeStub = (o: { applies?: boolean; draft?: string; refuted?: boolean } = {}): ModelClient => ({
  complete: async (p: string) => {
    if (p.includes('{"applies"')) return `{"applies": ${o.applies ?? true}}`;
    if (p.includes('{"refuted"')) return `{"refuted": ${o.refuted ?? false}}`;
    return o.draft ?? '{"issues":[]}';
  },
});
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

const run = async (content: string, model: ModelClient) => reviewPanel.run({ target: "ticket", path: "T.md", content, model });

test("panel is silent when review is disabled (opt-in; no model call)", async () => {
  let called = false;
  const spy: ModelClient = { complete: async () => ((called = true), ARCH_ISSUE) };
  const { issues } = await withReview(false, () => run("Change the enum in `src/core/git.ts`", spy));
  assert.deepEqual(issues, []);
  assert.equal(called, false, "a disabled panel must not call the model");
});

test("panel stays silent when no blast radius resolves (FR-008 degrade)", async () => {
  const { issues } = await withReview(true, () => run("Make everything 10x better 🚀", routeStub({ draft: ARCH_ISSUE })));
  assert.deepEqual(issues, [], "no files named → no grounding → no issues");
});

test("enabled + grounded: issue is attributed and capped to minor", async () => {
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", routeStub({ draft: ARCH_ISSUE })));
  assert.equal(issues.length, 1, "both reviewers raise the same gap → synthesizer dedups to one");
  assert.match(issues[0]!.problem, /^\[Architect/, "issue must be attributed to a reviewer");
  assert.equal(issues[0]!.severity, "minor", "major must be capped to minor (panel issues are nudges)");
});

test("unparseable model output → no fabricated issues", async () => {
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", stub("sorry, I cannot help")));
  assert.deepEqual(issues, []);
});

test("applicability gate (FR-004): gate says no → reviewers draft nothing", async () => {
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", routeStub({ applies: false })));
  assert.deepEqual(issues, []);
});

test("evidence filter (FR-005): a draft that cites no blast-radius file is dropped", async () => {
  const ungrounded = '{"issues":[{"problem":"consider adding metrics","fix":"add metrics","severity":"minor"}]}';
  const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", routeStub({ draft: ungrounded })));
  assert.deepEqual(issues, [], "an issue citing no blast-radius file must be filtered out");
});

test("evidence + Defender upholds → issue kept and attributed", async () => {
  const { issues } = await withReview(true, () =>
    run("Change the enum in src/core/git.ts", routeStub({ draft: ARCH_ISSUE, refuted: false })),
  );
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.problem, /^\[Architect/);
});

test("adversarial Defender (FR-006): a refuted issue is dropped", async () => {
  const { issues } = await withReview(true, () =>
    run("Change the enum in src/core/git.ts", routeStub({ draft: ARCH_ISSUE, refuted: true })),
  );
  assert.deepEqual(issues, [], "an issue the Defender refutes must not survive");
});

test("defender 'off' skips the refutation pass (issue kept)", async () => {
  const prev = settings.review.defender;
  settings.review.defender = "off";
  try {
    const { issues } = await withReview(true, () => run("Change the enum in src/core/git.ts", routeStub({ draft: ARCH_ISSUE })));
    assert.equal(issues.length, 1);
  } finally {
    settings.review.defender = prev;
  }
});

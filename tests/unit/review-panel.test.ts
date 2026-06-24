import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelClient } from "../../src/core/rule.js";
import { settings } from "../../src/core/settings.js";
import { reviewPanel, runReviewer } from "../../src/ticket/review/panel.js";
import { architect, leadPm } from "../../src/ticket/review/reviewers.js";

const stub = (json: string): ModelClient => ({ complete: async () => json });
/**
 * Content-routing stub: answers by WHICH funnel call is asking (gate / draft /
 * defender), inferred from the prompt — robust to call order and reviewer count.
 */
const routeStub = (o: { applies?: boolean; draft?: string; refuted?: boolean } = {}): ModelClient => ({
  complete: async (p: string) => {
    if (p.includes('{"applies"')) return `{"applies": ${o.applies ?? true}}`;
    if (p.includes('{"refuted"')) return `{"refuted": ${o.refuted ?? false}}`;
    return o.draft ?? '{"issues":[]}';
  },
});
const ARCH_ISSUE = '{"issues":[{"problem":"the enum change in src/core/git.ts has no migration","fix":"add a migration step","severity":"major"}]}';

// runReviewer fixtures (single-reviewer funnel, no panel gating).
const FILES = [{ path: "src/core/git.ts", content: "export function listSourceFiles() {}" }];
const BR = `=== src/core/git.ts ===\nexport function listSourceFiles() {}`;
const TICKET = "Change the enum in src/core/git.ts";

// ── Panel-level integration (reviewPanel) ─────────────────────────────────────
async function withReview<T>(enabled: boolean, fn: () => Promise<T>): Promise<T> {
  const prev = settings.review.enabled;
  settings.review.enabled = enabled;
  try {
    return await fn();
  } finally {
    settings.review.enabled = prev;
  }
}
const runPanel = async (content: string, model: ModelClient) => reviewPanel.run({ target: "ticket", path: "T.md", content, model });

test("panel is silent when review is disabled (opt-in; no model call)", async () => {
  let called = false;
  const spy: ModelClient = { complete: async () => ((called = true), ARCH_ISSUE) };
  const { issues } = await withReview(false, () => runPanel("Change the enum in `src/core/git.ts`", spy));
  assert.deepEqual(issues, []);
  assert.equal(called, false, "a disabled panel must not call the model");
});

test("panel stays silent when no blast radius resolves (FR-008 degrade)", async () => {
  const { issues } = await withReview(true, () => runPanel("Make everything 10x better 🚀", routeStub({ draft: ARCH_ISSUE })));
  assert.deepEqual(issues, [], "no files named → no grounding → no issues");
});

test("panel: reviewers raising the same gap are deduped + attributed, capped to minor", async () => {
  const { issues } = await withReview(true, () => runPanel(TICKET, routeStub({ draft: ARCH_ISSUE })));
  assert.equal(issues.length, 1, "the same gap from several reviewers collapses to one");
  assert.match(issues[0]!.problem, /^\[Architect/);
  assert.equal(issues[0]!.severity, "minor");
});

// ── Per-reviewer funnel (runReviewer) ─────────────────────────────────────────
test("funnel: applicability gate says no → reviewer drafts nothing (FR-004)", async () => {
  assert.deepEqual(await runReviewer(architect, TICKET, BR, FILES, routeStub({ applies: false })), []);
});

test("funnel: a file-grounded reviewer drops an issue citing no blast-radius file (FR-005)", async () => {
  const ungrounded = '{"issues":[{"problem":"consider adding metrics","fix":"add metrics","severity":"minor"}]}';
  assert.deepEqual(await runReviewer(architect, TICKET, BR, FILES, routeStub({ draft: ungrounded })), []);
});

test("funnel: an issue citing a file SYMBOL (not the filename) is grounded → reaches the Defender", async () => {
  // The fix: reviewers often cite the symbol (`listSourceFiles`), not the filename.
  // FILES content has `listSourceFiles`, so this must survive the evidence filter.
  const symbolIssue = '{"issues":[{"problem":"listSourceFiles has no error handling for a failed git call","fix":"wrap the git call in a try/catch","severity":"minor"}]}';
  const issues = await runReviewer(architect, TICKET, BR, FILES, routeStub({ draft: symbolIssue, refuted: false }));
  assert.equal(issues.length, 1, "a symbol-grounded issue must not be dropped");
});

test("funnel: a grounded issue the Defender upholds is kept + attributed", async () => {
  const issues = await runReviewer(architect, TICKET, BR, FILES, routeStub({ draft: ARCH_ISSUE, refuted: false }));
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.problem, /^\[Architect\] /);
  assert.equal(issues[0]!.severity, "minor");
});

test("funnel: an issue the Defender refutes is dropped (FR-006)", async () => {
  assert.deepEqual(await runReviewer(architect, TICKET, BR, FILES, routeStub({ draft: ARCH_ISSUE, refuted: true })), []);
});

test("funnel: defender 'off' skips the refutation pass", async () => {
  const prev = settings.review.defender;
  settings.review.defender = "off";
  try {
    const issues = await runReviewer(architect, TICKET, BR, FILES, routeStub({ draft: ARCH_ISSUE }));
    assert.equal(issues.length, 1);
  } finally {
    settings.review.defender = prev;
  }
});

test("funnel: a ticket-grounded reviewer (PM) keeps a scope issue with NO file citation", async () => {
  const scope = '{"issues":[{"problem":"this bundles three unrelated deliverables","fix":"split into separate tickets","severity":"minor"}]}';
  const issues = await runReviewer(leadPm, "Add retry AND redesign output AND bump coverage", BR, FILES, routeStub({ draft: scope }));
  assert.equal(issues.length, 1, "PM is ticket-grounded → the evidence filter is skipped");
  assert.match(issues[0]!.problem, /^\[PM\] /);
});

test("funnel: unparseable draft → no fabricated issues", async () => {
  assert.deepEqual(await runReviewer(architect, TICKET, BR, FILES, stub("sorry, I cannot help")), []);
});

test("oversize blast radius errors with a 'split the ticket' finding, not truncation (#87)", async () => {
  const prev = settings.review.maxTotalBytes;
  settings.review.maxTotalBytes = 10; // any real file exceeds this
  try {
    let called = false;
    const spy: ModelClient = { complete: async () => ((called = true), '{"issues":[]}') };
    const { issues } = await withReview(true, () => runPanel("Change the enum in src/core/git.ts", spy));
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, "major");
    assert.match(issues[0]!.problem, /too large|too broad/i);
    assert.match(issues[0]!.fix, /split/i);
    assert.equal(called, false, "the panel errors before calling any reviewer");
  } finally {
    settings.review.maxTotalBytes = prev;
  }
});

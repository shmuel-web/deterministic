import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelClient } from "../../src/core/rule.js";
import { gatherRepoContext, renderContext, summarizeStructure } from "../../src/rules/repo-review/scout.js";
import { reconcile, type ReviewerDraft } from "../../src/rules/repo-review/arbitrator.js";
import { architect, testingExpert } from "../../src/rules/repo-review/reviewers.js";
import { reviewRepo, parseDraft } from "../../src/rules/repo-review/panel.js";
import { repoReviewPanel } from "../../src/rules/repo-review/rule.js";

/** #72 — the repo-review panel scaffold, verified end-to-end with a STUB model. */

const tmpRepo = async (files: Record<string, string>): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-rr-"));
  for (const [rel, c] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), c, "utf8");
  }
  return dir;
};

// ── Scout ────────────────────────────────────────────────────────────────────
test("summarizeStructure: groups files per top-level dir, busiest first", () => {
  const s = summarizeStructure(["src/a.ts", "src/b.ts", "src/c.ts", "tests/x.ts", "README.md"]);
  assert.match(s, /src\/ — 3 files/);
  assert.match(s, /tests\/ — 1 file/);
  assert.match(s, /\(root\) — 1 file/);
  assert.ok(s.indexOf("src/") < s.indexOf("tests/"), "busiest dir listed first");
});

test("gatherRepoContext: reads configs + structure; renderContext assembles them", async () => {
  const dir = await tmpRepo({
    "package.json": '{"name":"demo"}',
    "tsconfig.json": "{}",
    "src/index.ts": "export const x = 1;",
  });
  const ctx = await gatherRepoContext(dir);
  assert.ok(ctx.configs["package.json"]?.includes("demo"));
  assert.ok("tsconfig.json" in ctx.configs);
  assert.match(ctx.structure, /src\/ — 1 file/);
  const rendered = renderContext(ctx);
  assert.match(rendered, /REPO STRUCTURE/);
  assert.match(rendered, /=== package\.json ===/);
});

// ── Arbitrator ───────────────────────────────────────────────────────────────
test("reconcile: attributes, caps severity, drops invalid, dedupes across reviewers", () => {
  const drafts: ReviewerDraft[] = [
    {
      reviewer: architect, // maxSeverity major
      issues: [
        { problem: "the parser module has no tests", fix: "add tests", severity: "critical" }, // capped → major
        { problem: "bad", fix: "", severity: "minor" }, // invalid: empty fix → dropped
      ],
    },
    {
      reviewer: testingExpert,
      issues: [
        { problem: "Parser module has NO tests!", fix: "write parser tests", severity: "minor" }, // dup of #1 → merged
        { problem: "integration flow is untested end to end", fix: "add an integration test", severity: "major" },
      ],
    },
  ];
  const issues = reconcile(drafts);
  // 3 raw valid issues, but two are the same gap → 2 after dedupe
  assert.equal(issues.length, 2);
  const parser = issues.find((i) => /parser/i.test(i.problem))!;
  assert.equal(parser.severity, "major", "critical clamped to architect's ceiling, and the higher-severity dup wins");
  assert.equal(parser.ruleId, "repo-review/architect");
  assert.ok(issues.every((i) => i.ruleId.startsWith("repo-review/")));
  assert.ok(!issues.some((i) => i.fix === ""), "contract-invalid issue dropped");
});

// ── Panel ────────────────────────────────────────────────────────────────────
test("parseDraft: tolerant of chatter, null on unparseable", () => {
  assert.equal(parseDraft('ok {"issues":[]} done')?.length, 0);
  assert.equal(parseDraft("nope"), null);
});

test("reviewRepo: no model → clean pass (no throw, no issues)", async () => {
  assert.deepEqual(await reviewRepo(".", null), []);
});

test("repoReviewPanel rule: gated OFF by default (expensive judgment tier)", async () => {
  // settings.repoReview.enabled is false by default → silent, no model resolution.
  const result = await repoReviewPanel.run({ target: "repo", path: "." });
  assert.deepEqual(result.issues, []);
  assert.equal(repoReviewPanel.id, "static/repo-review-panel");
  assert.equal(repoReviewPanel.target, "repo");
});

test("reviewRepo: drives the panel with a stub model and reconciles", async () => {
  const stub: ModelClient = {
    complete(prompt: string) {
      // The architect persona flags coupling; the testing expert is silent.
      if (prompt.includes("architect")) {
        return Promise.resolve('{"issues":[{"problem":"src/core imports a leaf module","fix":"invert the dependency","severity":"major"}]}');
      }
      return Promise.resolve('{"issues":[]}');
    },
  };
  const issues = await reviewRepo("/unused", stub, { context: { root: "/unused", structure: "src/ — 2 files", configs: {} } });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.ruleId, "repo-review/architect");
  assert.match(issues[0]!.problem, /src\/core/);
});

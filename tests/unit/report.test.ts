// @deterministic score: 97/100
//   [minor] llm/intent-legibility  There is no indication anywhere of what the file is for, making its purpose unclear to new readers. → Add a comprehensive doc comment (JSDoc or similar) at the top of the file describing that this test suite validates the core functionality of report generation and Markdown manipulation utilities provided by `src/core/report.js`.
// @deterministic:end
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport, renderReadmeBlock, stripReadmeBlock } from "../../src/core/report.js";
import type { RepoIndex } from "../../src/core/index-store.js";

const idx: RepoIndex = {
  lastScan: { kind: "git", sha: "abc" },
  problems: { "src/a.ts": [{ ruleId: "r", problem: "p", fix: "f", severity: "major" }] },
  repoIssues: [{ ruleId: "static/ci-runs-tests", problem: "no test job", fix: "add one", severity: "major" }],
};

test("report shows score, repo-level issues, and links flagged files", () => {
  const md = renderReport(idx, 72, 10);
  assert.match(md, /Repo score: 72\/100/);
  assert.match(md, /ci-runs-tests/);
  assert.match(md, /\[`src\/a\.ts`\]\(\.\/src\/a\.ts\)/); // linked, not duplicated
});

test("readme block is one line with score + report link", () => {
  const block = renderReadmeBlock(72);
  assert.match(block, /72\/100/);
  assert.match(block, /DETERMINISTIC\.md/);
});

test("stripReadmeBlock is idempotent and restores clean content", () => {
  const original = "# My Project\n\nHello.\n";
  const withBlock = original.replace(/\n?$/, "\n") + "\n" + renderReadmeBlock(72) + "\n";
  const stripped = stripReadmeBlock(withBlock);
  assert.doesNotMatch(stripped, /deterministic:start/);
  assert.doesNotMatch(stripped, /72\/100/);
  // stripping again is a no-op
  assert.equal(stripReadmeBlock(stripped), stripped);
});

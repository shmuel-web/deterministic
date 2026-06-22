import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { linterConfigured } from "../../src/rules/static/linter-configured.js";
import { ciRunsLint } from "../../src/rules/static/ci-runs-lint.js";

async function tmpRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-lint-"));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, "utf8");
  }
  return dir;
}
const ctx = (root: string) => ({ target: "repo" as const, path: root });

test("linter-configured: passes with eslint, flags without", async () => {
  const ok = await tmpRepo({ "package.json": JSON.stringify({ devDependencies: { eslint: "^9" } }) });
  assert.deepEqual((await linterConfigured.run(ctx(ok))).issues, []);

  const bad = await tmpRepo({ "package.json": JSON.stringify({ devDependencies: { typescript: "^5" } }) });
  const out = await linterConfigured.run(ctx(bad));
  assert.equal(out.issues.length, 1);
  assert.equal(out.issues[0]!.severity, "minor");
});

test("ci-runs-lint: silent when no linter (no double-penalty)", async () => {
  const noLinter = await tmpRepo({ "package.json": "{}", ".gitlab-ci.yml": "build:\n  script: npm run build\n" });
  assert.deepEqual((await ciRunsLint.run(ctx(noLinter))).issues, []);
});

test("ci-runs-lint: flags when a linter exists but CI doesn't run it; passes when it does", async () => {
  const notRun = await tmpRepo({
    "package.json": JSON.stringify({ scripts: { lint: "eslint ." }, devDependencies: { eslint: "^9" } }),
    ".gitlab-ci.yml": "test:\n  script: npm test\n",
  });
  assert.equal((await ciRunsLint.run(ctx(notRun))).issues.length, 1);

  const run = await tmpRepo({
    "package.json": JSON.stringify({ scripts: { lint: "eslint ." }, devDependencies: { eslint: "^9" } }),
    ".gitlab-ci.yml": "lint:\n  script: npm run lint\n",
  });
  assert.deepEqual((await ciRunsLint.run(ctx(run))).issues, []);
});

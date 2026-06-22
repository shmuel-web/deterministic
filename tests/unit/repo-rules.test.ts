import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoHasTests } from "../../src/rules/static/repo-has-tests.js";
import { hasCoverageTool } from "../../src/rules/static/has-coverage-tool.js";
import { ciRunsTests } from "../../src/rules/static/ci-runs-tests.js";

async function tmpRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-repo-"));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, "utf8");
  }
  return dir;
}
const ctx = (root: string) => ({ target: "repo" as const, path: root });

test("repo-has-tests: passes with a real test script, flags without", async () => {
  const ok = await tmpRepo({ "package.json": JSON.stringify({ scripts: { test: "vitest run" } }) });
  assert.deepEqual((await repoHasTests.run(ctx(ok))).issues, []);

  const bad = await tmpRepo({ "package.json": JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }) });
  const out = await repoHasTests.run(ctx(bad));
  assert.equal(out.issues.length, 1);
  assert.equal(out.issues[0]!.severity, "major");
});

test("has-coverage-tool: passes with c8, flags without", async () => {
  const ok = await tmpRepo({ "package.json": JSON.stringify({ devDependencies: { c8: "^9" } }) });
  assert.deepEqual((await hasCoverageTool.run(ctx(ok))).issues, []);

  const bad = await tmpRepo({ "package.json": JSON.stringify({ devDependencies: { typescript: "^5" } }) });
  assert.equal((await hasCoverageTool.run(ctx(bad))).issues.length, 1);
});

test("ci-runs-tests: passes when CI invokes tests, flags when it doesn't / missing", async () => {
  const ok = await tmpRepo({ ".gitlab-ci.yml": "test-job:\n  script:\n    - npm test\n" });
  assert.deepEqual((await ciRunsTests.run(ctx(ok))).issues, []);

  const noTests = await tmpRepo({ ".gitlab-ci.yml": "build:\n  script:\n    - npm run build\n" });
  assert.equal((await ciRunsTests.run(ctx(noTests))).issues.length, 1);

  const noCi = await tmpRepo({ "package.json": "{}" });
  assert.equal((await ciRunsTests.run(ctx(noCi))).issues.length, 1);
});

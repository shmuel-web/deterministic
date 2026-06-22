import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ciRunsTypecheck } from "../../src/rules/static/ci-runs-typecheck.js";
import { gitignoreSane } from "../../src/rules/static/gitignore-sane.js";
import { readmeContext } from "../../src/rules/static/readme-context.js";

async function tmpRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-b3-"));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, "utf8");
  }
  return dir;
}
const ctx = (root: string) => ({ target: "repo" as const, path: root });
const issues = async (rule: { run: (c: ReturnType<typeof ctx>) => unknown }, root: string) =>
  ((await rule.run(ctx(root))) as { issues: unknown[] }).issues;

test("ci-runs-typecheck: passes when CI typechecks, flags TS+CI without, inert without tsconfig", async () => {
  assert.equal((await issues(ciRunsTypecheck, await tmpRepo({ "tsconfig.json": "{}", ".gitlab-ci.yml": "x:\n  script: npm run typecheck\n" }))).length, 0);
  assert.equal((await issues(ciRunsTypecheck, await tmpRepo({ "tsconfig.json": "{}", ".gitlab-ci.yml": "x:\n  script: npm run build\n" }))).length, 1);
  assert.equal((await issues(ciRunsTypecheck, await tmpRepo({ ".gitlab-ci.yml": "x:\n  script: echo hi\n" }))).length, 0); // no tsconfig
});

test("gitignore-sane: passes when node_modules ignored, flags when not / missing", async () => {
  assert.equal((await issues(gitignoreSane, await tmpRepo({ "package.json": "{}", ".gitignore": "node_modules/\n" }))).length, 0);
  assert.equal((await issues(gitignoreSane, await tmpRepo({ "package.json": "{}", ".gitignore": "dist/\n" }))).length, 1);
  assert.equal((await issues(gitignoreSane, await tmpRepo({ "package.json": "{}" }))).length, 1); // no .gitignore
});

test("readme-context: passes a rich README, flags missing/thin", async () => {
  const rich = "# Project\n\n## Usage\n\n```\nnpm install\nnpm start\n```\n" + "x".repeat(300);
  assert.equal((await issues(readmeContext, await tmpRepo({ "README.md": rich }))).length, 0);
  assert.equal((await issues(readmeContext, await tmpRepo({ "x.txt": "" }))).length, 1); // no README
  assert.equal((await issues(readmeContext, await tmpRepo({ "README.md": "# Tiny" }))).length, 1); // thin
});

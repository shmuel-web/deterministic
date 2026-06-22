import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { hasAgentContext } from "../../src/rules/static/has-agent-context.js";
import { tsconfigStrict } from "../../src/rules/static/tsconfig-strict.js";
import { lockfileCommitted } from "../../src/rules/static/lockfile-committed.js";
import { licensePresent } from "../../src/rules/static/license-present.js";
import { nodeVersionPinned } from "../../src/rules/static/node-version-pinned.js";

async function tmpRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-b2-"));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, "utf8");
  }
  return dir;
}
const ctx = (root: string) => ({ target: "repo" as const, path: root });
const issues = async (rule: { run: (c: ReturnType<typeof ctx>) => unknown }, root: string) =>
  ((await rule.run(ctx(root))) as { issues: unknown[] }).issues;

test("has-agent-context: passes with CLAUDE.md, flags without", async () => {
  assert.equal((await issues(hasAgentContext, await tmpRepo({ "CLAUDE.md": "x" }))).length, 0);
  assert.equal((await issues(hasAgentContext, await tmpRepo({ "README.md": "x" }))).length, 1);
});

test("tsconfig-strict: passes when strict, flags when not, inert with no tsconfig", async () => {
  assert.equal((await issues(tsconfigStrict, await tmpRepo({ "tsconfig.json": '{"compilerOptions":{"strict":true}}' }))).length, 0);
  assert.equal((await issues(tsconfigStrict, await tmpRepo({ "tsconfig.json": '{"compilerOptions":{"strict":false}}' }))).length, 1);
  assert.equal((await issues(tsconfigStrict, await tmpRepo({ "x.txt": "" }))).length, 0);
});

test("lockfile-committed: passes with a lockfile, flags a Node repo without one", async () => {
  assert.equal((await issues(lockfileCommitted, await tmpRepo({ "package.json": "{}", "package-lock.json": "{}" }))).length, 0);
  assert.equal((await issues(lockfileCommitted, await tmpRepo({ "package.json": "{}" }))).length, 1);
});

test("license-present: passes with LICENSE, flags without", async () => {
  assert.equal((await issues(licensePresent, await tmpRepo({ LICENSE: "MIT" }))).length, 0);
  assert.equal((await issues(licensePresent, await tmpRepo({ "README.md": "x" }))).length, 1);
});

test("node-version-pinned: passes with engines.node or .nvmrc, flags without", async () => {
  assert.equal((await issues(nodeVersionPinned, await tmpRepo({ "package.json": '{"engines":{"node":">=18"}}' }))).length, 0);
  assert.equal((await issues(nodeVersionPinned, await tmpRepo({ "package.json": "{}", ".nvmrc": "20" }))).length, 0);
  assert.equal((await issues(nodeVersionPinned, await tmpRepo({ "package.json": "{}" }))).length, 1);
});

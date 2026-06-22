import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { enforcesDeterministic } from "../../src/rules/static/enforces-deterministic.js";

const run = async (root: string) => (await enforcesDeterministic.run({ target: "repo", path: root })).issues;

async function tmp(files: Record<string, string> = {}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-enf-"));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, "utf8");
  }
  return dir;
}

test("major when nothing enforces a Deterministic run", async () => {
  const dir = await tmp({ "package.json": JSON.stringify({ scripts: { test: "node --test" } }), ".gitlab-ci.yml": "test:\n  script: npm test" });
  const issues = await run(dir);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "major");
});

test("passes when a GitLab CI job runs deterministic", async () => {
  const dir = await tmp({ ".gitlab-ci.yml": "score:\n  script:\n    - deterministic score repo" });
  assert.deepEqual(await run(dir), []);
});

test("passes when a GitHub workflow runs npx deterministic", async () => {
  const dir = await tmp({ ".github/workflows/ci.yml": "jobs:\n  s:\n    steps:\n      - run: npx deterministic score repo" });
  assert.deepEqual(await run(dir), []);
});

test("passes via a Husky pre-push hook", async () => {
  const dir = await tmp({ ".husky/pre-push": "#!/bin/sh\ndeterministic score repo" });
  assert.deepEqual(await run(dir), []);
});

test("passes via npm-script indirection (CI calls a script that runs the local cli)", async () => {
  const dir = await tmp({
    "package.json": JSON.stringify({ scripts: { "score:repo": "tsx src/cli.ts score repo" } }),
    ".gitlab-ci.yml": "score:\n  script:\n    - npm run score:repo",
  });
  assert.deepEqual(await run(dir), []);
});

test("passes via simple-git-hooks in package.json", async () => {
  const dir = await tmp({
    "package.json": JSON.stringify({ "simple-git-hooks": { "pre-commit": "npx deterministic score repo" } }),
  });
  assert.deepEqual(await run(dir), []);
});

test("does not false-positive on the word 'deterministic' alone (repo name, prose)", async () => {
  const dir = await tmp({ ".gitlab-ci.yml": "# project: team-7-deterministic\ntest:\n  script: npm test" });
  assert.equal((await run(dir)).length, 1);
});

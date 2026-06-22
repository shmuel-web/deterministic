import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBlastRadius } from "../../src/ticket/scout.js";

const FILES = ["src/core/git.ts", "src/core/orchestrator.ts", "src/core/model.ts", "tests/unit/score.test.ts"];

test("scout: matches a file named by repo-relative path", () => {
  assert.deepEqual(resolveBlastRadius("Add a guard to src/core/git.ts please", FILES), ["src/core/git.ts"]);
});

test("scout: matches a filename with extension", () => {
  assert.deepEqual(resolveBlastRadius("orchestrator.ts is throwing", FILES), ["src/core/orchestrator.ts"]);
});

test("scout: matches a backtick-quoted basename (with or without extension)", () => {
  assert.deepEqual(resolveBlastRadius("add retry to `orchestrator`", FILES), ["src/core/orchestrator.ts"]);
  assert.deepEqual(resolveBlastRadius("touch `model.ts`", FILES), ["src/core/model.ts"]);
});

test("scout: precision — a bare prose word does NOT drag in a file (no extension, no backticks)", () => {
  assert.deepEqual(resolveBlastRadius("use git to commit and run the model end to end", FILES), []);
});

test("scout: resolves multiple files and dedupes", () => {
  const got = resolveBlastRadius("changes `orchestrator` and src/core/model.ts and orchestrator.ts again", FILES);
  assert.deepEqual(got.sort(), ["src/core/model.ts", "src/core/orchestrator.ts"]);
});

test("scout: no file references → empty (the FR-005 degrade trigger)", () => {
  assert.deepEqual(resolveBlastRadius("Make everything 10x better 🚀", FILES), []);
});

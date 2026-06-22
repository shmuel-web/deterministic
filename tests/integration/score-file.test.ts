import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scoreFile } from "../../src/commands/score-file.js";
import { stripAnnotation } from "../../src/core/annotation.js";
import type { ModelClient } from "../../src/core/rule.js";

// Stub model so the test is deterministic and fast (no live Ollama dependency).
// It reports one legibility issue; the static rules find nothing on this sample.
const stubModel: ModelClient = {
  complete: async () => '{"issues":[{"problem":"name `add` is fine but undocumented","fix":"add a doc comment","severity":"minor"}]}',
};

test("score-file writes an issue-list annotation, idempotent and non-destructive", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-"));
  const file = path.join(dir, "sample.ts");
  const original = "export const add = (a: number, b: number) => a + b;\n";
  await fs.writeFile(file, original, "utf8");

  await scoreFile(file, stubModel);
  const once = await fs.readFile(file, "utf8");

  // score is derived: one minor issue → 97
  assert.match(once, /@deterministic score:\s*97\/100/);
  // the annotation IS the issue list — problem → fix, with severity
  assert.match(once, /\[minor\] llm\/intent-legibility/);
  assert.match(once, /add a doc comment/);
  // no praise / no passed-rule filler
  assert.doesNotMatch(once, /passed/);

  // stripping restores the original source exactly (self-stripping)
  assert.equal(stripAnnotation(once), original);

  // re-scoring does not duplicate the block (idempotent)
  await scoreFile(file, stubModel);
  const twice = await fs.readFile(file, "utf8");
  assert.equal((twice.match(/@deterministic score:/g) ?? []).length, 1, "must replace, not append");
  assert.equal(stripAnnotation(twice), original);

  await fs.rm(dir, { recursive: true, force: true });
});

test("a clean file gets NO annotation block (absence = 100)", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-"));
  const file = path.join(dir, "clean.ts");
  const original = "export const ok = 1;\n";
  await fs.writeFile(file, original, "utf8");

  const cleanModel: ModelClient = { complete: async () => '{"issues": []}' };
  await scoreFile(file, cleanModel);
  const out = await fs.readFile(file, "utf8");

  assert.doesNotMatch(out, /@deterministic/, "clean files must not carry a block");
  assert.equal(out, original, "clean file is left byte-for-byte untouched");
  await fs.rm(dir, { recursive: true, force: true });
});

test("a previously-flagged file that becomes clean has its stale block removed", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-"));
  const file = path.join(dir, "f.ts");
  const original = "export const ok = 1;\n";
  await fs.writeFile(file, original, "utf8");

  const flag: ModelClient = { complete: async () => '{"issues":[{"problem":"x","fix":"y","severity":"minor"}]}' };
  await scoreFile(file, flag);
  assert.match(await fs.readFile(file, "utf8"), /@deterministic/); // block present

  const clean: ModelClient = { complete: async () => '{"issues": []}' };
  await scoreFile(file, clean);
  assert.equal(await fs.readFile(file, "utf8"), original, "stale block removed, source restored");
  await fs.rm(dir, { recursive: true, force: true });
});

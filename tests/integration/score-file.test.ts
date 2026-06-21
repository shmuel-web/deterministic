import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scoreFile } from "../../src/commands/score-file.js";
import { stripAnnotation } from "../../src/core/annotation.js";
import type { ModelClient } from "../../src/core/rule.js";

// Stub model so the test is deterministic and fast (no live Ollama dependency).
const stubModel: ModelClient = {
  complete: async () => '{"score": 88, "reasoning": "clear and well-structured"}',
};

test("score-file writes an idempotent in-file annotation and is non-destructive", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-"));
  const file = path.join(dir, "sample.ts");
  const original = "export const add = (a: number, b: number) => a + b;\n";
  await fs.writeFile(file, original, "utf8");

  await scoreFile(file, stubModel);
  const once = await fs.readFile(file, "utf8");

  // annotation present and auditable
  assert.match(once, /@deterministic score:\s*\d+\/100/);
  // low-noise: only rules with room to improve are listed (the stubbed LLM rule
  // scores 88), while perfect rules collapse into a "(N rules passed)" summary.
  assert.match(once, /llm\/intent-legibility/);
  assert.doesNotMatch(once, /static\/file-length/, "perfect rules must be omitted as noise");
  assert.match(once, /\(\d+ rules? passed\)/);

  // stripping the annotation restores the original source exactly (self-stripping)
  assert.equal(stripAnnotation(once), original);

  // re-scoring does not duplicate the block (idempotent)
  await scoreFile(file, stubModel);
  const twice = await fs.readFile(file, "utf8");
  const blocks = (twice.match(/@deterministic score:/g) ?? []).length;
  assert.equal(blocks, 1, "annotation must be replaced, not appended");
  assert.equal(stripAnnotation(twice), original);

  await fs.rm(dir, { recursive: true, force: true });
});

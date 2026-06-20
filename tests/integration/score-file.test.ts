import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scoreFile } from "../../src/commands/score-file.js";
import { stripAnnotation } from "../../src/core/annotation.js";

test("score-file writes an idempotent in-file annotation and is non-destructive", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-"));
  const file = path.join(dir, "sample.ts");
  const original = "export const add = (a: number, b: number) => a + b;\n";
  await fs.writeFile(file, original, "utf8");

  await scoreFile(file);
  const once = await fs.readFile(file, "utf8");

  // annotation present and auditable
  assert.match(once, /@deterministic score:\s*\d+\/100/);
  assert.match(once, /static\/file-length/);
  assert.match(once, /static\/missing-types/);

  // stripping the annotation restores the original source exactly (self-stripping)
  assert.equal(stripAnnotation(once), original);

  // re-scoring does not duplicate the block (idempotent)
  await scoreFile(file);
  const twice = await fs.readFile(file, "utf8");
  const blocks = (twice.match(/@deterministic score:/g) ?? []).length;
  assert.equal(blocks, 1, "annotation must be replaced, not appended");
  assert.equal(stripAnnotation(twice), original);

  await fs.rm(dir, { recursive: true, force: true });
});

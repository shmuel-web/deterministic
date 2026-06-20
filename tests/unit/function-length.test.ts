import { test } from "node:test";
import assert from "node:assert/strict";
import { functionLength } from "../../src/rules/static/function-length.js";

const ctx = (content: string) => ({ target: "file" as const, path: "x.ts", content });

test("short functions score 100", async () => {
  const out = await functionLength.run(ctx("function add(a, b) {\n  return a + b;\n}\n"));
  assert.equal(out.score, 100);
});

test("a long function is penalized and named", async () => {
  const body = Array.from({ length: 80 }, (_, i) => `  const v${i} = ${i};`).join("\n");
  const out = await functionLength.run(ctx(`function huge() {\n${body}\n}\n`));
  assert.ok(out.score < 100, "long function should lose points");
  assert.match(out.reasoning, /huge/);
});

test("inert when no functions present", async () => {
  const out = await functionLength.run(ctx("export const x = 1;\n"));
  assert.equal(out.score, 100);
  assert.match(out.reasoning, /inert/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { functionLength } from "../../src/rules/static/function-length.js";

const ctx = (content: string) => ({ target: "file" as const, path: "x.ts", content });

test("short functions produce no issues", async () => {
  const out = await functionLength.run(ctx("function add(a, b) {\n  return a + b;\n}\n"));
  assert.deepEqual(out.issues, []);
});

test("a long function yields an issue naming it, with a fix", async () => {
  const body = Array.from({ length: 80 }, (_, i) => `  const v${i} = ${i};`).join("\n");
  const out = await functionLength.run(ctx(`function huge() {\n${body}\n}\n`));
  assert.equal(out.issues.length, 1);
  assert.match(out.issues[0]!.problem, /huge/);
  assert.ok(out.issues[0]!.fix.length > 0);
});

test("no functions → no issues (inert)", async () => {
  const out = await functionLength.run(ctx("export const x = 1;\n"));
  assert.deepEqual(out.issues, []);
});

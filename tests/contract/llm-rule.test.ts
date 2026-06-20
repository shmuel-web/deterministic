import { test } from "node:test";
import assert from "node:assert/strict";
import { intentLegibility } from "../../src/rules/llm/intent-legibility.js";
import { RuleSignalSchema, type ModelClient } from "../../src/core/rule.js";

const stub = (response: string): ModelClient => ({ complete: async () => response });
const ctx = (model: ModelClient) => ({ target: "file" as const, path: "x.ts", content: "const x = 1;", model });

test("valid model JSON → contract-valid signal", async () => {
  const out = await intentLegibility.run(ctx(stub('{"score": 82, "reasoning": "clear intent"}')));
  assert.ok(RuleSignalSchema.safeParse(out).success);
  assert.equal(out.score, 82);
});

test("JSON wrapped in chatter is still parsed", async () => {
  const out = await intentLegibility.run(ctx(stub('Sure!\n{"score": 70, "reasoning": "ok"}\nThanks')));
  assert.equal(out.score, 70);
});

test("malformed output → neutral signal, never throws (Principle VI)", async () => {
  const out = await intentLegibility.run(ctx(stub("not json at all")));
  assert.ok(RuleSignalSchema.safeParse(out).success);
  assert.equal(out.score, 50);
  assert.match(out.reasoning, /unparseable/);
});

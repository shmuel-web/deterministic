import { test } from "node:test";
import assert from "node:assert/strict";
import { intentLegibility } from "../../src/rules/llm/intent-legibility.js";
import { RuleResultSchema, type ModelClient } from "../../src/core/rule.js";

const stub = (response: string): ModelClient => ({ complete: async () => response });
const ctx = (model: ModelClient) => ({ target: "file" as const, path: "x.ts", content: "const x = 1;", model });

test("model issues JSON → contract-valid result", async () => {
  const out = await intentLegibility.run(
    ctx(stub('{"issues":[{"problem":"vague name `d`","fix":"rename to `dashboard`","severity":"minor"}]}')),
  );
  assert.ok(RuleResultSchema.safeParse(out).success);
  assert.equal(out.issues.length, 1);
  assert.equal(out.issues[0]!.severity, "minor");
});

test("clean file → empty issues (no fabricated problems, no praise)", async () => {
  const out = await intentLegibility.run(ctx(stub('{"issues": []}')));
  assert.deepEqual(out.issues, []);
});

test("issues wrapped in chatter are still parsed", async () => {
  const out = await intentLegibility.run(ctx(stub('Sure:\n{"issues":[{"problem":"p","fix":"f","severity":"info"}]}\ndone')));
  assert.equal(out.issues.length, 1);
});

test("malformed output → empty issues, never throws (Principle VI)", async () => {
  const out = await intentLegibility.run(ctx(stub("not json at all")));
  assert.ok(RuleResultSchema.safeParse(out).success);
  assert.deepEqual(out.issues, []);
});

test("severity is capped to the rule's ceiling (legibility maxes at minor)", async () => {
  const out = await intentLegibility.run(
    ctx(stub('{"issues":[{"problem":"unclear name","fix":"rename it","severity":"critical"}]}')),
  );
  assert.equal(out.issues[0]!.severity, "minor", "an over-eager critical must be clamped to the rule's max");
});

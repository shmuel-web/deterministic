import { test } from "node:test";
import assert from "node:assert/strict";
import { rules } from "../../deterministic.config.js";
import { RuleSignalSchema, type RuleContext } from "../../src/core/rule.js";
import { arbitrate } from "../../src/core/arbitrator.js";

test("every configured rule returns a contract-valid signal", async () => {
  const ctx: Omit<RuleContext, "model"> = {
    target: "file",
    path: "sample.ts",
    content: "export const x: number = 1;\n",
  };
  for (const { rule } of rules) {
    const signal = await rule.run({ ...ctx });
    const parsed = RuleSignalSchema.safeParse(signal);
    assert.ok(parsed.success, `rule ${rule.id} produced an invalid signal`);
  }
});

test("rule ids are unique and namespaced by type", () => {
  const ids = rules.map((r) => r.rule.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate rule ids");
  for (const id of ids) assert.match(id, /^(static|llm)\//);
});

test("arbitrator composes a transparent weighted score", () => {
  const out = arbitrate([
    { ruleId: "static/a", score: 80, weight: 1, reasoning: "a" },
    { ruleId: "static/b", score: 60, weight: 3, reasoning: "b" },
  ]);
  assert.equal(out.score, 65); // (80*1 + 60*3) / 4
  assert.equal(out.signals.length, 2);
  assert.match(out.reasoning, /static\/a/);
  assert.match(out.reasoning, /static\/b/);
});

test("no applicable rules → neutral 100", () => {
  assert.equal(arbitrate([]).score, 100);
});

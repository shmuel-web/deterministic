import { test } from "node:test";
import assert from "node:assert/strict";
import { rules } from "../../deterministic.config.js";
import { RuleResultSchema, type RuleContext } from "../../src/core/rule.js";
import { score } from "../../src/core/score.js";

test("every configured rule returns a contract-valid result", async () => {
  const ctx: Omit<RuleContext, "model"> = {
    target: "file",
    path: "sample.ts",
    content: "export const x: number = 1;\n",
  };
  for (const rule of rules) {
    if (rule.type === "llm") continue; // exercised with a stub in llm-rule.test.ts
    const result = await rule.run({ ...ctx });
    assert.ok(RuleResultSchema.safeParse(result).success, `rule ${rule.id} produced an invalid result`);
  }
});

test("rule ids are unique and namespaced by type", () => {
  const ids = rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate rule ids");
  for (const id of ids) assert.match(id, /^(static|llm)\//);
});

test("score derives from issue penalties (1/3/9/27), worst dominates", () => {
  assert.equal(score([]).score, 100); // no issues → perfect
  assert.equal(score([{ ruleId: "r", problem: "p", fix: "f", severity: "info" }]).score, 99);
  assert.equal(score([{ ruleId: "r", problem: "p", fix: "f", severity: "major" }]).score, 91);
  assert.equal(score([{ ruleId: "r", problem: "p", fix: "f", severity: "critical" }]).score, 73);
});

test("passing rules never inflate — score is count-invariant", () => {
  // One critical among any number of (absent) passing rules is still 73.
  const one = score([{ ruleId: "sec", problem: "secret", fix: "use env", severity: "critical" }]);
  assert.equal(one.score, 73);
  // Two criticals dominate to well below a fail line; never negative.
  const two = score([
    { ruleId: "a", problem: "p", fix: "f", severity: "critical" },
    { ruleId: "b", problem: "p", fix: "f", severity: "critical" },
  ]);
  assert.equal(two.score, 46);
});

test("score never goes below 0", () => {
  const many = Array.from({ length: 10 }, () => ({ ruleId: "r", problem: "p", fix: "f", severity: "critical" as const }));
  assert.equal(score(many).score, 0);
});

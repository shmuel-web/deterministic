import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelClient } from "../../src/core/rule.js";
import { ticketHasDod } from "../../src/ticket/rules/ticket-has-dod.js";
import { ticketRules } from "../../src/ticket/rules.js";
import { runRules } from "../../src/core/orchestrator.js";
import { score as deriveScore } from "../../src/core/score.js";
import { scoreTicket } from "../../src/ticket/score-ticket.js";

const ctx = (content: string) => ({ target: "ticket" as const, path: "T.md", content });
const tmpTicket = async (content: string) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-ticket-"));
  const p = path.join(dir, "ticket.md");
  await fs.writeFile(p, content, "utf8");
  return p;
};
/** Stub model: returns whatever JSON we pin — no Ollama needed. */
const stub = (json: string): ModelClient => ({ complete: async () => json });
const CLEAN = '{"issues":[]}';

test("ticket-has-dod: flags a ticket with no done-condition (major, model-free)", async () => {
  const { issues } = await ticketHasDod.run(ctx("Make it better. 🚀"));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "major");
});

test("ticket-has-dod: passes when a done-condition section is present", async () => {
  assert.deepEqual((await ticketHasDod.run(ctx("## Acceptance Criteria\n- x works"))).issues, []);
  assert.deepEqual((await ticketHasDod.run(ctx("Definition of Done: tests pass"))).issues, []);
});

test("ticket-has-dod absorbs #60 (no-acceptance-criteria): a ticket with a goal but no acceptance section is flagged", async () => {
  // A fleshed-out ticket that still has NO acceptance criteria / DoD — exactly
  // what the separate `no-acceptance-criteria` rule would have caught.
  const noAcceptance = "# Add a cache\n## Context\nThe API is slow.\n## Goal\nCache responses for 60s.";
  const { issues } = await ticketHasDod.run(ctx(noAcceptance));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "major");
  // …and the moment an acceptance section appears, it passes — no double-flag.
  assert.deepEqual((await ticketHasDod.run(ctx(noAcceptance + "\n## Acceptance Criteria\n- cache hit ratio reported"))).issues, []);
});

test("dod-quality (#25) is wired into the ticket rules as a scoped llm rule", () => {
  const r = ticketRules.find((x) => x.id === "llm/dod-quality");
  assert.ok(r, "dod-quality must be registered in ticketRules");
  assert.equal(r!.target, "ticket");
  assert.equal(r!.type, "llm");
});

test("missing-context is wired into the ticket rules as a scoped llm rule", () => {
  const r = ticketRules.find((x) => x.id === "llm/missing-context");
  assert.ok(r, "missing-context must be registered in ticketRules");
  assert.equal(r!.target, "ticket");
  assert.equal(r!.type, "llm");
});

test("composition: a contentless ticket scores low from own rules alone (SC-001)", async () => {
  // static fires (no DoD); stub LLM rules each find one major.
  const issues = await runRules(ticketRules, ctx("To the moon 🚀🌕💸"), {
    model: stub('{"issues":[{"problem":"vague","fix":"name a target","severity":"major"}]}'),
  });
  const { score } = deriveScore(issues);
  assert.ok(score < 80, `expected a low score, got ${score}`);
  assert.ok(issues.some((i) => i.ruleId === "static/ticket-has-dod"));
});

test("scoreTicket: annotates a weak ticket in-file with its issues", async () => {
  const p = await tmpTicket("# Do the thing\nMake it amazing. 🚀");
  await scoreTicket(p, stub('{"issues":[{"problem":"no metric","fix":"add a target","severity":"major"}]}'));
  const after = await fs.readFile(p, "utf8");
  assert.match(after, /<!--\s*@deterministic score:/, "expected an HTML-comment annotation block");
  assert.match(after, /ticket-has-dod/, "expected the missing-DoD issue in the block");
});

test("scoreTicket: a well-specified ticket gets no annotation (clean ⟺ no block)", async () => {
  const good =
    "# Add --json flag\n## Definition of Done\n- prints one JSON object\n## Validation\n- new test asserts JSON.parse succeeds";
  const p = await tmpTicket(good);
  await scoreTicket(p, stub(CLEAN)); // static passes (has DoD); stub LLM finds nothing
  const after = await fs.readFile(p, "utf8");
  assert.doesNotMatch(after, /@deterministic/, "a clean ticket must carry no annotation block");
  assert.equal(after, good, "a clean ticket file is left untouched");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelClient } from "../../src/core/rule.js";
import { scoreTicket } from "../../src/ticket/score-ticket.js";

/**
 * #26 — Integration test: ticket DoD scoring (end to end).
 * Absorbs the originally-separate integration ticket: drive the real
 * `scoreTicket` command and assert the missing-DoD penalty flows all the way
 * through to the in-file annotation and the composed score. The LLM rules are
 * pinned to "no issues" via a stub so the only signal is the static DoD rule —
 * making the score deterministic (base 100, one major → 91).
 */

const stubClean: ModelClient = { complete: async () => '{"issues":[]}' };

async function tmpTicket(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-dod-"));
  const p = path.join(dir, "ticket.md");
  await fs.writeFile(p, content, "utf8");
  return p;
}

test("#26: a ticket missing a DoD is annotated in-file and scored down (major → 91)", async () => {
  // Names no repo files → blast-radius base 100, so the only deduction is the DoD major.
  const p = await tmpTicket("# Improve the cache layer\n## Context\nThe API is slow under load.");
  await scoreTicket(p, stubClean);

  const after = await fs.readFile(p, "utf8");
  assert.match(after, /<!--\s*@deterministic score: 91\/100/, "expected a 91/100 annotation (base 100 − one major)");
  assert.match(after, /static\/ticket-has-dod/, "expected the missing-DoD issue recorded in the ticket");
});

test("#26: a ticket WITH a real DoD scores 100 and is left untouched", async () => {
  const good =
    "# Improve the cache layer\n## Goal\nCache GET responses for 60s.\n## Definition of Done\n- a cache hit returns in <5ms (measured)\n## Validation\n- new test asserts the second GET is served from cache";
  const p = await tmpTicket(good);
  await scoreTicket(p, stubClean);

  const after = await fs.readFile(p, "utf8");
  assert.equal(after, good, "a well-specified ticket file must be left untouched (no annotation)");
});

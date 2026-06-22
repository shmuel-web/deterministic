import { test } from "node:test";
import assert from "node:assert/strict";
import { thinTicket } from "../../src/ticket/rules/thin-ticket.js";

const run = async (content: string) => (await thinTicket.run({ target: "ticket", path: "T.md", content })).issues;

test("thin-ticket: a title-only / near-empty ticket is flagged major", async () => {
  assert.equal((await run("# Fix it"))[0]?.severity, "major");
  assert.equal((await run("# Make better 🚀🌕💸"))[0]?.severity, "major");
  assert.equal((await run(""))[0]?.severity, "major");
});

test("thin-ticket: emoji and markdown punctuation do not pad the word count", async () => {
  // Lots of decoration, almost no words → still thin.
  assert.equal((await run("# 🚀🔥💸\n\n## ---\n- ` ` 🌕"))[0]?.severity, "major");
});

test("thin-ticket: a ticket with a real body passes (even if vague — that's another rule's job)", async () => {
  const vagueButNotThin =
    "# To the moon 🚀\nLet's make Deterministic absolutely amazing and 10x better. We need to ship fast and disrupt the whole space. Make the UX clean and modern.";
  assert.deepEqual(await run(vagueButNotThin), [], "a vague-but-substantial ticket is not THIN");
});

test("thin-ticket: a well-specified ticket passes", async () => {
  const good =
    "# Add a --json flag\nPrint a single JSON object so callers can parse it.\n## Definition of Done\n- one JSON object on stdout";
  assert.deepEqual(await run(good), []);
});

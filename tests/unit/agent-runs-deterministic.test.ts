import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentRunsDeterministic } from "../../src/rules/static/agent-runs-deterministic.js";

async function tmpRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-agent-"));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, "utf8");
  }
  return dir;
}
const run = async (root: string) =>
  (await agentRunsDeterministic.run({ target: "repo", path: root })).issues;

test("passes when CLAUDE.md instructs both before + after commands", async () => {
  const claude = "Run `deterministic score ticket` before work and `deterministic score repo` after changes.";
  assert.equal((await run(await tmpRepo({ "CLAUDE.md": claude }))).length, 0);
});

test("flags when the agent context exists but doesn't instruct the loop", async () => {
  const out = await run(await tmpRepo({ "CLAUDE.md": "Read the plan and write good code." }));
  assert.equal(out.length, 1);
  assert.equal(out[0]!.severity, "major");
});

test("silent when there is no agent-context file (has-agent-context owns that)", async () => {
  assert.equal((await run(await tmpRepo({ "README.md": "x" }))).length, 0);
});

test("only the 'after' step present → still flags the missing 'before'", async () => {
  const out = await run(await tmpRepo({ "AGENTS.md": "run `deterministic validate ticket` when done" }));
  assert.equal(out.length, 1);
  assert.match(out[0]!.problem, /score ticket/);
});

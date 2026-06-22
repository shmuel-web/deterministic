import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".github/copilot-instructions.md", "GEMINI.md"];

// The agent must be told to run Deterministic at both ends of its loop.
const BEFORE = /deterministic score ticket|deterministic task/i;
const AFTER = /deterministic score repo|deterministic validate/i;

async function read(p: string): Promise<string> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return "";
  }
}

/**
 * Repo rule (the keystone of adoption): is the coding agent actually wired to RUN
 * Deterministic? The whole system is dormant otherwise — task and execution
 * validation never happen. The agent's context file should tell it to run
 * `score ticket` before starting and `score repo` / `validate ticket` after.
 *
 * Stays silent when there's no agent-context file at all — `has-agent-context`
 * owns that gap, so we don't double-penalize.
 */
export const agentRunsDeterministic: Rule = {
  id: "static/agent-runs-deterministic",
  target: "repo",
  type: "static",
  description: "Checks the agent is configured to run Deterministic in its loop.",
  async run({ path: root }) {
    const blobs = await Promise.all(CONTEXT_FILES.map((f) => read(path.join(root, f))));
    const present = blobs.filter(Boolean);
    if (present.length === 0) return { issues: [] }; // no context file → has-agent-context owns it

    const blob = present.join("\n");
    const missing: string[] = [];
    if (!BEFORE.test(blob)) missing.push("`deterministic score ticket` before starting work");
    if (!AFTER.test(blob)) missing.push("`deterministic score repo` / `validate ticket` after changes");
    if (missing.length === 0) return { issues: [] };

    return {
      issues: [
        {
          problem: `agent context doesn't instruct running Deterministic (missing: ${missing.join("; ")})`,
          fix: "in CLAUDE.md/AGENTS.md, tell the agent to run `deterministic score ticket` before work and `deterministic score repo` after changes",
          severity: "major",
        },
      ],
    };
  },
};

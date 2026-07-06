import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".github/copilot-instructions.md", "GEMINI.md"];

// The agent must be told to run Deterministic after making changes.
const RUNS_DETERMINISTIC = /deterministic score repo|deterministic init/i;

async function read(p: string): Promise<string> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return "";
  }
}

/**
 * Repo rule (the keystone of adoption): is the coding agent actually wired to RUN
 * Deterministic? The whole system is dormant otherwise — the repo is never
 * re-scored and issues never surface. The agent's context file should tell it to
 * run `deterministic score repo` after making changes.
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
    if (RUNS_DETERMINISTIC.test(blob)) return { issues: [] };

    return {
      issues: [
        {
          problem: "agent context doesn't instruct running Deterministic (`deterministic score repo` after changes)",
          fix: "in CLAUDE.md/AGENTS.md, tell the agent to run `deterministic score repo` after making changes",
          severity: "major",
        },
      ],
    };
  },
};

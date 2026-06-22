import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".github/copilot-instructions.md", "GEMINI.md"];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repo rule (AI-readiness): is there an agent-context file (CLAUDE.md / AGENTS.md
 * / …)? It's how a coding agent bootstraps an understanding of the repo — the
 * single biggest agent-context gap when missing.
 */
export const hasAgentContext: Rule = {
  id: "static/has-agent-context",
  target: "repo",
  type: "static",
  description: "Checks for an agent-context file (CLAUDE.md / AGENTS.md / …).",
  async run({ path: root }) {
    for (const f of CONTEXT_FILES) if (await exists(path.join(root, f))) return { issues: [] };
    return {
      issues: [
        {
          problem: "no agent-context file (CLAUDE.md / AGENTS.md / …)",
          fix: "add a CLAUDE.md or AGENTS.md describing the project, how to run it, and conventions",
          severity: "minor",
        },
      ],
    };
  },
};

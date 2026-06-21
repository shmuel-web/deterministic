import { z } from "zod";
import type { Rule, RuleIssue, ModelClient } from "../../core/rule.js";
import { RuleIssueSchema } from "../../core/rule.js";

/**
 * LLM rule: where is this file's *intent* unclear to the next reader/agent? A
 * judgment call no AST can make. Asking for *issues* (not a score) structurally
 * prevents the model from "scoring 98 with praise" — it either names a concrete,
 * fixable legibility problem or returns nothing (a clean 100).
 *
 * The Orchestrator only runs LLM rules when a model is resolved (Principle V).
 * Local models emit flaky JSON, so we validate-and-retry with Zod and degrade to
 * "no issues" on failure rather than crashing (Principle VI).
 */

const IssuesSchema = z.object({ issues: z.array(RuleIssueSchema) });

const prompt = (path: string, content: string) =>
  `You are a senior engineer reviewing a source file for INTENT LEGIBILITY: can a
competent reader or AI agent tell what this file is for and how to change it
safely? Look for unclear naming, muddled structure, missing/misleading docs, or
hidden purpose.

Return ONLY JSON: {"issues": [{"problem": "...", "fix": "...", "severity": "info|minor|major|critical"}]}
- List ONLY real problems that hurt legibility. Each MUST have a concrete fix.
- If the file's intent is already clear, return {"issues": []}. Do NOT invent issues and do NOT praise.

FILE: ${path}
---
${content.slice(0, 8000)}
---`;

/** Parse the first JSON object out of model output (tolerate surrounding chatter). */
function parseIssues(raw: string): RuleIssue[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = IssuesSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.issues : null;
  } catch {
    return null;
  }
}

async function ask(model: ModelClient, path: string, content: string, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const issues = parseIssues(await model.complete(prompt(path, content)));
    if (issues) return issues;
  }
  return null;
}

export const intentLegibility: Rule = {
  id: "llm/intent-legibility",
  target: "file",
  type: "llm",
  description: "Finds places where the file's intent is unclear to a reader/agent.",
  async run({ path, content, model }) {
    if (!model) return { issues: [] }; // defensive: Orchestrator should have errored first
    const issues = await ask(model, path, content ?? "");
    // Unparseable after retry → no issues (don't fabricate problems; Principle VI).
    return { issues: issues ?? [] };
  },
};

import { promises as fs } from "node:fs";
import { z } from "zod";
import type { ModelClient, Rule, RuleIssue, Severity } from "../../core/rule.js";
import { RuleIssueSchema } from "../../core/rule.js";
import { settings } from "../../core/settings.js";
import { inGitRepo, listSourceFiles } from "../../core/git.js";
import { resolveBlastRadius } from "../scout.js";
import { PANEL_REVIEWERS, buildReviewerPrompt, type Reviewer } from "./reviewers.js";

/**
 * The agentic ticket-review panel (spec 004) as ONE `Rule` (`target: ticket`).
 *
 * Slice 1 (#76): the scaffold + file-grounding, with a single reviewer
 * (Architect) end-to-end. It reads the CONTENT of the Scout's blast-radius files
 * and asks each reviewer for material, file-grounded gaps — composing into the
 * same `base − penalties` model as every other rule. The full funnel (a separate
 * applicability gate, the adversarial Defender, the synthesizer) lands in #77–#79.
 *
 * Opt-in (`settings.review.enabled`, default off) — it's the most expensive tier,
 * so it runs only when explicitly enabled on an on-demand `score ticket`.
 */

const IssuesSchema = z.object({ issues: z.array(RuleIssueSchema) });

/** Tolerantly pull {issues:[...]} out of model output (same approach as llm-rule). */
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

/** Panel issues are nudges, not blockers — cap to minor (info stays info). */
function capSeverity(s: Severity): Severity {
  return s === "info" ? "info" : "minor";
}

/** Read the content of the ticket's blast-radius files, bounded by settings. */
async function gatherBlastRadius(ticket: string): Promise<{ path: string; content: string }[]> {
  if (!inGitRepo()) return [];
  let files: string[];
  try {
    files = resolveBlastRadius(ticket, listSourceFiles());
  } catch {
    return [];
  }
  const out: { path: string; content: string }[] = [];
  for (const path of files.slice(0, settings.review.maxFiles)) {
    try {
      const content = await fs.readFile(path, "utf8");
      out.push({ path, content: content.slice(0, settings.review.maxBytesPerFile) });
    } catch {
      // unreadable (deleted, binary, race) — skip; never fabricate grounding.
    }
  }
  return out;
}

/** Run one reviewer's draft, with a single retry, capping + attributing the issues. */
async function runReviewer(reviewer: Reviewer, ticket: string, blastRadius: string, model: ModelClient): Promise<RuleIssue[]> {
  let issues: RuleIssue[] | null = null;
  for (let attempt = 0; attempt <= 1 && !issues; attempt++) {
    issues = parseIssues(await model.complete(buildReviewerPrompt(reviewer, ticket, blastRadius)));
  }
  if (!issues) return []; // unparseable after retry → don't fabricate (Principle VI)
  return issues.map((i) => ({
    problem: `[${reviewer.name}] ${i.problem}`,
    fix: i.fix,
    severity: capSeverity(i.severity),
  }));
}

export const reviewPanel: Rule = {
  id: "agentic/ticket-review",
  target: "ticket",
  type: "llm",
  description:
    "Agentic reviewer panel: expert personas read the ticket + its blast-radius files and flag material, file-grounded gaps (spec 004).",
  async run({ content, model }) {
    if (!settings.review.enabled) return { issues: [] }; // opt-in; the expensive tier
    if (!model) return { issues: [] }; // defensive: orchestrator requires a model for llm rules

    const ticket = content ?? "";
    const files = await gatherBlastRadius(ticket);
    if (files.length === 0) return { issues: [] }; // FR-008: no grounding → stay silent

    const blastRadius = files.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");
    const perReviewer = await Promise.all(PANEL_REVIEWERS.map((r) => runReviewer(r, ticket, blastRadius, model)));
    return { issues: perReviewer.flat() };
  },
};

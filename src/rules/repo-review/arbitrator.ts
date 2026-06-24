import { RuleIssueSchema, type RuleIssue, type Severity } from "../../core/rule.js";
import type { IdentifiedIssue } from "../../core/score.js";
import type { RepoReviewer } from "./reviewers.js";

/**
 * Arbitrator for the repo-review panel (#72): reconcile the reviewers' raw drafts
 * into ONE clean issue list. This is where reconciliation lives — validate each
 * issue against the frozen contract, clamp it to the reviewer's severity ceiling,
 * attribute it (`repo-review/<reviewer>`), and DEDUPE near-identical findings two
 * personas raised about the same gap (architect + testing-expert both flagging the
 * same untested module shouldn't double-count).
 */

const SEV_RANK: Record<Severity, number> = { info: 0, minor: 1, major: 2, critical: 3 };
const rank = (s: Severity): number => SEV_RANK[s];

export interface ReviewerDraft {
  reviewer: RepoReviewer;
  issues: RuleIssue[];
}

/** A loose fingerprint of an issue's subject, for cross-reviewer dedupe. */
function fingerprint(problem: string): string {
  return problem
    .toLowerCase()
    .replace(/[^a-z0-9/.\s]/g, "") // keep words + path-ish chars
    .split(/\s+/)
    .filter((w) => w.length > 3) // drop filler ("the", "a", "is")
    .sort()
    .join(" ");
}

/**
 * Reconcile drafts → attributed, deduped, severity-capped issues. Invalid issues
 * (failing the contract) are dropped, never fabricated. When two reviewers raise
 * the same gap, the higher-severity one wins and keeps its attribution.
 */
export function reconcile(drafts: ReviewerDraft[]): IdentifiedIssue[] {
  const byPrint = new Map<string, IdentifiedIssue>();

  for (const { reviewer, issues } of drafts) {
    for (const raw of issues) {
      const parsed = RuleIssueSchema.safeParse(raw);
      if (!parsed.success) continue; // contract violation → drop, don't fabricate

      const issue = parsed.data;
      const severity: Severity = rank(issue.severity) > rank(reviewer.maxSeverity) ? reviewer.maxSeverity : issue.severity;
      const identified: IdentifiedIssue = { ...issue, severity, ruleId: `repo-review/${reviewer.id}` };

      const key = fingerprint(issue.problem);
      const existing = byPrint.get(key);
      if (!existing || rank(severity) > rank(existing.severity)) byPrint.set(key, identified);
    }
  }

  return [...byPrint.values()];
}

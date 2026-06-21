import { PENALTY, type RuleIssue } from "./rule.js";

/** An issue tagged with the rule that produced it. */
export type IdentifiedIssue = RuleIssue & { ruleId: string };

export interface ScoreResult {
  score: number;
  issues: IdentifiedIssue[];
}

/**
 * Derive a target's score from its issues (constitution Principle III).
 *
 * Start at 100 and subtract each issue's severity penalty. NOT an average —
 * passing rules contribute nothing, so the score is invariant to how many rules
 * ran, and a serious issue dominates instead of being diluted. No issues → 100.
 */
export function score(issues: IdentifiedIssue[]): ScoreResult {
  const penalty = issues.reduce((sum, i) => sum + PENALTY[i.severity], 0);
  return { score: Math.max(0, Math.min(100, 100 - penalty)), issues };
}

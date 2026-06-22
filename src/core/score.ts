// @deterministic score: 97/100
//   [minor] llm/intent-legibility  The file lacks a high-level doc comment indicating its overall purpose, requiring readers to deduce that this module is responsible for calculating scores from detected issues. → Add a JSDoc block at the top of the file (before imports) summarizing that the module's role is determining final target scores based on accumulated rule issues and penalties.
// @deterministic:end
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

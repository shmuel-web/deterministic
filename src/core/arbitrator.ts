// @deterministic score: 94/100  scored: 2026-06-21T08:18:57.505Z
//   static/file-length  100/100  w1  33 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (arbitrate) is 15 lines — within the 50-line cap.
//   llm/intent-legibility  85/100  w3  The file's purpose as a rule signal arbitrator is clear from naming, function signature, and comprehensive comments, though the specific domain context requires some domain knowledge to fully grasp the 'ruleId' and 'score' semantics.
// @deterministic:end
import type { RuleSignal } from "./rule.js";

/** A rule signal tagged with which rule produced it. */
export type IdentifiedSignal = RuleSignal & { ruleId: string };

export interface ArbitratedScore {
  score: number;
  reasoning: string;
  signals: IdentifiedSignal[];
}

/**
 * The Arbitrator resolves many rule signals into one defensible score.
 * Today: a transparent weighted average — the single seam where future
 * strategies (veto, multi-reviewer reconciliation) plug in without changing
 * callers. Output enumerates every signal (Principle III — auditable).
 */
export function arbitrate(signals: IdentifiedSignal[]): ArbitratedScore {
  if (signals.length === 0) {
    return { score: 100, reasoning: "No applicable rules fired.", signals };
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0) || 1;
  const weighted = signals.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
  const score = Math.round(weighted);

  const reasoning = signals
    .map((s) => `[${s.ruleId}] ${s.score}/100 (w${s.weight}): ${s.reasoning}`)
    .join("\n");

  return { score, reasoning, signals };
}

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

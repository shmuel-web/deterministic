import { llmRule } from "../../core/llm-rule.js";

/**
 * Scoped LLM spec-quality rule (FR-002). Judges ONE concern: is the goal
 * measurable? "Improve performance" / "make it better" can't be verified — there
 * is no target an agent (or a reviewer) can check against. Distinct from
 * "has a DoD section": a ticket can have a DoD that's still unmeasurable.
 */
export const unmeasurableGoal = llmRule({
  id: "llm/unmeasurable-goal",
  target: "ticket",
  description: "The ticket's goal must be measurable — a concrete target, not a vague aspiration.",
  topic: "whether the ticket states a MEASURABLE goal — a concrete, checkable target rather than a vague aspiration",
  lookFor: `- a goal like "improve performance", "make it faster", "better UX" with NO target number, threshold, or metric
- success that cannot be objectively verified (no "from X to Y", no measurable acceptance condition)
- adjectives ("clean", "robust", "modern") standing in for a measurable outcome`,
  maxSeverity: "major",
});

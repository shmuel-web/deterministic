import { llmRule } from "../../core/llm-rule.js";

/**
 * Scoped LLM spec-quality rule (#25). Where `ticket-has-dod` checks a done-section
 * *exists* and `unmeasurable-goal` judges the *goal*, this judges the DoD's
 * individual *conditions*: are they concrete and objectively checkable, or
 * hand-wavy ("works correctly", "looks good")? A real DoD section full of
 * subjective bullets is still a DoD you can't verify — that's this rule's catch.
 *
 * Deliberately scoped to the done/acceptance conditions only, and silent when
 * there's no DoD section at all (that's `ticket-has-dod`'s job) — so it never
 * double-counts with the other ticket rules.
 */
export const dodQuality = llmRule({
  id: "llm/dod-quality",
  target: "ticket",
  description: "Each Definition-of-Done / acceptance condition must be concrete and objectively checkable.",
  topic:
    "whether the conditions in the Definition of Done / acceptance criteria are CONCRETE and objectively CHECKABLE — each can be confirmed done with a yes/no observation, not an opinion. Judge ONLY the done/acceptance conditions, not the goal statement.",
  lookFor: `- a DoD / acceptance bullet that is subjective or hand-wavy: "works correctly", "looks good", "is robust", "handles errors properly", "performs well" — with no objective check
- a condition that needs a judgment call to declare done, rather than a yes/no observation or a runnable check
- a "Definition of Done" section that just restates the goal instead of listing checkable conditions
If the ticket has NO Definition of Done / acceptance section at all, return {"issues": []} — that is another rule's concern, not this one's.`,
  maxSeverity: "minor",
});

import { llmRule } from "../../core/llm-rule.js";

/**
 * Scoped LLM spec-quality rule (FR-002). Judges ONE concern: does the ticket say
 * HOW completion will be verified? A goal can be measurable yet give no path to
 * check it — which tests to run, which acceptance step to perform, what to demo.
 * Without a validation path, "done" is a matter of opinion. This is the rule that
 * makes the `validate ticket` command meaningful — it needs something to run.
 */
export const undefinedValidationPath = llmRule({
  id: "llm/undefined-validation-path",
  target: "ticket",
  description: "The ticket must state how completion will be verified (tests, an acceptance check, a demo step).",
  topic: "whether the ticket states a VALIDATION PATH — concretely HOW completion will be checked",
  lookFor: `- no mention of how to verify the work is done (no tests to run, no acceptance check, no demo/QA step)
- a "done" condition that names an outcome but no way to confirm it was reached
- relies on a human eyeballing it with no defined check`,
  maxSeverity: "major",
});

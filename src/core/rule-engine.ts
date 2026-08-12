/** Runs applicable static and focused LLM rules and validates their results. */
import type { ModelClient, Rule, RuleContext } from "./rule.js";
import { RuleResultSchema } from "./rule.js";
import type { IdentifiedIssue } from "./score.js";

export interface RunOptions {
  /** Resolved model for LLM rules. Required when an applicable rule uses one. */
  model?: ModelClient;
}

/**
 * Run every rule for a target. Individual rule failures are isolated so one
 * broken extension cannot prevent the remaining deterministic checks from
 * producing useful results.
 */
export async function runRules(
  rules: Rule[],
  ctx: Omit<RuleContext, "model">,
  options: RunOptions = {},
): Promise<IdentifiedIssue[]> {
  const applicable = rules.filter((rule) => rule.target === ctx.target);

  if (applicable.some((rule) => rule.type === "llm") && !options.model) {
    throw new Error(
      "No LLM configured but this target has LLM rules. Start Ollama (localhost:11434) " +
        "or set DETERMINISTIC_LLM_API_URL + DETERMINISTIC_LLM_API_KEY.",
    );
  }

  const perRule = await Promise.all(
    applicable.map(async (rule): Promise<IdentifiedIssue[]> => {
      let raw;
      try {
        raw = await rule.run({
          ...ctx,
          model: rule.type === "llm" ? options.model : undefined,
        });
      } catch (error) {
        console.warn(`  ! rule ${rule.id} threw and was skipped: ${(error as Error).message}`);
        return [];
      }

      const parsed = RuleResultSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn(`  ! rule ${rule.id} produced an invalid result: ${parsed.error.message}`);
        return [];
      }
      return parsed.data.issues.map((issue) => ({ ...issue, ruleId: rule.id }));
    }),
  );

  return perRule.flat();
}

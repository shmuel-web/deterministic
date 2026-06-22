// @deterministic score: 97/100
//   [minor] llm/intent-legibility  There is no explicit top-level comment describing the module's overall purpose (orchestration and execution flow). → Add a module-level JSDoc block at the very top of the file, such as: /** * Module for orchestrating the running of multiple structured rules against a given context. It manages rule application, error isolation, and aggregation of resulting issues. */
// @deterministic:end
import type { ModelClient, Rule, RuleContext } from "./rule.js";
import { RuleResultSchema } from "./rule.js";
import type { IdentifiedIssue } from "./score.js";

export interface RunOptions {
  /** Resolved model for LLM rules. Required if any applicable rule is `llm` (Principle V). */
  model?: ModelClient;
}

/**
 * The Orchestrator: gather the rules applicable to a target, run static rules
 * inline and LLM rules against the resolved model, validate each result against
 * the contract, and pool every issue (tagged with its rule). A throwing or
 * malformed rule is isolated — it must not poison the rest (FR-002).
 */
export async function runRules(
  rules: Rule[],
  ctx: Omit<RuleContext, "model">,
  options: RunOptions = {},
): Promise<IdentifiedIssue[]> {
  const applicable = rules.filter((r) => r.target === ctx.target);

  // Principle V: judgment is never silently skipped. If an LLM rule applies and
  // no model was resolved, that is an error — not a degraded pass.
  if (applicable.some((r) => r.type === "llm") && !options.model) {
    throw new Error(
      "No LLM configured but this target has LLM rules. Start Ollama (localhost:11434) " +
        "or set DETERMINISTIC_LLM_API_URL + DETERMINISTIC_LLM_API_KEY.",
    );
  }

  // Run rules concurrently; the model is concurrency-limited upstream, so this
  // can't exceed the global LLM cap. Promise.all preserves order, and the score
  // is a penalty sum (order-independent), so results stay deterministic.
  const perRule = await Promise.all(
    applicable.map(async (rule): Promise<IdentifiedIssue[]> => {
      let raw;
      try {
        raw = await rule.run({ ...ctx, model: rule.type === "llm" ? options.model : undefined });
      } catch (err) {
        console.warn(`  ! rule ${rule.id} threw and was skipped: ${(err as Error).message}`);
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

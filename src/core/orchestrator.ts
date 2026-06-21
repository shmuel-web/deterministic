// @deterministic score: 96/100  scored: 2026-06-21T08:19:05.436Z
//   static/file-length  100/100  w1  58 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (for) is 15 lines — within the 50-line cap.
//   llm/intent-legibility  90/100  w3  The file's purpose as a rule execution orchestrator is clear from the name, comments, and function signature; naming conventions are consistent and descriptive, though some context like 'Principle V' could be better documented.
// @deterministic:end
import type { ModelClient, Rule, RuleContext } from "./rule.js";
import { RuleSignalSchema } from "./rule.js";
import type { IdentifiedSignal } from "./arbitrator.js";

/** A rule plus the weight a project assigns it (see deterministic.config.ts). */
export interface ConfiguredRule {
  rule: Rule;
  /** Overrides the rule's self-reported weight when present. */
  weight?: number;
}

export interface RunOptions {
  /** Resolved model for LLM rules. Required if any applicable rule is `llm` (Principle V). */
  model?: ModelClient;
}

/**
 * The Orchestrator: gather the rules applicable to a target, run static rules
 * inline and LLM rules against the resolved model, validate each output against
 * the contract, and collect identified signals. A throwing rule is isolated —
 * it must not poison the whole score (FR-002).
 */
export async function runRules(
  configured: ConfiguredRule[],
  ctx: Omit<RuleContext, "model">,
  options: RunOptions = {},
): Promise<IdentifiedSignal[]> {
  const applicable = configured.filter((c) => c.rule.target === ctx.target);

  // Principle V: judgment is never silently skipped. If an LLM rule applies and
  // no model was resolved, that is an error — not a degraded pass.
  const needsModel = applicable.some((c) => c.rule.type === "llm");
  if (needsModel && !options.model) {
    throw new Error(
      "No LLM configured but this target has LLM rules. Start Ollama (localhost:11434) " +
        "or set DETERMINISTIC_LLM_API_URL + DETERMINISTIC_LLM_API_KEY.",
    );
  }

  const signals: IdentifiedSignal[] = [];
  for (const { rule, weight } of applicable) {
    let raw;
    try {
      raw = await rule.run({ ...ctx, model: rule.type === "llm" ? options.model : undefined });
    } catch (err) {
      console.warn(`  ! rule ${rule.id} threw and was skipped: ${(err as Error).message}`);
      continue;
    }
    const parsed = RuleSignalSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`  ! rule ${rule.id} produced an invalid signal: ${parsed.error.message}`);
      continue;
    }
    signals.push({ ...parsed.data, weight: weight ?? parsed.data.weight, ruleId: rule.id });
  }
  return signals;
}

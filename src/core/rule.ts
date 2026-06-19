import { z } from "zod";

/**
 * THE RULE CONTRACT — the frozen keystone (constitution Principle I).
 * Changing this shape is a MAJOR governance event. Keep it language-agnostic:
 * any TypeScript-specific logic lives INSIDE individual rules, never here.
 * See specs/001-rule-engine/contracts/rule-contract.md.
 */

export type RuleTarget = "file" | "repo" | "ticket";
export type RuleType = "static" | "llm";

/** The validated output every rule returns — the audit atom (Principle III). */
export const RuleSignalSchema = z.object({
  score: z.number().min(0).max(100),
  weight: z.number().min(0),
  reasoning: z.string().min(1),
});
export type RuleSignal = z.infer<typeof RuleSignalSchema>;

/** Minimal LLM client. Implemented by the Ollama/API backends (see model.ts). */
export interface ModelClient {
  complete(prompt: string): Promise<string>;
}

/** What a rule receives. `model` is present only for LLM rules (Orchestrator-injected). */
export interface RuleContext {
  target: RuleTarget;
  path: string;
  content?: string;
  model?: ModelClient;
}

/** The contract. Every rule — static or LLM, community or custom — implements this. */
export interface Rule {
  id: string;
  target: RuleTarget;
  type: RuleType;
  description?: string;
  run(context: RuleContext): RuleSignal | Promise<RuleSignal>;
}

// @deterministic score: 98/100  scored: 2026-06-21T08:19:07.292Z
//   static/file-length  100/100  w1  42 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  No brace-delimited functions detected — rule inert.
//   llm/intent-legibility  95/100  w3  Clear intent: this is a rule engine contract defining types and interfaces for static and LLM-based rules with well-documented purpose and governance constraints.
// @deterministic:end
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

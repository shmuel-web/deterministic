import { z } from "zod";

/**
 * THE RULE CONTRACT v2 — the frozen keystone (constitution Principle I).
 *
 * A rule does NOT return a score. It returns the **issues** it found, each with a
 * concrete `fix` and a `severity`. The engine derives the file score by
 * subtracting each issue's penalty from 100. This makes praise structurally
 * impossible: no issues → 100; every point lost maps to a named, fixable problem.
 *
 * Keep this contract language-agnostic — TypeScript-specific logic lives INSIDE
 * individual rules, never here. See specs/001-rule-engine/contracts/rule-contract.md.
 */

export type RuleTarget = "file" | "repo";
export type RuleType = "static" | "llm";

/** Issue severity → penalty, on a clean 3× geometric scale. */
export type Severity = "info" | "minor" | "major" | "critical";
export const PENALTY: Record<Severity, number> = { info: 1, minor: 3, major: 9, critical: 27 };

/** A single, actionable finding — the unit a rule speaks in (Principle III). */
export const RuleIssueSchema = z.object({
  /** What's wrong — include specifics (counts, line numbers, the offending name). */
  problem: z.string().min(1),
  /** The concrete change that resolves it. If you can't name a fix, it isn't a real issue. */
  fix: z.string().min(1),
  severity: z.enum(["info", "minor", "major", "critical"]),
});
export type RuleIssue = z.infer<typeof RuleIssueSchema>;

/** What every rule returns. Empty issues ⟺ a clean pass. No score, no weight. */
export const RuleResultSchema = z.object({
  issues: z.array(RuleIssueSchema),
});
export type RuleResult = z.infer<typeof RuleResultSchema>;

/** Per-call generation options (optional; backends apply what they support). */
export interface CompleteOptions {
  /** Hard output-token ceiling for THIS call — safe only for tiny/bounded outputs (e.g. a boolean). */
  maxTokens?: number;
  /** Constrain output to valid JSON (Ollama `format:json` / OpenAI `json_object`) — kills preamble rambling. */
  json?: boolean;
}

/** Minimal LLM client. Implemented by the Ollama/API backends (see model.ts). */
export interface ModelClient {
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}

/** What a rule receives. `model` is present only for LLM rules. */
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
  run(context: RuleContext): RuleResult | Promise<RuleResult>;
}

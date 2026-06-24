import { z } from "zod";
import type { ExecResult } from "./exec.js";

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

export type RuleTarget = "file" | "repo" | "ticket";
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
  /** A label for this call in dev traces (#90), e.g. "gate" / "draft" / "defender". Ignored when tracing is off. */
  label?: string;
}

/** Minimal LLM client. Implemented by the Ollama/API backends (see model.ts). */
export interface ModelClient {
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}

/**
 * The EXECUTION capability (#70): run one allowlisted project command and read
 * its output. Injected into `RuleContext.exec` by the Orchestrator ONLY for rules
 * that declare `needsExec` AND only when execution is opted in (off by default —
 * running commands is the scariest capability, so it's explicit). Backed by
 * `safeExec`: no shell, allowlist-gated, hard timeout, and it NEVER throws — a
 * rejected/failed command comes back as `{ ok: false }`, a neutral signal the
 * rule scores from without crashing the run.
 */
export type RuleExec = (command: string) => Promise<ExecResult>;

/**
 * What a rule receives. `model` is present only for LLM rules, and `exec` only
 * for execution rules (`needsExec`) when execution is enabled — both are
 * Orchestrator-injected capabilities, absent otherwise.
 */
export interface RuleContext {
  target: RuleTarget;
  path: string;
  content?: string;
  model?: ModelClient;
  exec?: RuleExec;
}

/** The contract. Every rule — static or LLM, community or custom — implements this. */
export interface Rule {
  id: string;
  target: RuleTarget;
  type: RuleType;
  description?: string;
  /**
   * This rule needs the EXECUTION capability (#70 / spec 002). When true, the
   * Orchestrator injects `ctx.exec` — but only if execution is opted in; when
   * it's off, `ctx.exec` is absent and the rule must degrade to `{ issues: [] }`.
   */
  needsExec?: boolean;
  run(context: RuleContext): RuleResult | Promise<RuleResult>;
}

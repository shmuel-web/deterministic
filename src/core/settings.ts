/**
 * Project settings (the footprint is a guest — opt-out, default on).
 *
 * Lives in its own module so rules can read it without importing the config
 * (which imports the rules — that would be a circular dependency).
 */
export const settings = {
  /** Write DETERMINISTIC.md + the one-line README score block on init / score repo. */
  writeSurfaces: true,
  /**
   * LLM output ceiling (#85). Generation is the scoring bottleneck (~6–7 tok/s on
   * a laptop GPU). A cap CAN cut latency, but it's a sharp tool: if the model
   * hasn't finished its JSON by the limit, the response is truncated mid-object,
   * unparseable, and the issue is LOST (recall collapses, not just verbosity).
   * So it's OFF by default (0 = no cap). Set it (or DETERMINISTIC_MAX_OUTPUT_TOKENS)
   * only with headroom above the model's real output, or when you accept the
   * recall trade. The safe speed lever is a faster model (#86), not this.
   */
  llm: {
    maxOutputTokens: 0,
  },
  /**
   * Agentic execution rules (spec 002) — let a rule RUN a tool (coverage, etc.).
   * OFF by default: running commands is the scariest capability, so it's opt-in.
   */
  execution: {
    enabled: false,
    timeoutMs: 120_000,
  },
  /**
   * Agentic ticket-review panel (spec 004) — the multi-reviewer panel that reads
   * the blast-radius files. OFF by default: it's the most expensive tier (many
   * LLM calls), so it's opt-in and runs only on-demand (`score ticket`).
   */
  review: {
    enabled: false,
    /**
     * Single-pass review limits. Files are fed to reviewers WHOLE (no truncation —
     * a half-function reads as broken code). If the blast radius exceeds these, the
     * panel ERRORS with a "split the ticket" finding rather than truncate or blow
     * the context window. Chunked multi-pass review for large radii is a follow-up.
     */
    maxFiles: 12,
    maxTotalBytes: 80_000, // ≈ 20k tokens — leaves room for ticket + prompt + output in a 32k window
    /**
     * Adversarial Defender (spec 004, FR-006): challenges each drafted issue,
     * keeping only those that survive. The anti-overshoot knob:
     *   "strict"  — high bar; refute unless concretely material (default).
     *   "lenient" — only refute the clearly-spurious.
     *   "off"     — no Defender pass (for ablation / measuring its effect).
     */
    defender: "strict" as "strict" | "lenient" | "off",
  },
  /**
   * Agentic REPO-review panel (#72) — expert personas (Architect, Testing-expert)
   * reviewing the whole project. OFF by default: it's the expensive judgment tier
   * (several LLM calls over assembled repo context), so it's opt-in and meant for
   * `init` / on-demand, not every `score repo`.
   */
  repoReview: {
    enabled: false,
    /** Orchestrate the panel with Mastra (#72) instead of the hand-rolled loop. */
    useMastra: false,
  },
};

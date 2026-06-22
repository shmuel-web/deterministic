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
    /** Cap the blast-radius context fed to reviewers, to bound prompt size/cost. */
    maxFiles: 6,
    maxBytesPerFile: 4_000,
    /**
     * Adversarial Defender (spec 004, FR-006): challenges each drafted issue,
     * keeping only those that survive. The anti-overshoot knob:
     *   "strict"  — high bar; refute unless concretely material (default).
     *   "lenient" — only refute the clearly-spurious.
     *   "off"     — no Defender pass (for ablation / measuring its effect).
     */
    defender: "strict" as "strict" | "lenient" | "off",
  },
};

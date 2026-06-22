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
};

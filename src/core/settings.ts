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
};

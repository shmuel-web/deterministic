// @deterministic score: 99/100  scored: 2026-06-21T11:58:14.056Z
//   llm/intent-legibility  98/100  w3  The detailed doc comments explain the architectural role, complexity, and purpose perfectly, making safe implementation guidance explicit.
//   (3 rules passed)
// @deterministic:end
/**
 * `deterministic init` — the expensive first run: score and annotate EVERY file
 * in the repo and establish the baseline repo score. O(whole repo); run once.
 * Afterwards `score repo` is cheap because it composes the annotations init wrote.
 *
 * Lane 1.
 */
export async function init(): Promise<void> {
  throw new Error("init is not implemented yet — Lane 1 (expensive baseline: annotate every file).");
}

// @deterministic score: 100/100 — no issues
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

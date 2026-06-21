// @deterministic score: 89/100  scored: 2026-06-21T08:18:45.223Z
//   static/file-length  100/100  w1  11 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (init) is 3 lines — within the 50-line cap.
//   llm/intent-legibility  75/100  w3  Purpose is clear from name and comments but implementation is missing, making it obvious this is a placeholder for expensive repository initialization.
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

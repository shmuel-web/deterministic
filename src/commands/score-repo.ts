// @deterministic score: 85/100  scored: 2026-06-21T08:18:48.957Z
//   static/file-length  100/100  w1  11 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (scoreRepo) is 3 lines — within the 50-line cap.
//   llm/intent-legibility  65/100  w3  File purpose is somewhat clear from name and comment but implementation is incomplete and lacks specific details about the scoring algorithm or how to safely configure it.
//   > next: File purpose is somewhat clear from name and comment but implementation is incomplete and lacks specific details about the scoring algorithm or how to safely configure it.
// @deterministic:end
/**
 * `deterministic score repo` — the cheap, performant repo score: compose from
 * the in-file annotations `init` wrote, re-scoring only changed files. No
 * O(whole-repo) work (Principle IV). Requires `init` to have run first.
 *
 * Lane 1.
 */
export async function scoreRepo(): Promise<void> {
  throw new Error("score repo is not implemented yet — Lane 1 (incremental composer; run `deterministic init` first).");
}

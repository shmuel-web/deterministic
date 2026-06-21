// @deterministic score: 99/100  scored: 2026-06-21T11:58:43.849Z
//   llm/intent-legibility  98/100  w3  The detailed JSDoc provides crystal-clear intent by explaining the precise function, necessary prerequisites (init), and underlying performance requirements.
//   (3 rules passed)
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

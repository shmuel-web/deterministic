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

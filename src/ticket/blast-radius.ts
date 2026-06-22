import type { RepoIndex } from "../core/index-store.js";
import { fileScore } from "../core/index-store.js";

/**
 * Turn a ticket's resolved blast radius into its score BASE (spec 003, FR-003/004).
 *
 * The base is the **average** of the touched files' cached scores — the ticket
 * inherits the health of the code it will change. Average (not min / sum) so a
 * wide blast radius of mildly-imperfect files isn't over-penalized, and NOT the
 * repo score (which averages the whole repo and would dilute the risk *up*).
 *
 * Empty blast radius → base 100: no code signal, so the ticket score comes from
 * its spec-quality penalties alone (the FR-005 degrade path). Read-only: we pull
 * cached file scores, never re-score a file.
 */
export interface BlastRadius {
  files: { path: string; score: number }[];
  base: number;
  /** True when no files were resolved — caller should note execution-risk was skipped (FR-005). */
  degraded: boolean;
}

export function computeBlastRadius(index: RepoIndex, files: string[]): BlastRadius {
  const scored = files.map((path) => ({ path, score: fileScore(index, path) }));
  if (scored.length === 0) return { files: [], base: 100, degraded: true };
  const base = Math.round(scored.reduce((sum, f) => sum + f.score, 0) / scored.length);
  return { files: scored, base, degraded: false };
}

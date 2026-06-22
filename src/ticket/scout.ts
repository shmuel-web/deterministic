import path from "node:path";

/**
 * The Scout (spec 003, FR-003 — heuristic v1). Resolves a ticket's BLAST RADIUS:
 * the files it would change. Reads only the ticket text + the repo's file list —
 * no model. The agentic Scout (infer files from described *behavior*, not just
 * names) is a later upgrade on this same `(ticketText, sourceFiles) → files[]`
 * seam.
 *
 * Precision over recall: we claim a file ONLY when the ticket actually names it —
 * by repo-relative path, by filename-with-extension, or by a backtick-quoted
 * basename. We deliberately do NOT match a bare word against a file stem (so the
 * word "git" in prose doesn't drag in `git.ts`); a stem only counts inside
 * backticks, where the author clearly meant a code token. A wrong blast radius
 * would move the base for no reason, so silence beats a guess.
 */

const CODE_EXT = /\.(tsx?|jsx?|mjs|cjs|py|go|rb|java|rs|c|cc|cpp|h|hpp|cs|php|swift|kt|kts|scala|sh|ya?ml|json|md)$/i;

/** Strip a backtick span down to a comparable token (drop call parens, member access, quotes). */
function normalizeTick(raw: string): string {
  return raw.trim().toLowerCase().replace(/\(\)$/, "").replace(/^[`'"]+|[`'"]+$/g, "");
}

export function resolveBlastRadius(ticketText: string, sourceFiles: string[]): string[] {
  const text = ticketText.toLowerCase();
  const ticks = [...ticketText.matchAll(/`([^`]+)`/g)].map((m) => normalizeTick(m[1]!));
  const hit = new Set<string>();

  for (const file of sourceFiles) {
    const rel = file.toLowerCase();
    const base = path.posix.basename(rel); // e.g. orchestrator.ts
    const stem = base.replace(CODE_EXT, ""); // e.g. orchestrator

    const named =
      text.includes(rel) || // full repo-relative path, e.g. "src/core/git.ts"
      text.includes(base) || // filename with extension, e.g. "git.ts" (extension guards prose)
      ticks.some(
        (t) => t === rel || t === base || path.posix.basename(t) === base || (stem.length >= 4 && t === stem),
      );

    if (named) hit.add(file);
  }
  return [...hit];
}

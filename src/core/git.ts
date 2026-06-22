// @deterministic score: 91/100
//   [minor] llm/intent-legibility  The file lacks a module-level doc comment indicating its overall purpose (i.e., managing Git interactions for source code scope calculation), making it unclear at a glance what the entire file provides. → Add a high-level JSDoc block immediately before any exports, summarizing that this module handles interaction with Git to determine scorable files and changes within a repository context.
//   [minor] llm/intent-legibility  The exported function `inGitRepo()` is missing documentation, hindering understanding of its usage and return value. → Add a JSDoc comment to `inGitRepo` detailing that it checks if the current working directory is inside a Git repository using 'git rev-parse --is-inside-work-tree'.
//   [minor] llm/intent-legibility  The exported function `headSha()` is missing documentation, making its purpose unclear to a reader only judging by the name and code. → Add a JSDoc comment to `headSha` explaining that it retrieves the SHA hash of the current commit HEAD using 'git rev-parse HEAD'.
// @deterministic:end
import { execFileSync } from "node:child_process";
import { getCommentStyle } from "./comment-style.js";

/**
 * Git-backed repo + change detection (issue #63 / Lane 1). Git is a hard
 * dependency: `init` scores everything once, then `score repo` re-scores only
 * what `git diff` reports as changed since the last scored commit. A non-git
 * fallback (mtime/hash) is tracked separately, out of scope here.
 */

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function inGitRepo(): boolean {
  try {
    return git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

export function headSha(): string {
  return git(["rev-parse", "HEAD"]);
}

// Vendored tooling / generated output we never score by default. (A configurable
// include/exclude is a follow-up; this is the ESLint-style "ignore by default".)
const DEFAULT_EXCLUDE = [".claude/", ".specify/", "dist/", "node_modules/", ".deterministic/", "DETERMINISTIC.md"];

/** Files we actually score: a known comment style, and not in an excluded path. */
function isScorable(path: string): boolean {
  if (DEFAULT_EXCLUDE.some((p) => path.startsWith(p))) return false;
  return getCommentStyle(path) !== null;
}

/** All tracked, scorable source files in the repo. */
export function listSourceFiles(): string[] {
  return git(["ls-files"]).split("\n").filter(Boolean).filter(isScorable);
}

/**
 * Files changed since `sinceSha` (committed diffs) PLUS uncommitted working-tree
 * changes and untracked files. Deletions are included so the index can drop them.
 * If `sinceSha` is null/unknown, returns all source files (treat as a full scan).
 */
export function changedSince(sinceSha: string | null): { changed: string[]; deleted: string[] } {
  if (!sinceSha) return { changed: listSourceFiles(), deleted: [] };

  const names = new Set<string>();
  try {
    for (const f of git(["diff", "--name-only", sinceSha, "HEAD"]).split("\n")) if (f) names.add(f);
  } catch {
    // sinceSha not reachable (rebase, shallow clone, branch switch) → full rescan.
    return { changed: listSourceFiles(), deleted: [] };
  }
  // working tree (modified, staged) + untracked
  for (const line of git(["status", "--porcelain"]).split("\n")) {
    const f = line.slice(3).trim();
    if (f) names.add(f);
  }

  const changed: string[] = [];
  const deleted: string[] = [];
  for (const f of names) {
    if (!isScorable(f)) continue;
    // A path that no longer exists on disk was deleted.
    try {
      execFileSync("test", ["-f", f]);
      changed.push(f);
    } catch {
      deleted.push(f);
    }
  }
  return { changed, deleted };
}

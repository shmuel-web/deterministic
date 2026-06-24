// @deterministic score: 93/100
//   [minor] static/cognitive-complexity  worst function `changedSince` has cognitive complexity 24 (file avg: 6) — 9 over the 15 cap → reduce nesting depth, extract inner branches into helper functions, or flatten conditional chains
//   [minor] llm/intent-legibility  The file's main exported symbol lacks a clear overall purpose doc comment. → Add a doc comment at the top of the file indicating its purpose related to Git-backed repo and change detection.
//   [info] static/fan-in  6 files import this module — high fan-in means changes here have a wide blast radius → extract a narrower interface, split into sub-modules, or introduce an indirection layer
// @deterministic:end
import { execFileSync } from "node:child_process";
import { isScorable } from "./scope.js";

/**
 * Git-backed repo + change detection (issue #63 / Lane 1). When git is present
 * it is the richest detector: `init` scores everything once, then `score repo`
 * re-scores only what `git diff` reports as changed since the last scored commit,
 * and deletions fall out of the diff. The non-git fallback (mtime/hash) lives in
 * `change-detect.ts` (#65); both share one definition of "scorable" via scope.ts.
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

/** All tracked, scorable source files in the repo. */
export function listSourceFiles(): string[] {
  return git(["ls-files"]).split("\n").filter(Boolean).filter(isScorable);
}

/**
 * Stage the given files and create a commit with the standard annotation message.
 * No-op if nothing is staged after `git add` (files were already up-to-date).
 * Throws if git commit fails (bad identity, hook rejection, etc.).
 */
export function commitAnnotations(files: string[]): void {
  if (files.length === 0) return;
  git(["add", "--", ...files]);
  try {
    git(["diff", "--cached", "--quiet"]);
    // exit 0 → nothing staged, nothing to commit
  } catch {
    // exit non-zero → staged changes exist, proceed
    git(["commit", "-m", "chore: apply deterministic annotations"]);
  }
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

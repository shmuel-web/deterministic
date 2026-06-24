import { promises as fs } from "node:fs";
import path from "node:path";
import { getCommentStyle } from "./comment-style.js";

/**
 * What counts as a scorable source file — the shared scope used by BOTH the
 * git-backed file list and the non-git filesystem walker (#65), so the two paths
 * can never drift on which files Deterministic considers.
 */

// Vendored tooling / generated output we never score by default. (A configurable
// include/exclude is a follow-up; this is the ESLint-style "ignore by default".)
export const DEFAULT_EXCLUDE = [
  ".git/", ".claude/", ".specify/", "dist/", "node_modules/",
  ".deterministic/", "DETERMINISTIC.md", "examples/",
];

/** Normalize to POSIX-style separators so excludes match on every platform. */
function posix(p: string): string {
  return p.split(path.sep).join("/");
}

/** A file we score: a known comment style, and not under an excluded path. */
export function isScorable(p: string): boolean {
  const rel = posix(p);
  if (DEFAULT_EXCLUDE.some((e) => rel === e || rel.startsWith(e))) return false;
  return getCommentStyle(rel) !== null;
}

/**
 * Recursively list scorable source files under `root` WITHOUT git — the fallback
 * enumerator for non-git folders (#65). Returns POSIX-relative, sorted paths so
 * the order is deterministic. Excluded directories are pruned (not descended).
 */
export async function walkSourceFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir → skip, never throw
    }
    for (const e of entries) {
      const rel = posix(path.relative(root, path.join(dir, e.name)));
      const probe = e.isDirectory() ? rel + "/" : rel;
      if (DEFAULT_EXCLUDE.some((x) => probe === x || probe.startsWith(x))) continue;
      if (e.isDirectory()) await walk(path.join(dir, e.name));
      else if (isScorable(rel)) out.push(rel);
    }
  }
  await walk(root);
  return out.sort();
}

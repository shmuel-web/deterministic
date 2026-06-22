import { promises as fs } from "node:fs";
import path from "node:path";
import { score } from "./score.js";
import type { IdentifiedIssue } from "./score.js";

/**
 * Problems-only score cache (Lane 1). We never store "100" — absence means clean.
 * The index holds the issues of FLAGGED files plus the last-scored commit SHA, so
 * `score repo` can re-score only what git says changed and compose the repo score
 * without re-reading the tree (Principle IV). It's a gitignored derived cache.
 */
export interface RepoIndex {
  lastSha: string | null;
  problems: Record<string, IdentifiedIssue[]>; // path → issues (clean files absent)
}

const DIR = ".deterministic";
const FILE = path.join(DIR, "index.json");

export async function loadIndex(): Promise<RepoIndex> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as RepoIndex;
  } catch {
    return { lastSha: null, problems: {} };
  }
}

export async function saveIndex(index: RepoIndex): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(index, null, 2) + "\n", "utf8");
}

/** Record a file's result: store its issues if flagged, drop it if clean. */
export function record(index: RepoIndex, file: string, issues: IdentifiedIssue[]): void {
  if (issues.length > 0) index.problems[file] = issues;
  else delete index.problems[file]; // clean (or newly-clean) → no record
}

export function remove(index: RepoIndex, file: string): void {
  delete index.problems[file];
}

/**
 * Repo score (v1 — tunable): the average of per-file scores, where every file
 * not in `problems` counts as 100. `totalFiles` is the current source-file count.
 */
export function repoScore(index: RepoIndex, totalFiles: number): number {
  if (totalFiles <= 0) return 100;
  let sum = 100 * totalFiles;
  for (const issues of Object.values(index.problems)) {
    sum -= 100 - score(issues).score; // subtract each flagged file's deficit from 100
  }
  return Math.max(0, Math.min(100, Math.round(sum / totalFiles)));
}

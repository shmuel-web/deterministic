// @deterministic score: 94/100
//   [minor] llm/intent-legibility  The file lacks a top-level doc block that explains its overall purpose (intent). A reader cannot determine what this entire `index-store` module manages without reading through all implementations. → Add a descriptive multi-line doc comment at the very top of `src/core/index-store.ts` detailing that this file handles the persistent storage, loading, and saving of the deterministic repository score index (cache).
//   [minor] llm/intent-legibility  The core exported function `loadIndex()` lacks a doc comment explaining what it does. Since this is responsible for retrieving the critical cached state, its purpose must be explicitly documented. → Add a JSDoc block immediately preceding `export async function loadIndex(): Promise<RepoIndex>` describing that this function reads and deserializes the index cache from disk (handling potential errors/missing files).
// @deterministic:end
import { promises as fs } from "node:fs";
import path from "node:path";
import { score } from "./score.js";
import type { IdentifiedIssue } from "./score.js";
import { PENALTY } from "./rule.js";

/**
 * Problems-only score cache (Lane 1). We never store "100" — absence means clean.
 * The index holds the issues of FLAGGED files, the repo-level issues (from
 * repo-target rules), and the last-scored commit SHA, so `score repo` can
 * re-score only what git says changed and compose the repo score without
 * re-reading the tree (Principle IV). It's a gitignored derived cache.
 */
export interface RepoIndex {
  lastSha: string | null;
  problems: Record<string, IdentifiedIssue[]>; // path → issues (clean files absent)
  repoIssues: IdentifiedIssue[]; // repo-target rule findings (no tests, no coverage, …)
}

const DIR = ".deterministic";
const FILE = path.join(DIR, "index.json");

export async function loadIndex(): Promise<RepoIndex> {
  try {
    const idx = JSON.parse(await fs.readFile(FILE, "utf8")) as RepoIndex;
    idx.repoIssues ??= []; // tolerate older indexes
    return idx;
  } catch {
    return { lastSha: null, problems: {}, repoIssues: [] };
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
 * A single file's cached score: derived from its stored issues, or 100 when the
 * file is absent (clean — we never store 100). This is the read seam the ticket
 * module composes its blast-radius base from — read-only, never re-scores a file
 * (spec 003, FR-004). Lives in `core` so both module sides may use it (ADR-0001).
 */
export function fileScore(index: RepoIndex, file: string): number {
  const issues = index.problems[file];
  return issues ? score(issues).score : 100;
}

/**
 * Repo score (v1 — tunable, see #66). Start at 100 and subtract two things:
 *  - repo-level penalties (from repo-target rules) — absolute, repo-wide problems
 *    like "no tests" hit hard regardless of repo size;
 *  - the AVERAGE per-file deficit — normalized so a big repo isn't unfairly tanked
 *    by one bad file.
 */
export function repoScore(index: RepoIndex, totalFiles: number): number {
  const repoPenalty = index.repoIssues.reduce((s, i) => s + PENALTY[i.severity], 0);
  let fileDeficit = 0;
  for (const issues of Object.values(index.problems)) fileDeficit += 100 - score(issues).score;
  const avgFileDeficit = totalFiles > 0 ? fileDeficit / totalFiles : 0;
  return Math.max(0, Math.min(100, Math.round(100 - repoPenalty - avgFileDeficit)));
}

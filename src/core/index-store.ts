// @deterministic score: 94/100
//   [minor] llm/intent-legibility  The file lacks a top-level doc block that explains its overall purpose (intent). A reader cannot determine what this entire `index-store` module manages without reading through all implementations. → Add a descriptive multi-line doc comment at the very top of `src/core/index-store.ts` detailing that this file handles the persistent storage, loading, and saving of the deterministic repository score index (cache).
//   [minor] llm/intent-legibility  The core exported function `loadIndex()` lacks a doc comment explaining what it does. Since this is responsible for retrieving the critical cached state, its purpose must be explicitly documented. → Add a JSDoc block immediately preceding `export async function loadIndex(): Promise<RepoIndex>` describing that this function reads and deserializes the index cache from disk (handling potential errors/missing files).
// @deterministic:end
import { promises as fs } from "node:fs";
import path from "node:path";
import { score } from "./score.js";
import type { IdentifiedIssue } from "./score.js";
import { PENALTY } from "./rule.js";
import type { ScanMarker } from "./change-detect.js";

/**
 * Problems-only score cache (Lane 1). We never store "100" — absence means clean.
 * The index holds the issues of FLAGGED files, the repo-level issues (from
 * repo-target rules), and the last-scored commit SHA, so `score repo` can
 * re-score only what git says changed and compose the repo score without
 * re-reading the tree (Principle IV). It's a gitignored derived cache.
 */
export interface RepoIndex {
  /** Snapshot of repo state at the last scan, by the active detector (git/mtime/hash, #65). */
  lastScan: ScanMarker | null;
  problems: Record<string, IdentifiedIssue[]>; // path → issues (clean files absent)
  repoIssues: IdentifiedIssue[]; // repo-target rule findings (no tests, no coverage, …)
}

const DIR = ".deterministic";
const FILE = path.join(DIR, "index.json");

export async function loadIndex(): Promise<RepoIndex> {
  try {
    // `lastSha` is the pre-#65 marker (git-only); migrate it to a git ScanMarker.
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as RepoIndex & { lastSha?: string | null };
    const idx: RepoIndex = {
      lastScan: raw.lastScan ?? (raw.lastSha ? { kind: "git", sha: raw.lastSha } : null),
      problems: raw.problems ?? {},
      repoIssues: raw.repoIssues ?? [], // tolerate older indexes
    };
    return idx;
  } catch {
    return { lastScan: null, problems: {}, repoIssues: [] };
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
 * file is absent (clean — we never store 100). Read-only — reading a cached score
 * never re-scores the file.
 */
export function fileScore(index: RepoIndex, file: string): number {
  const issues = index.problems[file];
  return issues ? score(issues).score : 100;
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Sum of repo-level penalties (absolute, repo-wide problems like "no tests"). */
function repoPenalty(index: RepoIndex): number {
  return index.repoIssues.reduce((s, i) => s + PENALTY[i.severity], 0);
}

/** The single lowest-scoring flagged file (the repo's weakest link), or null if all clean. */
export function worstFile(index: RepoIndex): { file: string; score: number } | null {
  let worst: { file: string; score: number } | null = null;
  for (const [file, issues] of Object.entries(index.problems)) {
    const s = score(issues).score;
    if (worst === null || s < worst.score) worst = { file, score: s };
  }
  return worst;
}

/**
 * Repo HEALTH (the former v1 score) — count-invariant: repo penalties plus the
 * AVERAGE per-file deficit. Answers "how broadly clean is the tree?" — a big repo
 * isn't tanked by one bad file. Surfaced as a SECONDARY number on the dashboard.
 */
export function repoHealth(index: RepoIndex, totalFiles: number): number {
  let fileDeficit = 0;
  for (const issues of Object.values(index.problems)) fileDeficit += 100 - score(issues).score;
  const avgFileDeficit = totalFiles > 0 ? fileDeficit / totalFiles : 0;
  return clamp(100 - repoPenalty(index) - avgFileDeficit);
}

/**
 * Repo SCORE v2 (#66) — the HEADLINE. Deterministic's thesis (README) is "not an
 * average: one serious issue dominates." v1 averaged per-file deficits, which let
 * a critical file hide in a large tree — the opposite of that promise. v2 applies
 * the file model AT REPO SCALE: a repo is only as strong as its WORST file, on top
 * of absolute repo-wide penalties. Averaging now lives in `repoHealth` so breadth
 * stays visible on the dashboard, but the headline answers the real question —
 * "is this repo safe for an agent to act on?" — by its weakest link.
 *
 * See docs/adr/0002-repo-score-formula-v2.md for the decision and alternatives.
 */
export function repoScore(index: RepoIndex): number {
  const worst = worstFile(index);
  const worstDeficit = worst ? 100 - worst.score : 0;
  return clamp(100 - repoPenalty(index) - worstDeficit);
}

import { scoreManyFiles } from "./score-file.js";
import { inGitRepo, headSha, listSourceFiles } from "../core/git.js";
import { loadIndex, saveIndex, record, repoScore, type RepoIndex } from "../core/index-store.js";

/**
 * `deterministic init` — the expensive first run: score & annotate EVERY source
 * file, build the problems-only index, and stamp the current commit so later
 * `score repo` runs are incremental. O(whole repo); run once.
 */
export async function init(): Promise<void> {
  if (!inGitRepo()) throw new Error("init requires a git repository (git is used for change detection).");

  const files = listSourceFiles();
  console.log(`\n  Scoring ${files.length} files…`);
  const results = await scoreManyFiles(files);

  const index: RepoIndex = { lastSha: headSha(), problems: {} };
  for (const r of results) record(index, r.path, r.issues);
  await saveIndex(index);

  summarize(results.length, index, files.length);
}

/** Print the repo score + the flagged files (worst-first by issue count). */
export function summarize(scored: number, index: RepoIndex, total: number): void {
  const flagged = Object.keys(index.problems).sort(
    (a, b) => index.problems[b]!.length - index.problems[a]!.length,
  );
  console.log(`\n  repo score: ${repoScore(index, total)}/100   (${scored} scored, ${flagged.length} with issues)\n`);
  for (const path of flagged.slice(0, 10)) {
    const n = index.problems[path]!.length;
    console.log(`   • ${path}  (${n} issue${n === 1 ? "" : "s"})`);
  }
  if (flagged.length > 10) console.log(`   …and ${flagged.length - 10} more`);
  console.log("");
}

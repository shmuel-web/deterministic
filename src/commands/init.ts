import { scoreManyFiles, runRepoRules } from "./score-file.js";
import { selectDetector } from "../core/change-detect.js";
import { saveIndex, record, repoScore, repoHealth, worstFile, type RepoIndex } from "../core/index-store.js";
import { writeSurfaces } from "../core/report.js";
import { settings } from "../../deterministic.config.js";

/**
 * `deterministic init` — the expensive first run: score & annotate EVERY source
 * file, run the repo-level rules, build the problems-only index, and stamp the
 * current scan marker so later `score repo` runs are incremental. O(whole repo).
 * Works with or without git via the layered change detector (#65).
 */
export async function init(): Promise<void> {
  const detector = selectDetector();
  const files = await detector.listSourceFiles();
  // Stamp the marker BEFORE scoring so anything edited mid-scan is caught next run.
  const marker = await detector.marker();
  console.log(`\n  Scoring ${files.length} files…`);
  const results = await scoreManyFiles(files);

  const index: RepoIndex = { lastScan: marker, problems: {}, repoIssues: [] };
  for (const r of results) record(index, r.path, r.issues);
  index.repoIssues = await runRepoRules();
  await saveIndex(index);

  if (settings.writeSurfaces) await writeSurfaces(index, repoScore(index), files.length);
  summarize(results.length, index, files.length);
}

/** Print the repo score, repo-level issues, then the flagged files (worst-first). */
export function summarize(scored: number, index: RepoIndex, total: number): void {
  const flagged = Object.keys(index.problems).sort(
    (a, b) => index.problems[b]!.length - index.problems[a]!.length,
  );
  const worst = worstFile(index);
  const worstNote = worst ? `; worst file ${worst.score}/100 — ${worst.file}` : "";
  console.log(
    `\n  repo score: ${repoScore(index)}/100   ` +
      `(health ${repoHealth(index, total)}/100${worstNote}; ${scored} scored, ${flagged.length} files with issues)\n`,
  );

  if (index.repoIssues.length > 0) {
    console.log("  repo-level:");
    for (const i of index.repoIssues) console.log(`   • [${i.severity}] ${i.ruleId}  ${i.problem} → ${i.fix}`);
    console.log("");
  }
  for (const path of flagged.slice(0, 10)) {
    const n = index.problems[path]!.length;
    console.log(`   • ${path}  (${n} issue${n === 1 ? "" : "s"})`);
  }
  if (flagged.length > 10) console.log(`   …and ${flagged.length - 10} more`);
  console.log("");
}

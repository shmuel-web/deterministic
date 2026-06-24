import { scoreManyFiles, runRepoRules } from "./score-file.js";
import { summarize } from "./init.js";
import { selectDetector } from "../core/change-detect.js";
import { loadIndex, saveIndex, record, remove, repoScore } from "../core/index-store.js";
import { writeSurfaces } from "../core/report.js";
import { settings } from "../../deterministic.config.js";

/**
 * `deterministic score repo` — the cheap, incremental repo score. Re-scores only
 * the files the change detector reports as changed since the last scan, updates
 * the problems-only index, and recomposes the repo score without re-reading the
 * tree (Principle IV). Works with or without git (#65). Run `init` first.
 */
export async function scoreRepo(): Promise<void> {
  const detector = selectDetector();

  const index = await loadIndex();
  if (index.lastScan === null) throw new Error("No index yet — run `deterministic init` first.");

  // Capture the new marker before diffing, so edits during this run aren't missed.
  const marker = await detector.marker();
  const { changed, deleted } = await detector.changedSince(index.lastScan);
  for (const f of deleted) remove(index, f);

  if (changed.length === 0 && deleted.length === 0) {
    console.log("\n  Nothing changed since last scan.");
  } else {
    console.log(`\n  Re-scoring ${changed.length} changed file(s)…`);
    const results = await scoreManyFiles(changed);
    for (const r of results) record(index, r.path, r.issues);
  }

  // Repo-level rules are cheap (a few config reads) — always refresh them.
  index.repoIssues = await runRepoRules();
  index.lastScan = marker;
  await saveIndex(index);

  const total = (await detector.listSourceFiles()).length;
  if (settings.writeSurfaces) await writeSurfaces(index, repoScore(index), total);
  summarize(changed.length, index, total);
}

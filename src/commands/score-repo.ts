import { scoreManyFiles, runRepoRules } from "./score-file.js";
import { summarize } from "./init.js";
import { inGitRepo, headSha, changedSince, listSourceFiles } from "../core/git.js";
import { loadIndex, saveIndex, record, remove, repoScore } from "../core/index-store.js";
import { writeSurfaces } from "../core/report.js";
import { settings } from "../../deterministic.config.js";

/**
 * `deterministic score repo` — the cheap, incremental repo score. Re-scores only
 * the files git reports as changed since the last scored commit, updates the
 * problems-only index, and recomposes the repo score without re-reading the tree
 * (Principle IV). Run `deterministic init` first.
 */
export async function scoreRepo(): Promise<void> {
  if (!inGitRepo()) throw new Error("score repo requires a git repository.");

  const index = await loadIndex();
  if (index.lastSha === null) throw new Error("No index yet — run `deterministic init` first.");

  const { changed, deleted } = changedSince(index.lastSha);
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
  index.lastSha = headSha();
  await saveIndex(index);

  const total = listSourceFiles().length;
  if (settings.writeSurfaces) await writeSurfaces(index, repoScore(index, total), total);
  summarize(changed.length, index, total);
}

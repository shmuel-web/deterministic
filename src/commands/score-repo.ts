import { scoreManyFiles } from "./score-file.js";
import { summarize } from "./init.js";
import { inGitRepo, headSha, changedSince, listSourceFiles } from "../core/git.js";
import { loadIndex, saveIndex, record, remove } from "../core/index-store.js";

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

  index.lastSha = headSha();
  await saveIndex(index);

  summarize(changed.length, index, listSourceFiles().length);
}

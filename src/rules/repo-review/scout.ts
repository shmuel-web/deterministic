import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Scout for the agentic repo-review panel (#72). It gathers the repo's context
 * ONCE — structure, key configs, and any prior repo-rule findings — so every
 * reviewer persona judges the SAME assembled picture instead of each re-reading
 * the tree. No model: this is deterministic I/O, and it's the cheap shared base
 * the (expensive, model-driven) reviewers build on.
 */

const EXCLUDE = [".git/", "node_modules/", "dist/", ".deterministic/", "coverage/"];
const CONFIG_FILES = ["package.json", "tsconfig.json", ".gitlab-ci.yml", "README.md", "CLAUDE.md"];

export interface RepoContext {
  root: string;
  /** Compact file-tree overview: file count per top-level directory. */
  structure: string;
  /** Key project configs (truncated), keyed by filename — present only if found. */
  configs: Record<string, string>;
  /** Optional pre-computed repo-rule findings, so reviewers don't re-derive them. */
  priorFindings?: string;
}

/** Minimal recursive walk (no git dependency) — relative POSIX paths, excludes pruned. */
async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  async function rec(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join("/");
      if (EXCLUDE.some((x) => (rel + "/").startsWith(x))) continue;
      if (e.isDirectory()) await rec(path.join(dir, e.name));
      else out.push(rel);
    }
  }
  await rec(root);
  return out.sort();
}

/** Summarize the tree as "topDir — N files", so the prompt sees shape without every path. */
export function summarizeStructure(files: string[]): string {
  const byTop = new Map<string, number>();
  for (const f of files) {
    const top = f.includes("/") ? f.slice(0, f.indexOf("/")) + "/" : "(root)";
    byTop.set(top, (byTop.get(top) ?? 0) + 1);
  }
  return [...byTop.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([dir, n]) => `  ${dir} — ${n} file${n === 1 ? "" : "s"}`)
    .join("\n");
}

/**
 * Gather the shared repo context. `listFiles` is injectable for tests; it defaults
 * to a plain filesystem walk so the Scout works with or without git.
 */
export async function gatherRepoContext(
  root: string,
  opts: { priorFindings?: string; listFiles?: (root: string) => Promise<string[]> } = {},
): Promise<RepoContext> {
  const files = await (opts.listFiles ?? walk)(root);
  const configs: Record<string, string> = {};
  for (const name of CONFIG_FILES) {
    try {
      configs[name] = (await fs.readFile(path.join(root, name), "utf8")).slice(0, 2000);
    } catch {
      /* not present — skip */
    }
  }
  return { root, structure: summarizeStructure(files), configs, priorFindings: opts.priorFindings };
}

/** Render the context into the single string the reviewers share. */
export function renderContext(ctx: RepoContext): string {
  const parts = [`REPO STRUCTURE (files per directory):\n${ctx.structure}`];
  for (const [name, body] of Object.entries(ctx.configs)) parts.push(`=== ${name} ===\n${body}`);
  if (ctx.priorFindings) parts.push(`PRIOR REPO-RULE FINDINGS:\n${ctx.priorFindings}`);
  return parts.join("\n\n");
}

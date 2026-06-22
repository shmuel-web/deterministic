// @deterministic score: 100/100 — no issues
// @deterministic:end
import { promises as fs } from "node:fs";
import { rules } from "../../deterministic.config.js";
import { runRules } from "../core/orchestrator.js";
import { score as scoreIssues, type IdentifiedIssue } from "../core/score.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { resolveModel, withConcurrencyLimit } from "../core/model.js";
import { createLimiter, defaultConcurrency } from "../core/pool.js";
import type { ModelClient } from "../core/rule.js";

export interface FileScore {
  path: string;
  score: number;
  issues: IdentifiedIssue[];
}

/**
 * Score ONE file end-to-end (the atomic unit `init` / `score repo` / `validate`
 * compose). Strips any prior annotation before scoring so it never skews the
 * result, runs the rules, derives the score, and writes the issue list back into
 * the file. Takes an already-resolved model so callers can share one across files.
 */
export async function scoreOneFile(file: string, model: ModelClient | null): Promise<FileScore> {
  const raw = await fs.readFile(file, "utf8");
  const content = stripAnnotation(raw);
  const issues = await runRules(rules, { target: "file", path: file, content }, { model: model ?? undefined });
  const { score } = scoreIssues(issues);
  await writeAnnotation({ target: "file", path: file, score, issues });
  return { path: file, score, issues };
}

function print(r: FileScore): void {
  console.log(`\n  ${r.path}  →  ${r.score}/100`);
  if (r.issues.length === 0) {
    console.log("   ✓ no issues");
    return;
  }
  for (const i of r.issues) console.log(`   • [${i.severity}] ${i.ruleId}  ${i.problem} → ${i.fix}`);
}

/**
 * Score many files, fanning out with ONE shared concurrency limiter so in-flight
 * LLM calls never exceed the cap (issue #63) — the reusable core that `init` and
 * `score repo` build on. Resolves the model once and shares it.
 */
export async function scoreManyFiles(files: string[], modelOverride?: ModelClient): Promise<FileScore[]> {
  const base = modelOverride ?? (await resolveModel());
  const limit = createLimiter(defaultConcurrency());
  const model = base ? withConcurrencyLimit(base, limit) : null;
  return Promise.all(files.map((f) => scoreOneFile(f, model)));
}

/**
 * Hidden `deterministic file <path...>` dev command. Scores one or many files
 * and prints each result. Tests inject a stub model.
 */
export async function scoreFile(paths?: string | string[], modelOverride?: ModelClient): Promise<void> {
  const files = (Array.isArray(paths) ? paths : paths ? [paths] : []).filter(Boolean);
  if (files.length === 0) throw new Error("usage: deterministic file <path...>");
  const results = await scoreManyFiles(files, modelOverride);
  for (const r of results) print(r);
  console.log("");
}

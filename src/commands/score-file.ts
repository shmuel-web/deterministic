// @deterministic score: 97/100
//   [minor] llm/intent-legibility  The file is missing a module-level JSDoc summarizing its overall purpose. While all exported functions have descriptions, there is no immediate indication at the top of the file regarding what utilities provided within this file accomplish (e.g., 'Provides core logic and entry points for scoring files and repositories against deterministic rules'). → Add a module-level JSDoc comment immediately after the imports to summarize the file's role in the system, clarifying that it handles running rule sets and generating actionable scores for code artifacts.
// @deterministic:end
import { promises as fs } from "node:fs";
import { rules, settings } from "../../deterministic.config.js";
import { runRules } from "../core/orchestrator.js";
import { score as scoreIssues, type IdentifiedIssue } from "../core/score.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { stripReadmeBlock } from "../core/report.js";
import { resolveModel, withConcurrencyLimit } from "../core/model.js";
import { createLimiter, defaultConcurrency } from "../core/pool.js";
import { createExec } from "../core/exec.js";
import type { ModelClient, RuleExec } from "../core/rule.js";

/**
 * The execution capability (#70), bound to the repo root — but only when
 * execution is opted in (`settings.execution.enabled`, off by default). This is
 * the single opt-in gate: rules never get `ctx.exec` unless it's enabled here.
 */
function repoExec(root: string): RuleExec | undefined {
  return settings.execution.enabled
    ? createExec({ cwd: root, timeoutMs: settings.execution.timeoutMs })
    : undefined;
}

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
  // Strip our own footprints (the file annotation + the README score block) so
  // the surfaces never score themselves.
  const content = stripReadmeBlock(stripAnnotation(raw));
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
 * Run the repo-target rules once against the repo root and return their issues
 * (tagged with ruleId). These inspect the project as a whole — tests, coverage,
 * CI — rather than a single file.
 */
export async function runRepoRules(root = ".", modelOverride?: ModelClient): Promise<IdentifiedIssue[]> {
  const model = modelOverride ?? (await resolveModel());
  return runRules(rules, { target: "repo", path: root }, { model: model ?? undefined, exec: repoExec(root) });
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

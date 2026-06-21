import { promises as fs } from "node:fs";
import { rules } from "../../deterministic.config.js";
import { runRules } from "../core/orchestrator.js";
import { score as scoreIssues } from "../core/score.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { resolveModel } from "../core/model.js";
import type { ModelClient } from "../core/rule.js";

/**
 * Internal file scoring — the atomic unit `init`, `score repo`, and
 * `validate ticket` compose. NOT a public command (exposed only as the hidden
 * `deterministic file <path>` for dev/dogfooding). Pools the issues every rule
 * finds, derives the score (100 − penalties), writes the issue list into the
 * file, and prints the full breakdown. Strips any prior annotation before
 * scoring so it never skews the result (Principle IV).
 */
export async function scoreFile(file?: string, modelOverride?: ModelClient): Promise<void> {
  if (!file) throw new Error("usage: deterministic file <path>");

  const raw = await fs.readFile(file, "utf8");
  const content = stripAnnotation(raw); // never score our own annotation

  // Tests inject a stub model; production resolves one (local Ollama → API → error if an LLM rule needs it).
  const model = modelOverride ?? (await resolveModel());
  const issues = await runRules(rules, { target: "file", path: file, content }, { model: model ?? undefined });
  const { score } = scoreIssues(issues);

  await writeAnnotation({ target: "file", path: file, score, issues });

  console.log(`\n  ${file}  →  ${score}/100`);
  if (issues.length === 0) {
    console.log("   ✓ no issues\n");
    return;
  }
  for (const i of issues) {
    console.log(`   • [${i.severity}] ${i.ruleId}  ${i.problem} → ${i.fix}`);
  }
  console.log("");
}

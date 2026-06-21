// @deterministic score: 94/100  scored: 2026-06-21T08:18:47.420Z
//   static/file-length  100/100  w1  41 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (scoreFile) is 25 lines — within the 50-line cap.
//   llm/intent-legibility  85/100  w3  File name and function clearly indicate it scores individual files using rules and models, with audit-friendly annotations, though the hidden command exposure and internal-only use hint at a developer-focused tool rather than general user intent.
// @deterministic:end
import { promises as fs } from "node:fs";
import { rules } from "../../deterministic.config.js";
import { runRules } from "../core/orchestrator.js";
import { arbitrate } from "../core/arbitrator.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { resolveModel } from "../core/model.js";
import type { ModelClient } from "../core/rule.js";

/**
 * Internal file scoring — the atomic unit `init`, `score repo`, and
 * `validate ticket` compose. NOT a public command (exposed only as the hidden
 * `deterministic file <path>` for dev/dogfooding). Scores one file, persists the
 * annotation INTO the file, prints the auditable breakdown. Strips any prior
 * annotation before scoring so the annotation never skews a score (Principle IV).
 */
export async function scoreFile(file?: string, modelOverride?: ModelClient): Promise<void> {
  if (!file) throw new Error("usage: deterministic score-file <path>");

  const raw = await fs.readFile(file, "utf8");
  const content = stripAnnotation(raw); // never score our own annotation

  // Tests inject a stub model; production resolves one (local Ollama → API → error if an LLM rule needs it).
  const model = modelOverride ?? (await resolveModel());
  const signals = await runRules(rules, { target: "file", path: file, content }, { model: model ?? undefined });
  const { score } = arbitrate(signals);

  await writeAnnotation({
    target: "file",
    path: file,
    score,
    signals,
    scoredAt: new Date().toISOString(),
  });

  console.log(`\n  ${file}  →  ${score}/100\n`);
  for (const s of signals) {
    console.log(`   • [${s.ruleId}] ${s.score}/100 (w${s.weight})  ${s.reasoning}`);
  }
  console.log("");
}

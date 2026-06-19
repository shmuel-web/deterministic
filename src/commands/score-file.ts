import { promises as fs } from "node:fs";
import { rules } from "../../deterministic.config.js";
import { runRules } from "../core/orchestrator.js";
import { arbitrate } from "../core/arbitrator.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { resolveModel } from "../core/model.js";

/**
 * score-file — the atomic unit. Score one file, persist the annotation INTO the
 * file, print the auditable breakdown. Strips any prior annotation before
 * scoring so the annotation never skews a score (Principle IV).
 */
export async function scoreFile(file?: string): Promise<void> {
  if (!file) throw new Error("usage: deterministic score-file <path>");

  const raw = await fs.readFile(file, "utf8");
  const content = stripAnnotation(raw); // never score our own annotation

  const model = await resolveModel(); // null is fine for a static-only target; Orchestrator errors if an LLM rule needs it
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

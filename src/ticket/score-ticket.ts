import { promises as fs } from "node:fs";
import type { ModelClient } from "../core/rule.js";
import { runRules } from "../core/orchestrator.js";
import { score as deriveScore } from "../core/score.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { resolveModel } from "../core/model.js";
import { ticketRules } from "./rules.js";

/**
 * `deterministic score ticket <path>` — Lane 2 (spec 003).
 *
 * Scores the SPECIFICATION QUALITY of a ticket: is the task well-specified
 * enough that an agent should start it and a reviewer could verify it's done?
 * Runs the ticket's own rules (has-a-DoD, measurable goal, validation path),
 * derives the score from their issues (same penalty model as everywhere), and
 * writes the issue list back into the ticket as an HTML-comment annotation so
 * the next reader — human or agent — sees exactly what to fix.
 *
 * The EXECUTION-RISK dimension (blast radius + repo score; FR-003/004) composes
 * on top of this via the Scout. Until that lands we score spec-quality only and
 * say so — degrade, don't fail (FR-005).
 */
export async function scoreTicket(ticketPath?: string, modelOverride?: ModelClient): Promise<void> {
  if (!ticketPath) throw new Error("usage: deterministic score ticket <path>");

  const raw = await fs.readFile(ticketPath, "utf8");
  const content = stripAnnotation(raw); // never score our own annotation

  const model = modelOverride ?? (await resolveModel());
  const issues = await runRules(
    ticketRules,
    { target: "ticket", path: ticketPath, content },
    { model: model ?? undefined },
  );

  const { score } = deriveScore(issues);
  await writeAnnotation({ target: "ticket", path: ticketPath, score, issues });

  console.log(`\n  ${ticketPath}  →  ${score}/100  (specification quality)`);
  if (issues.length === 0) {
    console.log("   ✓ well-specified — no spec-quality issues\n");
  } else {
    const ordered = [...issues].sort((a, b) => severityRank(b) - severityRank(a));
    for (const i of ordered) console.log(`   • [${i.severity}] ${i.ruleId}  ${i.problem}\n       → ${i.fix}`);
    console.log("");
  }
  // FR-005: be honest that execution-risk wasn't assessed yet.
  console.log("   note: execution risk (blast radius + repo score) not yet assessed — spec-quality only.\n");
}

const RANK = { info: 0, minor: 1, major: 2, critical: 3 } as const;
const severityRank = (i: { severity: keyof typeof RANK }): number => RANK[i.severity];

import { promises as fs } from "node:fs";
import { PENALTY, type ModelClient } from "../core/rule.js";
import { runRules } from "../core/orchestrator.js";
import { writeAnnotation, stripAnnotation } from "../core/annotation.js";
import { resolveModel } from "../core/model.js";
import { withTrace } from "../core/tracing.js";
import { loadIndex } from "../core/index-store.js";
import { inGitRepo, listSourceFiles } from "../core/git.js";
import { ticketRules } from "./rules.js";
import { resolveBlastRadius } from "./scout.js";
import { computeBlastRadius, type BlastRadius } from "./blast-radius.js";

/**
 * `deterministic score ticket <path>` — Lane 2 (spec 003).
 *
 * Composes the ticket score from two parts:
 *   ticket score = clamp( average(blast-radius file scores) − Σ(own-rule penalties), 0, 100 )
 *
 * - BASE: the Scout resolves the files this ticket would change (its blast
 *   radius), and the base is the average of those files' cached scores from the
 *   index — the ticket inherits the health of the code it will touch. No files
 *   resolved / empty index → base 100 (degrade, don't fail — FR-005).
 * - PENALTIES: the ticket's own rules (has-a-DoD, measurable goal, validation
 *   path) — is the task well-specified enough to act on and verify?
 *
 * The repo score is intentionally NOT consulted (it would dilute risk up); it's
 * reserved for multi-repo workflows. `score ticket` only READS cached file
 * scores — it never re-scores a file (the dependency is one-directional).
 */
export async function scoreTicket(ticketPath?: string, modelOverride?: ModelClient): Promise<void> {
  if (!ticketPath) throw new Error("usage: deterministic score ticket <path>");

  const raw = await fs.readFile(ticketPath, "utf8");
  const content = stripAnnotation(raw); // never score our own annotation

  // One dev trace per scoring run (#90) — every LLM call below nests under it.
  await withTrace(`score ticket: ${ticketPath}`, async () => {
    // Spec-quality dimension → penalties.
    const model = modelOverride ?? (await resolveModel());
    const issues = await runRules(
      ticketRules,
      { target: "ticket", path: ticketPath, content },
      { model: model ?? undefined },
    );
    const penalty = issues.reduce((sum, i) => sum + PENALTY[i.severity], 0);

    // Execution-risk dimension → base (average of the blast-radius file scores).
    const blast = await resolveBlast(content);

    const score = Math.max(0, Math.min(100, blast.base - penalty));
    await writeAnnotation({ target: "ticket", path: ticketPath, score, issues });

    print(ticketPath, score, blast, penalty, issues);
  });
}

/** Resolve the blast radius from the index + repo file list; degrade cleanly if unavailable. */
async function resolveBlast(content: string): Promise<BlastRadius> {
  if (!inGitRepo()) return { files: [], base: 100, degraded: true };
  try {
    const files = resolveBlastRadius(content, listSourceFiles());
    return computeBlastRadius(await loadIndex(), files);
  } catch {
    return { files: [], base: 100, degraded: true };
  }
}

const RANK = { info: 0, minor: 1, major: 2, critical: 3 } as const;

function print(
  ticketPath: string,
  score: number,
  blast: BlastRadius,
  penalty: number,
  issues: { severity: keyof typeof RANK; ruleId: string; problem: string; fix: string }[],
): void {
  console.log(`\n  ${ticketPath}  →  ${score}/100`);

  if (blast.degraded) {
    console.log(`   base 100 — execution risk not assessed (no blast radius; run \`init\` / \`score repo\` first)`);
  } else {
    const list = blast.files.map((f) => `${f.path} ${f.score}`).join(", ");
    console.log(`   base ${blast.base} (blast radius: ${list})`);
  }

  if (issues.length === 0) {
    console.log(`   − 0 spec-quality penalties — well-specified\n`);
    return;
  }
  console.log(`   − ${penalty} spec-quality penalties:`);
  for (const i of [...issues].sort((a, b) => RANK[b.severity] - RANK[a.severity])) {
    console.log(`   • [${i.severity}] ${i.ruleId}  ${i.problem}\n       → ${i.fix}`);
  }
  console.log("");
}

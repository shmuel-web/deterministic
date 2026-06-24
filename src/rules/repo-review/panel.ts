import { z } from "zod";
import type { ModelClient, RuleIssue } from "../../core/rule.js";
import type { IdentifiedIssue } from "../../core/score.js";
import { gatherRepoContext, renderContext, type RepoContext } from "./scout.js";
import { REPO_PANEL, buildRepoReviewerPrompt, type RepoReviewer } from "./reviewers.js";
import { reconcile, type ReviewerDraft } from "./arbitrator.js";

/**
 * The agentic repo-review panel (#72) — SCAFFOLD. Wires the three pieces:
 *
 *   Scout (gather shared context)  →  Reviewers (model judges per persona)  →
 *   Arbitrator (validate + dedupe + cap)  →  issues per the frozen contract.
 *
 * The orchestration is the hand-rolled loop below — deliberately so it works and
 * is testable today. The Scout/Reviewer/Arbitrator boundaries are drawn so the
 * loop can later be swapped for Mastra (the locked stack for this tier) with no
 * change to the personas, the context, or the reconciliation. CONNECT POINTS:
 *   1. a real model (this is the only piece that needs Ollama);
 *   2. (optional) Mastra orchestration in place of `Promise.all` here;
 *   3. opt-in wiring + a repo Rule registration (the #74 home) — intentionally
 *      NOT registered in deterministic.config yet (this tier is expensive).
 *
 * Degrades safely: no model → no issues (never throws, never fabricates).
 */

const IssuesSchema = z.object({ issues: z.array(z.object({ problem: z.string(), fix: z.string(), severity: z.string() })) });

/** Parse a reviewer's JSON draft; null when unparseable (don't fabricate). */
export function parseDraft(raw: string): RuleIssue[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = IssuesSchema.safeParse(JSON.parse(match[0]));
    if (!parsed.success) return null;
    // Cast through the contract shape; the Arbitrator re-validates each issue.
    return parsed.data.issues as RuleIssue[];
  } catch {
    return null;
  }
}

/** Run ONE reviewer against the shared context. Unparseable/failed → empty draft. */
async function runReviewer(model: ModelClient, reviewer: RepoReviewer, context: string): Promise<ReviewerDraft> {
  let issues: RuleIssue[] | null = null;
  try {
    issues = parseDraft(await model.complete(buildRepoReviewerPrompt(reviewer, context), { label: `repo-review/${reviewer.id}`, json: true }));
  } catch {
    issues = null; // a failed model call is a neutral signal, not a crash
  }
  return { reviewer, issues: issues ?? [] };
}

export interface ReviewRepoOptions {
  panel?: RepoReviewer[];
  priorFindings?: string;
  /** Injectable file lister for the Scout (tests / non-git). */
  listFiles?: (root: string) => Promise<string[]>;
  /** Pre-built context, to skip the Scout (tests). */
  context?: RepoContext;
}

/**
 * Review a repo end-to-end. Model-injected so the caller controls resolution and
 * concurrency; returns reconciled, contract-valid issues.
 */
export async function reviewRepo(
  root: string,
  model: ModelClient | null,
  opts: ReviewRepoOptions = {},
): Promise<IdentifiedIssue[]> {
  if (!model) return []; // judgment tier needs a model; absence is a clean pass, not an error
  const panel = opts.panel ?? REPO_PANEL;
  const ctx = opts.context ?? (await gatherRepoContext(root, { priorFindings: opts.priorFindings, listFiles: opts.listFiles }));
  const context = renderContext(ctx);
  const drafts = await Promise.all(panel.map((r) => runReviewer(model, r, context)));
  return reconcile(drafts);
}

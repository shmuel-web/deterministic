import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import type { IdentifiedIssue } from "../../core/score.js";
import { gatherRepoContext, renderContext, type RepoContext } from "./scout.js";
import { REPO_PANEL, buildRepoReviewerPrompt, type RepoReviewer } from "./reviewers.js";
import { reconcile, type ReviewerDraft } from "./arbitrator.js";
import { parseDraft } from "./panel.js";

/**
 * The agentic repo-review panel orchestrated with **Mastra** (#72) — this is the
 * tier where Mastra earns its place (multiple expert agents + shared context +
 * reconciliation), as the ticket calls for. It mirrors the hand-rolled `panel.ts`
 * exactly — Scout → reviewers → Arbitrator — but each reviewer is a Mastra `Agent`
 * instead of a raw model call.
 *
 * The model is local Ollama, reached through its OpenAI-compatible endpoint
 * (`/v1`) so we reuse the AI SDK provider Mastra already speaks — no cloud, no
 * keys (Principle V). The hand-rolled `reviewRepo` stays the default + the offline
 * test path; this is the opt-in orchestration upgrade (`settings.repoReview.useMastra`).
 *
 * Never throws: a failed agent run is a neutral empty draft, not a crashed scan.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

/** A reviewer persona as a Mastra Agent backed by local Ollama (OpenAI-compatible). */
function reviewerAgent(reviewer: RepoReviewer, modelName: string, host: string): Agent {
  const ollama = createOpenAI({ baseURL: `${host}/v1`, apiKey: "ollama" });
  return new Agent({
    id: `repo-review-${reviewer.id}`,
    name: reviewer.name,
    instructions: `You are ${reviewer.role}. Your single concern, and nothing else: ${reviewer.concern}`,
    model: ollama(modelName),
  });
}

async function runReviewerAgent(
  reviewer: RepoReviewer,
  context: string,
  modelName: string,
  host: string,
): Promise<ReviewerDraft> {
  try {
    const result = await reviewerAgent(reviewer, modelName, host).generate(buildRepoReviewerPrompt(reviewer, context));
    return { reviewer, issues: parseDraft(result.text) ?? [] };
  } catch {
    return { reviewer, issues: [] }; // a failed/unreachable agent is neutral, never fatal
  }
}

export interface MastraReviewOptions {
  panel?: RepoReviewer[];
  priorFindings?: string;
  listFiles?: (root: string) => Promise<string[]>;
  context?: RepoContext;
  /** Ollama model tag (default DETERMINISTIC_OLLAMA_MODEL or gemma4). */
  modelName?: string;
  host?: string;
}

/** Review a repo with the Mastra-orchestrated panel. Returns reconciled, contract-valid issues. */
export async function reviewRepoWithMastra(root: string, opts: MastraReviewOptions = {}): Promise<IdentifiedIssue[]> {
  const panel = opts.panel ?? REPO_PANEL;
  const modelName = opts.modelName ?? process.env.DETERMINISTIC_OLLAMA_MODEL ?? "gemma4";
  const host = opts.host ?? OLLAMA_HOST;
  const ctx = opts.context ?? (await gatherRepoContext(root, { priorFindings: opts.priorFindings, listFiles: opts.listFiles }));
  const context = renderContext(ctx);
  const drafts = await Promise.all(panel.map((r) => runReviewerAgent(r, context, modelName, host)));
  return reconcile(drafts);
}

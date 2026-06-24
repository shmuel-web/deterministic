import type { Severity } from "../../core/rule.js";

/**
 * Reviewer personas for the agentic REPO-review panel (#72) — distinct from the
 * ticket panel (spec 004). Each is a bounded LENS on the project as a whole; the
 * charter names the ONE concern it judges and its NON-GOALS so personas don't
 * overlap. Extensible (security, performance) by adding to REPO_PANEL.
 */
export interface RepoReviewer {
  /** Display name, prefixed onto each issue for attribution (ruleId `repo-review/<id>`). */
  id: string;
  name: string;
  role: string;
  concern: string;
  lookFor: string;
  nonGoals: string;
  /** Severity ceiling — judgment about a whole repo rarely warrants critical. */
  maxSeverity: Severity;
}

export const architect: RepoReviewer = {
  id: "architect",
  name: "Architect",
  role: "a senior software architect reviewing a whole codebase",
  concern: "is this codebase structured to stay maintainable as it grows?",
  lookFor: `- a module with too many responsibilities (low cohesion) the structure reveals
- coupling or a dependency direction that will be painful to change (e.g. a core module importing a leaf)
- missing or unclear module boundaries between distinct concerns
- duplicated responsibility spread across files that should be one place`,
  nonGoals: "line-level style, test coverage adequacy, or per-file naming — those are other reviewers' or rules' jobs",
  maxSeverity: "major",
};

export const testingExpert: RepoReviewer = {
  id: "testing-expert",
  name: "Testing expert",
  role: "a senior test engineer reviewing a whole codebase's test strategy",
  concern: "does the test strategy actually protect the important behavior?",
  lookFor: `- a critical module or entry point with NO corresponding tests
- a whole category of behavior (error paths, integration, a public API) left untested
- tests that exist but assert trivially (structure present, behavior unchecked)
- a test layer the project clearly needs but is absent (e.g. no integration tests for a multi-step flow)`,
  nonGoals: "architecture/coupling, code style, or exact coverage percentage (a static rule owns the number) — those are not your job",
  maxSeverity: "major",
};

/** The panel. Add security/perf personas here — the panel + arbitrator scale unchanged. */
export const REPO_PANEL: RepoReviewer[] = [architect, testingExpert];

/**
 * A reviewer's drafting prompt. The guardrails ARE the design: silence by default,
 * applicability + materiality, and evidence grounded in the assembled context.
 * Same anti-overshoot shape as the ticket panel's `buildReviewerPrompt`.
 */
export function buildRepoReviewerPrompt(reviewer: RepoReviewer, context: string): string {
  return `You are ${reviewer.role}, reviewing the project below.

Your ONE concern, and nothing else: ${reviewer.concern}
Look for (only this):
${reviewer.lookFor}

Do NOT comment on: ${reviewer.nonGoals}.

RULES — read carefully:
- The repo is FINE until you can prove a SPECIFIC, MATERIAL problem. "Nothing to report" is the expected, common, correct answer. There is NO reward for finding something. Never invent an issue to seem useful. Never praise.
- Only raise an issue that is MATERIAL — it would realistically cause a maintenance, correctness, or reliability problem — and cite the specific file/module/config from the context that shows it.
- Be TERSE: ONE sentence for the problem, ONE sentence for the fix. No examples, no preamble.
- If nothing material applies, return {"issues": []}.

Return ONLY JSON: {"issues":[{"problem":"<one terse sentence naming the file/module>","fix":"<one terse sentence>","severity":"info|minor|major"}]}

PROJECT CONTEXT:
---
${context}
---`;
}

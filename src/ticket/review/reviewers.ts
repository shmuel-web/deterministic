/**
 * Reviewer personas for the agentic ticket-review panel (spec 004).
 *
 * Each reviewer is a bounded LENS — the agentic analogue of a scoped rule's
 * single `topic`. The charter declares the ONE concern it judges and, just as
 * importantly, its NON-GOALS (what it must never flag) so personas don't overlap
 * and pad each other's issues.
 *
 * Slice 1 (#76) ships the Architect end-to-end; #81–#83 add the others.
 */
export interface Reviewer {
  /** Display name, prefixed onto each issue for attribution. */
  name: string;
  /** The persona the model adopts. */
  role: string;
  /** The single question this reviewer answers. */
  concern: string;
  /** Concrete examples of a material gap for this concern. */
  lookFor: string;
  /** What this reviewer must NOT flag (another persona's job). */
  nonGoals: string;
}

export const architect: Reviewer = {
  name: "Architect",
  role: "a senior software architect",
  concern: "does this change fit the system safely?",
  lookFor: `- a schema / data-shape change with NO migration
- a feature flag added with NO cleanup or lifecycle
- broken backward / forward compatibility across a module or API boundary
- a risky or irreversible change with no rollback / rollout plan
- a data-integrity or cross-module impact the touched files reveal`,
  nonGoals: "line-level code style, test coverage, scope or process — those are other reviewers' jobs",
};

/** The panel, in order. Grows in #81–#83 (Implementation Developer, QA, Lead PM). */
export const PANEL_REVIEWERS: Reviewer[] = [architect];

/**
 * Build a reviewer's drafting prompt. The guardrails ARE the design: silence by
 * default, applicability + materiality, and mandatory file-grounded evidence —
 * the prompt-level form of the funnel (#77 formalizes the gate, #78 the Defender).
 */
export function buildReviewerPrompt(reviewer: Reviewer, ticket: string, blastRadius: string): string {
  return `You are ${reviewer.role}, reviewing a development ticket BEFORE work starts.

Your ONE concern, and nothing else: ${reviewer.concern}
Look for (only this):
${reviewer.lookFor}

Do NOT comment on: ${reviewer.nonGoals}.

You are given the ticket AND the current content of the files this ticket would change (its blast radius). Judge the ticket against that real code.

RULES — read carefully:
- The ticket is COMPLETE until you can prove a SPECIFIC, MATERIAL gap. "Nothing to report" is the expected, common, correct answer. There is NO reward for finding something. Never invent an issue to seem useful. Never praise.
- Only raise an issue if (a) your concern actually APPLIES to this change, and (b) it is MATERIAL — skipping it would cause a bug, a broken deploy, or a failed validation.
- Every issue MUST cite a specific blast-radius file (and the fact in it) and give a concrete fix. If you cannot cite a file, do NOT raise it.
- If nothing material applies, return {"issues": []}.

Return ONLY JSON: {"issues":[{"problem":"<specific; names the file>","fix":"<concrete>","severity":"info|minor"}]}

TICKET:
---
${ticket}
---
BLAST-RADIUS FILES:
---
${blastRadius}
---`;
}

/**
 * The applicability gate (spec 004, FR-004) — the cheap first pass. The reviewer
 * decides whether its concern even applies before looking for gaps; an agent that
 * doesn't run can't invent issues. Short output (one boolean), so it's fast.
 */
export function buildGatePrompt(reviewer: Reviewer, ticket: string, blastRadius: string): string {
  return `You are ${reviewer.role}. Your concern: ${reviewer.concern}

Does this concern PLAUSIBLY APPLY to the ticket below and the files it changes? Answer "no" if the change clearly has nothing to do with your concern (e.g. it is only about: ${reviewer.nonGoals}). When genuinely unsure, answer "yes".

Reply ONLY JSON: {"applies": true|false}

TICKET:
---
${ticket}
---
BLAST-RADIUS FILES:
---
${blastRadius}
---`;
}

import type { Rule } from "../../core/rule.js";

/**
 * Static spec-quality rule (FR-002). A ticket you can't verify is done is a
 * ticket no agent should start — so the *presence* of a checkable done-condition
 * is a hard, model-free signal. We look for a Definition-of-Done / acceptance
 * section; the LLM rules judge whether that section is any *good*.
 *
 * Pure text-match → free, deterministic, runs even with no model.
 */
const DONE_SECTION =
  /(definition of done|acceptance criteria|acceptance test|success criteria|done when|\bDoD\b)/i;

export const ticketHasDod: Rule = {
  id: "static/ticket-has-dod",
  target: "ticket",
  type: "static",
  description: "A ticket must carry a checkable done-condition (Definition of Done / acceptance criteria).",
  run({ content }) {
    if (DONE_SECTION.test(content ?? "")) return { issues: [] };
    return {
      issues: [
        {
          problem: "the ticket has no Definition of Done / acceptance criteria — there is no way to tell when it's complete",
          fix: 'add a "Definition of Done" or "Acceptance Criteria" section listing the checkable conditions that must hold',
          severity: "major",
        },
      ],
    };
  },
};

import type { Rule } from "../core/rule.js";
import { thinTicket } from "./rules/thin-ticket.js";
import { ticketHasDod } from "./rules/ticket-has-dod.js";
import { dodQuality } from "./rules/dod-quality.js";
import { unmeasurableGoal } from "./rules/unmeasurable-goal.js";
import { undefinedValidationPath } from "./rules/undefined-validation-path.js";
import { missingContext } from "./rules/missing-context.js";
import { reviewPanel } from "./review/panel.js";

/**
 * The ticket module's OWN rule registry — the specification-quality dimension
 * (spec 003, FR-002). These score a ticket independently of any code: is the
 * task well-specified enough to act on and verify?
 *
 * Deliberately kept here, NOT in the root `deterministic.config.ts` (which owns
 * the file/repo rules). The ticket module never imports the code side, and the
 * code side never imports this — see ADR-0001. The blast-radius / execution-risk
 * dimension (FR-003/004) composes on top of these via the Scout, later.
 *
 * `reviewPanel` is the agentic tier (spec 004) — opt-in via `settings.review`,
 * silent otherwise — so it sits here but contributes nothing unless enabled.
 */
export const ticketRules: Rule[] = [
  thinTicket,
  ticketHasDod,
  dodQuality,
  unmeasurableGoal,
  undefinedValidationPath,
  missingContext,
  reviewPanel,
];

import type { Rule } from "../core/rule.js";
import { ticketHasDod } from "./rules/ticket-has-dod.js";
import { unmeasurableGoal } from "./rules/unmeasurable-goal.js";
import { undefinedValidationPath } from "./rules/undefined-validation-path.js";

/**
 * The ticket module's OWN rule registry — the specification-quality dimension
 * (spec 003, FR-002). These score a ticket independently of any code: is the
 * task well-specified enough to act on and verify?
 *
 * Deliberately kept here, NOT in the root `deterministic.config.ts` (which owns
 * the file/repo rules). The ticket module never imports the code side, and the
 * code side never imports this — see ADR-0001. The blast-radius / execution-risk
 * dimension (FR-003/004) composes on top of these via the Scout, later.
 */
export const ticketRules: Rule[] = [ticketHasDod, unmeasurableGoal, undefinedValidationPath];

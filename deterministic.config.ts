// @deterministic score: 100/100 — no issues
// @deterministic:end
import type { Rule } from "./src/core/rule.js";
import { fileLength } from "./src/rules/static/file-length.js";
import { missingTypes } from "./src/rules/static/missing-types.js";
import { functionLength } from "./src/rules/static/function-length.js";
import { intentLegibility } from "./src/rules/llm/intent-legibility.js";

/**
 * Project configuration: which rules run (ESLint-style).
 *
 * Importance now lives in each issue's `severity`, not a per-rule weight — so the
 * registry is just the enabled rule list. Remaining starter rules are the team's
 * tickets against the frozen contract: static/ticket-has-dod (#24), llm/dod-quality (#25).
 */
export const rules: Rule[] = [
  fileLength,
  missingTypes,
  functionLength,
  intentLegibility,
];

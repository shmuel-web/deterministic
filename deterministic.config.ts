// @deterministic score: 94/100  scored: 2026-06-21T08:18:41.411Z
//   static/file-length  100/100  w1  22 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  No brace-delimited functions detected — rule inert.
//   llm/intent-legibility  85/100  w3  File name clearly indicates deterministic configuration, imports are well-organized with clear rule categories, comments explain the purpose and structure effectively, though some team-specific references could be more universally understandable.
// @deterministic:end
import type { ConfiguredRule } from "./src/core/orchestrator.js";
import { fileLength } from "./src/rules/static/file-length.js";
import { missingTypes } from "./src/rules/static/missing-types.js";
import { functionLength } from "./src/rules/static/function-length.js";
import { intentLegibility } from "./src/rules/llm/intent-legibility.js";

/**
 * Project configuration: which rules run, and at what weight (ESLint-style).
 * Config weight overrides a rule's self-reported weight.
 *
 * Remaining starter rules are the team's [ASYNC] tickets against the frozen
 * contract: static/ticket-has-dod (#24) + llm/dod-quality (#25).
 */
export const rules: ConfiguredRule[] = [
  // file target — static
  { rule: fileLength, weight: 1 },
  { rule: missingTypes, weight: 2 },
  { rule: functionLength, weight: 1 },
  // file target — llm (judgment)
  { rule: intentLegibility, weight: 3 },
];

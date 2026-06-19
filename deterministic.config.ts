import type { ConfiguredRule } from "./src/core/orchestrator.js";
import { fileLength } from "./src/rules/static/file-length.js";
import { missingTypes } from "./src/rules/static/missing-types.js";

/**
 * Project configuration: which rules run, and at what weight (ESLint-style).
 * Config weight overrides a rule's self-reported weight.
 *
 * Keystone ships the two static file rules. The remaining starter rules are the
 * team's [ASYNC] tasks against the frozen contract:
 *   - llm/intent-legibility (T020)
 *   - static/ticket-has-dod (T024) + llm/dod-quality (T025)
 * Register them here as they land.
 */
export const rules: ConfiguredRule[] = [
  { rule: fileLength, weight: 1 },
  { rule: missingTypes, weight: 2 },
];

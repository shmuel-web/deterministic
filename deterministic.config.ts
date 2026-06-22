import type { Rule } from "./src/core/rule.js";
import { fileLength } from "./src/rules/static/file-length.js";
import { missingTypes } from "./src/rules/static/missing-types.js";
import { functionLength } from "./src/rules/static/function-length.js";
import { intentLegibility } from "./src/rules/llm/intent-legibility.js";
import { repoHasTests } from "./src/rules/static/repo-has-tests.js";
import { hasCoverageTool } from "./src/rules/static/has-coverage-tool.js";
import { ciRunsTests } from "./src/rules/static/ci-runs-tests.js";
import { linterConfigured } from "./src/rules/static/linter-configured.js";
import { ciRunsLint } from "./src/rules/static/ci-runs-lint.js";

/**
 * Project configuration: which rules run (ESLint-style).
 *
 * Importance lives in each issue's `severity`, not a per-rule weight — so the
 * registry is just the enabled rule list. The orchestrator runs each rule only
 * against its declared target (file vs repo vs ticket).
 */
export const rules: Rule[] = [
  // file target
  fileLength,
  missingTypes,
  functionLength,
  intentLegibility,
  // repo target (presence checks — static, no model)
  repoHasTests,
  hasCoverageTool,
  ciRunsTests,
  linterConfigured,
  ciRunsLint,
];

/** Project settings (the footprint is a guest — opt-out, default on). */
export const settings = {
  /** Write DETERMINISTIC.md + the one-line README score block on init / score repo. */
  writeSurfaces: true,
};

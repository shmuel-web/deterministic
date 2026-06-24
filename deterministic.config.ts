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
import { hasAgentContext } from "./src/rules/static/has-agent-context.js";
import { tsconfigStrict } from "./src/rules/static/tsconfig-strict.js";
import { lockfileCommitted } from "./src/rules/static/lockfile-committed.js";
import { licensePresent } from "./src/rules/static/license-present.js";
import { nodeVersionPinned } from "./src/rules/static/node-version-pinned.js";
import { noCommittedSecrets } from "./src/rules/static/no-committed-secrets.js";
import { ciRunsTypecheck } from "./src/rules/static/ci-runs-typecheck.js";
import { gitignoreSane } from "./src/rules/static/gitignore-sane.js";
import { readmeContext } from "./src/rules/static/readme-context.js";
import { agentRunsDeterministic } from "./src/rules/static/agent-runs-deterministic.js";
import { enforcesDeterministic } from "./src/rules/static/enforces-deterministic.js";
import { coverageThreshold } from "./src/rules/static/coverage-threshold.js";
import { coverageAgentic } from "./src/rules/static/coverage-agentic.js";
import { tsIgnoreCount } from "./src/rules/static/ts-ignore-count.js";
import { importCount } from "./src/rules/static/import-count.js";
import { fanIn } from "./src/rules/static/fan-in.js";
import { namingConvention } from "./src/rules/static/naming-convention.js";
import { functionCount } from "./src/rules/static/function-count.js";
import { parameterCount } from "./src/rules/static/parameter-count.js";
import { cyclomaticComplexity } from "./src/rules/static/cyclomatic-complexity.js";
import { cognitiveComplexity } from "./src/rules/static/cognitive-complexity.js";
import { repoReviewPanel } from "./src/rules/repo-review/rule.js";

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
  functionCount,
  parameterCount,
  cyclomaticComplexity,
  cognitiveComplexity,
  tsIgnoreCount,
  importCount,
  fanIn,
  namingConvention,
  intentLegibility,
  // repo target (presence checks — static, no model)
  repoHasTests,
  hasCoverageTool,
  ciRunsTests,
  linterConfigured,
  ciRunsLint,
  hasAgentContext,
  tsconfigStrict,
  lockfileCommitted,
  licensePresent,
  nodeVersionPinned,
  noCommittedSecrets,
  ciRunsTypecheck,
  gitignoreSane,
  readmeContext,
  agentRunsDeterministic,
  enforcesDeterministic,
  coverageThreshold,
  coverageAgentic,
  repoReviewPanel,
];

// Settings live in their own module (rules import them without importing this
// config, which imports the rules — that would be circular). Re-exported here
// so existing `import { settings } from "deterministic.config"` keeps working.
export { settings } from "./src/core/settings.js";

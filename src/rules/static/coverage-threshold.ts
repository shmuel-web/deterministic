import type { Rule } from "../../core/rule.js";
import { band, readCoveragePct, isReportStale } from "../../core/coverage.js";
import { settings } from "../../core/settings.js";

/**
 * Repo rule: score actual test coverage from the report `npm run coverage` / CI
 * produced. Owns coverage when execution is OFF; defers to `coverage-agentic`
 * when execution is ON (which re-runs for a fresh number). A stale report (code
 * changed since it was generated) is FLAGGED rather than trusted — its number
 * would be wrong, and we can't refresh it without execution.
 */
export const coverageThreshold: Rule = {
  id: "static/coverage-threshold",
  target: "repo",
  type: "static",
  description: "Scores line coverage from the coverage report (banded by %).",
  async run({ path: root }) {
    if (settings.execution.enabled) return { issues: [] }; // agentic owns coverage in execution mode

    const pct = await readCoveragePct(root);
    if (pct === null) return { issues: [] }; // no report — nothing to measure

    if (await isReportStale(root)) {
      return {
        issues: [
          {
            problem: "coverage report is stale (code changed since it was generated)",
            fix: "re-run coverage (e.g. `npm run coverage`) so the score reflects current code",
            severity: "minor",
          },
        ],
      };
    }

    const severity = band(pct);
    if (!severity) return { issues: [] };
    return {
      issues: [
        {
          problem: `line coverage is ${pct}% (target 100%)`,
          fix: "add tests for the least-covered files and branches to raise coverage",
          severity,
        },
      ],
    };
  },
};

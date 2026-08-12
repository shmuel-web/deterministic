import type { Rule } from "../../core/rule.js";
import { band, readCoveragePct, isReportStale } from "../../core/coverage.js";

/**
 * Repo rule: score actual test coverage from the report `npm run coverage` / CI
 * produced. A stale report is flagged rather than trusted because its number no
 * longer reflects the code being scored.
 */
export const coverageThreshold: Rule = {
  id: "static/coverage-threshold",
  target: "repo",
  type: "static",
  description: "Scores line coverage from the coverage report (banded by %).",
  async run({ path: root }) {
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

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule, Severity } from "../../core/rule.js";

const REPORT = path.join("coverage", "coverage-summary.json");

/** Banded severity by line-coverage %. 100 = clean; lower bands bite harder. */
function band(pct: number): Severity | null {
  if (pct >= 100) return null;
  if (pct >= 90) return "info";
  if (pct >= 80) return "minor";
  if (pct >= 70) return "major";
  return "critical";
}

/**
 * Repo rule: score actual test coverage. Reads the coverage report that
 * `npm run coverage` / CI produced (`coverage/coverage-summary.json`) — the rule
 * consumes the result rather than running the suite itself (that's CI's job).
 * Silent when no report is present (nothing to measure; run coverage first).
 *
 * NOTE: coverage is a whole-suite measurement, so the number reflects the last
 * coverage run — re-run coverage after changes to refresh it.
 */
export const coverageThreshold: Rule = {
  id: "static/coverage-threshold",
  target: "repo",
  type: "static",
  description: "Scores line coverage from the coverage report (banded by %).",
  async run({ path: root }) {
    let pct: number;
    try {
      const summary = JSON.parse(await fs.readFile(path.join(root, REPORT), "utf8")) as {
        total?: { lines?: { pct?: number } };
      };
      const value = summary.total?.lines?.pct;
      if (typeof value !== "number") return { issues: [] };
      pct = value;
    } catch {
      return { issues: [] }; // no/unreadable report — can't measure
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

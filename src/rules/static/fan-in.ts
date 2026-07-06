import type { Rule, RuleIssue } from "../../core/rule.js";
import { getImportGraph } from "../../core/import-graph.js";

const SOFT_CAP = 5;
const HARD_CAP = 15;

/**
 * Static: high fan-in (incoming imports) signals high blast radius —
 * changes to this file ripple to many dependents. Needs the repo-wide
 * import graph (lazy-built, cached after first call).
 */
export const fanIn: Rule = {
  id: "static/fan-in",
  target: "file",
  type: "static",
  description: "Flags files with high fan-in (many incoming imports) — a signal of high blast radius.",
  async run({ path: filePath }) {
    const graph = await getImportGraph();
    const count = graph.fanIn.get(filePath) ?? 0;

    if (count <= SOFT_CAP) return { issues: [] };

    const over = count - SOFT_CAP;
    const severity: RuleIssue["severity"] =
      count >= HARD_CAP ? "major" : over >= 5 ? "minor" : "info";

    return {
      issues: [
        {
          problem: `${count} files import this module — high fan-in means changes here have a wide blast radius`,
          fix: "extract a narrower interface, split into sub-modules, or introduce an indirection layer",
          severity,
        },
      ],
    };
  },
};

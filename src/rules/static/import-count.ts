import type { Rule, RuleIssue } from "../../core/rule.js";

const SOFT_CAP = 15;

/** Static: high import fan-out signals tight coupling. Language-agnostic (counts top-level import statements). */
export const importCount: Rule = {
  id: "static/import-count",
  target: "file",
  type: "static",
  description: "Flags files with excessive import fan-out — a signal of tight coupling.",
  run({ content }) {
    const count = (content ?? "").match(/^import\s/gm)?.length ?? 0;
    if (count <= SOFT_CAP) return { issues: [] };
    const over = count - SOFT_CAP;
    const severity: RuleIssue["severity"] = over > 20 ? "major" : over > 10 ? "minor" : "info";
    return {
      issues: [
        {
          problem: `file has ${count} imports — high fan-out signals tight coupling`,
          fix: "extract a sub-module or barrel file to group related imports",
          severity,
        },
      ],
    };
  },
};

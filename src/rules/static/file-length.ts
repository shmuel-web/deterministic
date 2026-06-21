import type { Rule } from "../../core/rule.js";

const SOFT_CAP = 300; // lines

/** Static: long files are hard for humans AND agents to reason about. */
export const fileLength: Rule = {
  id: "static/file-length",
  target: "file",
  type: "static",
  description: `Flags files longer than ~${SOFT_CAP} lines.`,
  run({ content }) {
    const lines = (content ?? "").split("\n").length;
    const over = lines - SOFT_CAP;
    if (over <= 0) return { issues: [] };
    const severity = over > 300 ? "major" : over > 100 ? "minor" : "info";
    return {
      issues: [
        {
          problem: `${lines} lines — ${over} over the ${SOFT_CAP}-line soft cap`,
          fix: "split this file into smaller, focused modules",
          severity,
        },
      ],
    };
  },
};

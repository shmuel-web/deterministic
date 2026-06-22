// @deterministic score: 97/100
//   [minor] llm/intent-legibility  The main exported symbol, `fileLength`, lacks a doc comment detailing its purpose as an application rule. → Add a JSDoc block immediately above `export const fileLength: Rule = {` that clearly explains what this rule enforces (e.g., 'Enforces soft and hard limits on the size of source files.')
// @deterministic:end
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

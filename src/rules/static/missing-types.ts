// @deterministic score: 97/100
//   [minor] static/missing-types  `any` annotation erases type safety → replace `any` with a concrete type
// @deterministic:end
import type { Rule, RuleIssue } from "../../core/rule.js";

/** Static: every `: any` is a hole in the type system. Inert on non-TS files. */
export const missingTypes: Rule = {
  id: "static/missing-types",
  target: "file",
  type: "static",
  description: "Flags `any` annotations in TypeScript files.",
  run({ path, content }) {
    if (!/\.tsx?$/.test(path)) return { issues: [] }; // inert on non-TS files
    const anys = (content ?? "").match(/:\s*any\b/g)?.length ?? 0;
    // One issue per `any` so the penalty accumulates; the annotation collapses
    // identical findings into a single "×N" line.
    const issue: RuleIssue = {
      problem: "`any` annotation erases type safety",
      fix: "replace `any` with a concrete type",
      severity: "minor",
    };
    return { issues: Array.from({ length: anys }, () => ({ ...issue })) };
  },
};

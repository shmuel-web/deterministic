import type { Rule, RuleIssue } from "../../core/rule.js";

/** Static: @ts-ignore and @ts-expect-error suppress type errors instead of fixing them. Inert on non-TS files. */
export const tsIgnoreCount: Rule = {
  id: "static/ts-ignore-count",
  target: "file",
  type: "static",
  description: "Flags `@ts-ignore` and `@ts-expect-error` suppressions in TypeScript files.",
  run({ path, content }) {
    if (!/\.tsx?$/.test(path)) return { issues: [] };
    const suppressions = (content ?? "").match(/@ts-ignore|@ts-expect-error/g)?.length ?? 0;
    const issue: RuleIssue = {
      problem: "`@ts-ignore` / `@ts-expect-error` suppresses a type error instead of fixing it",
      fix: "resolve the underlying type error and remove the suppression comment",
      severity: "minor",
    };
    return { issues: Array.from({ length: suppressions }, () => ({ ...issue })) };
  },
};

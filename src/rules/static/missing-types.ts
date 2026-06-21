// @deterministic score: 94/100  scored: 2026-06-21T08:19:15.902Z
//   static/file-length  100/100  w1  21 lines — within the 300-line soft cap.
//   static/missing-types  85/100  w2  1 `any` annotation(s) — each erases type safety.
//   static/function-length  100/100  w1  Longest function (run) is 11 lines — within the 50-line cap.
//   llm/intent-legibility  95/100  w3  Clear naming, obvious purpose, and well-documented rule that penalizes 'any' types in TS files with understandable scoring logic.
// @deterministic:end
import type { Rule } from "../../core/rule.js";

/** Static: every `: any` is a hole in the type system. Inert on non-TS files. */
export const missingTypes: Rule = {
  id: "static/missing-types",
  target: "file",
  type: "static",
  description: "Penalizes `any` annotations in TypeScript files.",
  run({ path, content }) {
    if (!/\.tsx?$/.test(path)) {
      return { score: 100, weight: 1, reasoning: "Not a TypeScript file — rule inert." };
    }
    const anys = (content ?? "").match(/:\s*any\b/g)?.length ?? 0;
    return {
      score: Math.max(0, 100 - anys * 15),
      weight: 1,
      reasoning: anys === 0 ? "No `any` annotations." : `${anys} \`any\` annotation(s) — each erases type safety.`,
    };
  },
};

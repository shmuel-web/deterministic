// @deterministic score: 95/100  scored: 2026-06-21T12:01:42.729Z
//   static/missing-types  85/100  w2  1 `any` annotation(s) — each erases type safety.
//   llm/intent-legibility  98/100  w3  The file's name, explicit module structure, and detailed comments immediately clarify that its sole purpose is implementing a type safety rule for `any`.
//   (2 rules passed)
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

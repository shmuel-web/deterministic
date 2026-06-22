import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

/**
 * Repo rule: if it's a TypeScript project, is `strict` on? Strict mode is the
 * single biggest type-safety lever — off, the type system can't catch most of
 * what it exists to catch. Inert on non-TS repos.
 */
export const tsconfigStrict: Rule = {
  id: "static/tsconfig-strict",
  target: "repo",
  type: "static",
  description: "Checks TypeScript strict mode is enabled.",
  async run({ path: root }) {
    let raw: string;
    try {
      raw = await fs.readFile(path.join(root, "tsconfig.json"), "utf8");
    } catch {
      return { issues: [] }; // not a TS project — inert
    }
    let cfg: { compilerOptions?: { strict?: boolean } };
    try {
      cfg = JSON.parse(raw);
    } catch {
      return { issues: [] }; // JSONC / unparseable — don't guess
    }
    if (cfg.compilerOptions?.strict === true) return { issues: [] };
    return {
      issues: [
        {
          problem: "TypeScript `strict` mode is not enabled",
          fix: 'set "strict": true in tsconfig.json compilerOptions',
          severity: "major",
        },
      ],
    };
  },
};

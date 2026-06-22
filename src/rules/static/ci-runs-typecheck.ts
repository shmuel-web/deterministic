import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const TYPECHECK = /\bnpm run typecheck\b|\btsc\b|--noEmit|type-check/i;

async function read(root: string, rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(root, rel), "utf8");
  } catch {
    return "";
  }
}
async function workflows(root: string): Promise<string> {
  const dir = path.join(root, ".github", "workflows");
  try {
    const files = await fs.readdir(dir);
    return (await Promise.all(files.map((f) => read(root, path.join(".github", "workflows", f))))).join("\n");
  } catch {
    return "";
  }
}

/**
 * Repo rule: for a TypeScript project, does CI run a type check? Inert on non-TS
 * repos. Stays silent when there's no CI at all — `ci-runs-tests` owns that gap.
 */
export const ciRunsTypecheck: Rule = {
  id: "static/ci-runs-typecheck",
  target: "repo",
  type: "static",
  description: "Checks CI type-checks a TypeScript project.",
  async run({ path: root }) {
    if (!(await read(root, "tsconfig.json"))) return { issues: [] }; // not TS
    const gitlab = await read(root, ".gitlab-ci.yml");
    const github = await workflows(root);
    if (gitlab === "" && github === "") return { issues: [] }; // no CI → ci-runs-tests covers it
    if (TYPECHECK.test(gitlab + "\n" + github)) return { issues: [] };
    return {
      issues: [
        {
          problem: "CI doesn't type-check this TypeScript project",
          fix: "add a `tsc --noEmit` / `npm run typecheck` step to CI",
          severity: "minor",
        },
      ],
    };
  },
};

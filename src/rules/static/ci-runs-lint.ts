import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";
import { hasLinter } from "./linter-configured.js";

const LINT_INVOCATION = /\bnpm run lint\b|\beslint\b|\bbiome\b|oxlint|\bxo\b/i;

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
 * Repo rule: if a linter is configured, does CI actually run it? Only fires when
 * a linter EXISTS — when there's no linter at all, `linter-configured` owns that
 * gap, so we don't double-penalize the same root cause.
 */
export const ciRunsLint: Rule = {
  id: "static/ci-runs-lint",
  target: "repo",
  type: "static",
  description: "Checks CI runs the linter (when one is configured).",
  async run({ path: root }) {
    if (!(await hasLinter(root))) return { issues: [] }; // no linter → linter-configured covers it
    const ci = (await read(root, ".gitlab-ci.yml")) + "\n" + (await workflows(root));
    if (LINT_INVOCATION.test(ci)) return { issues: [] };
    return {
      issues: [
        {
          problem: "a linter is configured but CI doesn't run it",
          fix: "add a CI step that runs the linter (e.g. `npm run lint`) on every push/MR",
          severity: "minor",
        },
      ],
    };
  },
};

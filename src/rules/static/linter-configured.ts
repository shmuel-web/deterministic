import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const LINTERS = /eslint|@biomejs|\bbiome\b|oxlint|\bxo\b|\bstandard\b|tslint/i;

/** Does package.json reference a linter (devDep/dep or a `lint` script)? */
export async function hasLinter(root: string): Promise<boolean> {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    const scripts = JSON.stringify(pkg.scripts ?? {});
    return LINTERS.test(deps) || LINTERS.test(scripts) || /\blint\b/.test(Object.keys(pkg.scripts ?? {}).join(" "));
  } catch {
    return false;
  }
}

/**
 * Repo rule: is a linter configured? A linter catches a class of bugs and drift
 * that tests don't — but it's a quality tool, not a validation gate, so: minor.
 */
export const linterConfigured: Rule = {
  id: "static/linter-configured",
  target: "repo",
  type: "static",
  description: "Checks a linter is configured.",
  async run({ path: root }) {
    if (await hasLinter(root)) return { issues: [] };
    return {
      issues: [
        {
          problem: "no linter configured",
          fix: "add a linter (e.g. ESLint or Biome) with a `lint` script",
          severity: "minor",
        },
      ],
    };
  },
};

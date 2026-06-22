import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const RUNNERS = /vitest|jest|mocha|ava|@japa|node:test|node --test|tsx --test|playwright|cypress/i;
const NPM_PLACEHOLDER = /no test specified/i;

/**
 * Repo rule: does the project have a test setup the agent can run? Code without
 * tests can't be validated — `validate` assumes a test command exists.
 */
export const repoHasTests: Rule = {
  id: "static/repo-has-tests",
  target: "repo",
  type: "static",
  description: "Checks the repo has a runnable test setup.",
  async run({ path: root }) {
    let pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> } = {};
    try {
      pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    } catch {
      // No package.json — this rule is JS/TS-shaped; stay quiet rather than guess.
      return { issues: [] };
    }
    const test = pkg.scripts?.test ?? "";
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasRealTestScript = test !== "" && !NPM_PLACEHOLDER.test(test);
    const hasRunner = RUNNERS.test(test) || Object.keys(deps).some((d) => RUNNERS.test(d));

    if (hasRealTestScript || hasRunner) return { issues: [] };
    return {
      issues: [
        {
          problem: "no runnable test setup (no real `test` script or recognized test runner)",
          fix: "add a test runner (vitest/jest/node:test) and a `test` script",
          severity: "major",
        },
      ],
    };
  },
};

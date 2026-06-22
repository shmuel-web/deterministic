// @deterministic score: 97/100
//   [minor] llm/intent-legibility  The primary exported constant `hasCoverageTool` lacks a doc comment describing its role as a rule object. → Add a JSDoc block immediately above `export const hasCoverageTool: Rule = { ... }` that explicitly states the purpose of this export, e.g., 'Rule used to check for configuration of code coverage tools (c8, nyc, etc.) within the project repository.'
// @deterministic:end
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const COVERAGE = /\bc8\b|\bnyc\b|coverage|--coverage|istanbul/i;

/**
 * Repo rule: is a coverage tool configured? Coverage is the cheapest objective
 * signal that tests touch meaningful ground. (Presence only — the actual
 * percentage is an execution rule, tracked separately.)
 */
export const hasCoverageTool: Rule = {
  id: "static/has-coverage-tool",
  target: "repo",
  type: "static",
  description: "Checks a coverage tool is configured.",
  async run({ path: root }) {
    let pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> } = {};
    try {
      pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    } catch {
      return { issues: [] };
    }
    const scripts = Object.values(pkg.scripts ?? {}).join(" ");
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    if (COVERAGE.test(scripts) || COVERAGE.test(deps)) return { issues: [] };
    return {
      issues: [
        {
          problem: "no code-coverage tool configured",
          fix: "add a coverage tool (e.g. c8 / nyc / the runner's --coverage) and a coverage script",
          severity: "minor",
        },
      ],
    };
  },
};

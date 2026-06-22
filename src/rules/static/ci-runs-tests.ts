import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const TEST_INVOCATION = /\bnpm (run )?test\b|vitest|jest|pytest|go test|node --test|tsx --test|--coverage|\bmocha\b/i;

/** Read a CI config if present; missing files just contribute "". */
async function read(root: string, rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(root, rel), "utf8");
  } catch {
    return "";
  }
}

/** List .github/workflows/*.yml contents (if any). */
async function workflows(root: string): Promise<string> {
  const dir = path.join(root, ".github", "workflows");
  try {
    const files = await fs.readdir(dir);
    const texts = await Promise.all(files.map((f) => read(root, path.join(".github", "workflows", f))));
    return texts.join("\n");
  } catch {
    return "";
  }
}

/**
 * Repo rule: does CI actually run the tests? `validate` assumes test execution
 * is automated and trustworthy; without it, regressions ship green.
 */
export const ciRunsTests: Rule = {
  id: "static/ci-runs-tests",
  target: "repo",
  type: "static",
  description: "Checks CI runs the test suite.",
  async run({ path: root }) {
    const gitlab = await read(root, ".gitlab-ci.yml");
    const github = await workflows(root);
    const ci = gitlab + "\n" + github;

    if (gitlab === "" && github === "") {
      return { issues: [{ problem: "no CI configuration found", fix: "add CI (.gitlab-ci.yml or a GitHub workflow) that runs the tests", severity: "major" }] };
    }
    if (TEST_INVOCATION.test(ci)) return { issues: [] };
    return {
      issues: [
        {
          problem: "CI exists but doesn't run the test suite",
          fix: "add a CI job that runs the tests (e.g. `npm test`) on every push/MR",
          severity: "major",
        },
      ],
    };
  },
};

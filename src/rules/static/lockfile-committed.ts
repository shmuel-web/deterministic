import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repo rule: is a lockfile present? Without one, installs aren't reproducible —
 * the agent (and CI) can get a different dependency tree than the author did.
 * Inert on non-Node repos.
 */
export const lockfileCommitted: Rule = {
  id: "static/lockfile-committed",
  target: "repo",
  type: "static",
  description: "Checks a dependency lockfile is present.",
  async run({ path: root }) {
    if (!(await exists(path.join(root, "package.json")))) return { issues: [] }; // not a Node repo
    for (const f of LOCKFILES) if (await exists(path.join(root, f))) return { issues: [] };
    return {
      issues: [
        {
          problem: "no dependency lockfile committed",
          fix: "commit the lockfile (package-lock.json / pnpm-lock.yaml / yarn.lock) for reproducible installs",
          severity: "minor",
        },
      ],
    };
  },
};

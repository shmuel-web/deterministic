import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repo rule: is the Node version pinned (`engines.node`, `.nvmrc`, or
 * `.node-version`)? Unpinned, the agent and CI may run a different runtime than
 * the author. Inert on non-Node repos.
 */
export const nodeVersionPinned: Rule = {
  id: "static/node-version-pinned",
  target: "repo",
  type: "static",
  description: "Checks the Node version is pinned.",
  async run({ path: root }) {
    let pkg: { engines?: { node?: string } } | null = null;
    try {
      pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    } catch {
      return { issues: [] }; // not a Node repo
    }
    if (pkg?.engines?.node) return { issues: [] };
    if ((await exists(path.join(root, ".nvmrc"))) || (await exists(path.join(root, ".node-version")))) return { issues: [] };
    return {
      issues: [
        {
          problem: "Node version not pinned",
          fix: "add an `engines.node` range in package.json (or a .nvmrc)",
          severity: "info",
        },
      ],
    };
  },
};

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

/**
 * Repo rule: is there a sane .gitignore? For a Node repo, `node_modules` must be
 * ignored (committing it is a classic, costly mistake). Inert on non-Node repos.
 */
export const gitignoreSane: Rule = {
  id: "static/gitignore-sane",
  target: "repo",
  type: "static",
  description: "Checks .gitignore ignores the obvious (node_modules).",
  async run({ path: root }) {
    let isNode = false;
    try {
      await fs.access(path.join(root, "package.json"));
      isNode = true;
    } catch {
      return { issues: [] };
    }
    let gitignore = "";
    try {
      gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    } catch {
      return {
        issues: [{ problem: "no .gitignore", fix: "add a .gitignore (ignore node_modules, dist, .env)", severity: "minor" }],
      };
    }
    if (isNode && !/(^|\/)node_modules\/?/m.test(gitignore)) {
      return {
        issues: [
          { problem: ".gitignore doesn't ignore node_modules", fix: "add `node_modules/` to .gitignore", severity: "minor" },
        ],
      };
    }
    return { issues: [] };
  },
};

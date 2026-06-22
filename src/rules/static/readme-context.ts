import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const MIN_CHARS = 300;
const USAGE = /```|\b(install|usage|getting started|how to run|quick ?start)\b/i;

/**
 * Repo rule (AI-readiness): does the README give enough context to bootstrap?
 * Agents (and humans) build their understanding of a repo from the README; a
 * missing or thin one is the biggest context gap.
 */
export const readmeContext: Rule = {
  id: "static/readme-context",
  target: "repo",
  type: "static",
  description: "Checks the README provides bootstrapping context.",
  async run({ path: root }) {
    let readme: string;
    try {
      readme = await fs.readFile(path.join(root, "README.md"), "utf8");
    } catch {
      return { issues: [{ problem: "no README.md", fix: "add a README describing the project, setup, and usage", severity: "major" }] };
    }
    if (readme.trim().length < MIN_CHARS) {
      return { issues: [{ problem: `README is very thin (< ${MIN_CHARS} chars)`, fix: "expand the README: what it is, setup, usage", severity: "minor" }] };
    }
    if (!USAGE.test(readme)) {
      return { issues: [{ problem: "README has no setup/usage guidance", fix: "add an install/usage section or a runnable example", severity: "minor" }] };
    }
    return { issues: [] };
  },
};

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

const LICENSE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md"];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repo rule: is there a LICENSE file? Without one, the terms of use are
 * undefined regardless of what the README claims.
 */
export const licensePresent: Rule = {
  id: "static/license-present",
  target: "repo",
  type: "static",
  description: "Checks a LICENSE file is present.",
  async run({ path: root }) {
    for (const f of LICENSE_FILES) if (await exists(path.join(root, f))) return { issues: [] };
    return {
      issues: [
        {
          problem: "no LICENSE file",
          fix: "add a LICENSE file matching the intended license (e.g. MIT)",
          severity: "minor",
        },
      ],
    };
  },
};

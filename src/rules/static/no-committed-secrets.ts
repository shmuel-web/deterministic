import { execFileSync } from "node:child_process";
import type { Rule } from "../../core/rule.js";

// High-confidence secret-bearing filenames. Kept tight to avoid false positives.
const SECRET_FILE = /(^|\/)\.env(\.[\w-]+)?$|\.pem$|\.p12$|\.pfx$|(^|\/)id_(rsa|dsa|ecdsa|ed25519)$|\.key$/i;
const ALLOWED = /\.env\.(example|sample|template)$/i; // these are meant to be committed

/**
 * Repo rule: are secret-bearing files committed to version control? Checks
 * git-TRACKED files (not the working tree) so a locally-gitignored `.env` is
 * never a false positive. Critical — a leaked secret is the worst gap there is.
 */
export const noCommittedSecrets: Rule = {
  id: "static/no-committed-secrets",
  target: "repo",
  type: "static",
  description: "Flags secret-bearing files that are committed.",
  async run({ path: root }) {
    let tracked: string[];
    try {
      tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
        .split("\n")
        .filter(Boolean);
    } catch {
      return { issues: [] }; // not a git repo — can't tell what's committed
    }
    const offenders = tracked.filter((f) => SECRET_FILE.test(f) && !ALLOWED.test(f));
    return {
      issues: offenders.map((f) => ({
        problem: `secret-bearing file committed: ${f}`,
        fix: `remove ${f} from git, add it to .gitignore, and rotate the secret`,
        severity: "critical" as const,
      })),
    };
  },
};

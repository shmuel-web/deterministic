import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rule } from "../../core/rule.js";

/**
 * The recursion rule: does the repo MECHANICALLY enforce running Deterministic?
 *
 * A linter nobody runs is dead weight, and "absence means clean" makes a stale
 * score invisible — so Deterministic must be wired into the delivery flow, not
 * left to memory. This rule is satisfied by ANY one of: a committed git hook
 * (pre-commit / pre-push via Husky, lefthook, .githooks, pre-commit, or
 * simple-git-hooks) or a CI job (GitLab / GitHub) that invokes Deterministic.
 * None of them → a major issue (the tool can silently go stale).
 *
 * This checks machine enforcement rather than relying on developer convention.
 */

// A real Deterministic invocation: installed CLI, `npx`, or the local cli entry.
const INVOCATION =
  /\b(?:npx\s+)?deterministic\s+(?:init|score|validate)\b|\bnpx\s+deterministic\b|\bcli\.(?:ts|js)\b[^\n\r]*\b(?:init|score|validate)\b/i;

async function read(root: string, rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(root, rel), "utf8");
  } catch {
    return "";
  }
}

async function workflows(root: string): Promise<string[]> {
  const dir = path.join(root, ".github", "workflows");
  try {
    const files = await fs.readdir(dir);
    return Promise.all(
      files.filter((f) => /\.ya?ml$/i.test(f)).map((f) => read(root, path.join(".github", "workflows", f))),
    );
  } catch {
    return [];
  }
}

/** Resolve `npm|pnpm|yarn run <name>` indirection by appending the referenced script's body. */
function withScriptBodies(text: string, scripts: Record<string, string>): string {
  let expanded = text;
  for (const [name, body] of Object.entries(scripts)) {
    const ref = new RegExp(`\\b(?:npm|pnpm|yarn)\\s+(?:run\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (ref.test(text)) expanded += "\n" + body;
  }
  return expanded;
}

export const enforcesDeterministic: Rule = {
  id: "static/enforces-deterministic",
  target: "repo",
  type: "static",
  description: "Checks a git hook or a CI job mechanically runs Deterministic (so scores can't silently go stale).",
  async run({ path: root }) {
    let scripts: Record<string, string> = {};
    let simpleGitHooks = "";
    try {
      const pkg = JSON.parse(await read(root, "package.json")) as Record<string, unknown>;
      scripts = (pkg.scripts as Record<string, string>) ?? {};
      if (pkg["simple-git-hooks"]) simpleGitHooks = JSON.stringify(pkg["simple-git-hooks"]);
    } catch {
      // no/invalid package.json — fine, other surfaces may still enforce.
    }

    const candidates = [
      await read(root, ".gitlab-ci.yml"),
      ...(await workflows(root)),
      await read(root, ".husky/pre-commit"),
      await read(root, ".husky/pre-push"),
      await read(root, "lefthook.yml"),
      await read(root, ".lefthook.yml"),
      await read(root, "lefthook.yaml"),
      await read(root, ".githooks/pre-commit"),
      await read(root, ".githooks/pre-push"),
      await read(root, ".pre-commit-config.yaml"),
      simpleGitHooks,
    ];

    if (candidates.some((text) => text && INVOCATION.test(withScriptBodies(text, scripts)))) {
      return { issues: [] };
    }

    return {
      issues: [
        {
          problem:
            "nothing makes running Deterministic mandatory — no git hook (pre-commit/pre-push) and no CI job runs it, so the repo's score silently goes stale",
          fix: "add a pre-commit/pre-push hook (Husky or lefthook) OR a CI job that runs `deterministic score repo` on every change",
          severity: "major",
        },
      ],
    };
  },
};

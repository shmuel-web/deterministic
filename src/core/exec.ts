import { execFile } from "node:child_process";

/**
 * Sandboxed command execution for agentic rules (spec 002). An agent that runs
 * commands is the scariest capability in the product, so this is the hard
 * boundary: only allowlisted executables, no shell (so no metacharacters can do
 * anything), a hard timeout, run in the repo dir, and it NEVER throws.
 */

/** Executables an agentic rule is permitted to run. The allowlist IS the safety. */
export const DEFAULT_ALLOWLIST = [
  "npm", "npx", "node", "c8", "nyc", "vitest", "jest",
  "pytest", "python", "python3", "coverage",
  "go", "eslint", "biome", "tsc",
];

export interface ExecResult {
  ok: boolean;
  stdout: string;
  code: number | null;
  error?: string;
}

const META = /[;&|`$()<>\n\\!*?{}[\]]/; // anything shell-special → reject outright

/**
 * Parse a command string into argv WITHOUT a shell. Returns null if it contains
 * shell metacharacters or the executable isn't allowlisted.
 */
export function parseSafe(command: string, allowlist: readonly string[] = DEFAULT_ALLOWLIST): string[] | null {
  if (META.test(command)) return null;
  const argv = command.trim().split(/\s+/).filter(Boolean);
  if (argv.length === 0) return null;
  if (!allowlist.includes(argv[0]!)) return null;
  return argv;
}

/**
 * Run a command safely. `execFile` (not `exec`) means there is NO shell — the
 * argv is passed directly, so metacharacters can't be interpreted even if one
 * slipped through. Always resolves; never throws.
 */
export function safeExec(
  command: string,
  opts: { cwd: string; timeoutMs?: number; allowlist?: readonly string[] },
): Promise<ExecResult> {
  const argv = parseSafe(command, opts.allowlist);
  if (!argv) {
    return Promise.resolve({ ok: false, stdout: "", code: null, error: "command rejected (not allowlisted or unsafe)" });
  }
  const [bin, ...args] = argv;
  return new Promise((resolve) => {
    execFile(
      bin!,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs ?? 120_000, maxBuffer: 32 * 1024 * 1024, shell: false },
      (err, stdout, stderr) => {
        const out = (stdout ?? "") + (stderr ?? "");
        if (err) resolve({ ok: false, stdout: out, code: (err as { code?: number }).code ?? null, error: err.message });
        else resolve({ ok: true, stdout: out, code: 0 });
      },
    );
  });
}

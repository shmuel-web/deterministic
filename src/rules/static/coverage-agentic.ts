import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Rule, Severity } from "../../core/rule.js";
import { safeExec } from "../../core/exec.js";
import { resolveModel } from "../../core/model.js";
import { settings } from "../../core/settings.js";

const REPORT = path.join("coverage", "coverage-summary.json");

/** Banded severity by line-coverage % (shared scale with the static rule). */
export function band(pct: number): Severity | null {
  if (pct >= 100) return null;
  if (pct >= 90) return "info";
  if (pct >= 80) return "minor";
  if (pct >= 70) return "major";
  return "critical";
}

const PctSchema = z.object({ pct: z.number().min(0).max(100) });
/** Pull a {pct} number out of model output (tolerant of chatter). */
export function parsePct(raw: string): number | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = PctSchema.safeParse(JSON.parse(m[0]));
    return p.success ? p.data.pct : null;
  } catch {
    return null;
  }
}

async function reportExists(root: string): Promise<boolean> {
  try {
    await fs.access(path.join(root, REPORT));
    return true;
  } catch {
    return false;
  }
}

/**
 * Agentic execution rule (spec 002): when there's no coverage report and
 * execution is enabled, an agent figures out the coverage command, `safeExec`
 * runs it, the agent reads the line %, and we band it. Language-agnostic.
 *
 * Type `static` so the engine never *forces* a model (it self-resolves one only
 * for the discovery path). Defers to the static `coverage-threshold` whenever a
 * report already exists — no double-count. Opt-in via `settings.execution`.
 */
export const coverageAgentic: Rule = {
  id: "static/coverage-agentic",
  target: "repo",
  type: "static",
  description: "Agent-driven coverage: discovers & runs the coverage tool when no report exists.",
  async run({ path: root }) {
    if (await reportExists(root)) return { issues: [] }; // static coverage-threshold owns this
    if (!settings.execution.enabled) return { issues: [] }; // safe by default — no commands run
    const model = await resolveModel();
    if (!model) return { issues: [] };
    const pkg = await fs.readFile(path.join(root, "package.json"), "utf8").catch(() => "");

    // 1. agent decides the coverage command
    const cmdRaw = await model.complete(
      `Given this project, output ONLY the single shell command that produces a test-coverage report (no prose).\n` +
        `Use a common tool (c8/nyc/vitest --coverage/jest --coverage/pytest --cov/go test -cover).\n---\n${pkg.slice(0, 2000)}`,
    );
    const command = cmdRaw.trim().split("\n")[0]!.replace(/^[`$]+|[`]+$/g, "").trim();

    // 2. safeExec runs it (allowlist + timeout + no shell)
    const res = await safeExec(command, { cwd: root, timeoutMs: settings.execution.timeoutMs });
    if (!res.ok) return { issues: [] }; // couldn't run (rejected/failed/timed out) — don't fabricate

    // 3. agent reads the line coverage % from the output
    const pct = parsePct(await model.complete(
      `From this coverage tool output, what is the overall LINE coverage percentage?\n` +
        `Reply ONLY JSON: {"pct": <number 0-100>}\n---\n${res.stdout.slice(-4000)}`,
    ));
    if (pct === null) return { issues: [] };

    const severity = band(pct);
    if (!severity) return { issues: [] };
    return {
      issues: [
        {
          problem: `line coverage is ${pct}% (measured via \`${command}\`)`,
          fix: "add tests for the least-covered files and branches to raise coverage",
          severity,
        },
      ],
    };
  },
};

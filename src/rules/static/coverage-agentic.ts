import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Rule, RuleIssue } from "../../core/rule.js";
import { safeExec } from "../../core/exec.js";
import { resolveModel } from "../../core/model.js";
import { settings } from "../../core/settings.js";
import { band, readCoveragePct, isReportStale } from "../../core/coverage.js";

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

function issueFor(pct: number, via: string): RuleIssue[] {
  const severity = band(pct);
  if (!severity) return [];
  return [{ problem: `line coverage is ${pct}% (${via})`, fix: "add tests for the least-covered files and branches", severity }];
}

/**
 * Agentic execution rule (spec 002). Owns coverage when execution is ENABLED:
 * - a FRESH report on disk → just band it (no re-run);
 * - STALE or absent report → an agent picks the coverage command, `safeExec`
 *   runs it, the agent reads the line %, we band it.
 * Silent when execution is off (the static `coverage-threshold` owns that mode).
 * This is how staleness is handled in execution mode — we always end up fresh.
 */
export const coverageAgentic: Rule = {
  id: "static/coverage-agentic",
  target: "repo",
  type: "static",
  description: "Agent-driven coverage: re-runs the coverage tool when the report is stale or missing.",
  async run({ path: root }) {
    if (!settings.execution.enabled) return { issues: [] }; // safe by default; static rule owns off-mode

    const pct = await readCoveragePct(root);
    if (pct !== null && !(await isReportStale(root))) return { issues: issueFor(pct, "fresh report") };

    // stale or absent → re-run for a current number
    const model = await resolveModel();
    if (!model) return { issues: [] };
    const pkg = await fs.readFile(path.join(root, "package.json"), "utf8").catch(() => "");

    const cmdRaw = await model.complete(
      `Given this project, output ONLY the single shell command that produces a test-coverage report (no prose).\n` +
        `Use a common tool (c8/nyc/vitest --coverage/jest --coverage/pytest --cov/go test -cover).\n---\n${pkg.slice(0, 2000)}`,
    );
    const command = cmdRaw.trim().split("\n")[0]!.replace(/^[`$]+|[`]+$/g, "").trim();

    const res = await safeExec(command, { cwd: root, timeoutMs: settings.execution.timeoutMs });
    if (!res.ok) return { issues: [] }; // rejected / failed / timed out — don't fabricate

    const measured = parsePct(
      await model.complete(
        `From this coverage tool output, what is the overall LINE coverage percentage?\n` +
          `Reply ONLY JSON: {"pct": <number 0-100>}\n---\n${res.stdout.slice(-4000)}`,
      ),
    );
    return measured === null ? { issues: [] } : { issues: issueFor(measured, `re-run via \`${command}\``) };
  },
};

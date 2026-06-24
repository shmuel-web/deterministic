import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ModelClient, CompleteOptions } from "../../src/core/rule.js";

/**
 * #64 — LLM tuning harness. The bounded-parallel infra (#63) is in, but the real
 * cost is per-call latency, and the quick wins (format:json + num_predict cap +
 * temperature:0) were measured to CUT recall — the model stopped finding obvious
 * issues. So speed must be proven NOT to cost recall, on a fixture of good + bad
 * files, before any tuning ships.
 *
 * This module is the measurement core: pure, model-injected, and testable with a
 * stub. `tests/perf/run.mts` wires a real model (Ollama) and prints the table;
 * with no model it prints how to connect one. Nothing here ships in the CLI.
 */

/** Mirrors the `llm/intent-legibility` rule's scope so the study measures the real rule's behaviour. */
export const LEGIBILITY = {
  topic: "intent legibility — judged ONLY from the clarity of names and doc comments",
  lookFor:
    "- a misleading or meaningless exported name (single letters, `d`, `p`, `M`)\n" +
    "- a missing doc comment on the main export\n" +
    "- no statement of the file's purpose",
};

/** Build the scoped legibility prompt for a (virtual) file path + content. */
export function buildLegibilityPrompt(filePath: string, content: string): string {
  return `You are reviewing a file for ONE specific concern, and nothing else.

CONCERN: ${LEGIBILITY.topic}

Look for (this, and only this):
${LEGIBILITY.lookFor}

Hard rules:
- Report ONLY issues about the concern above. Ignore architecture, performance, refactors, tests.
- Every issue must name a concrete, specific fix.
- If there are no issues for THIS concern, return {"issues": []}. Never invent issues. Never praise.

Return ONLY JSON: {"issues":[{"problem":"<one terse sentence>","fix":"<one terse sentence>","severity":"info|minor|major|critical"}]}

FILE: ${filePath}
---
${content.slice(0, 8000)}
---`;
}

const IssuesSchema = z.object({ issues: z.array(z.object({ problem: z.string(), fix: z.string(), severity: z.string() })) });

/** Parse the model's JSON; returns issue count, or null when unparseable (e.g. truncated by a low cap). */
export function parseIssueCount(raw: string): number | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = IssuesSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.issues.length : null;
  } catch {
    return null;
  }
}

/** A tuning configuration to measure. `opts` is passed straight to `model.complete`. */
export interface TuningVariant {
  name: string;
  opts: CompleteOptions;
}

/**
 * The knobs from the #64 investigation. `baseline` is the current untuned call
 * (the recall reference). The others are the speed levers whose recall cost must
 * be measured, not assumed.
 */
export const VARIANTS: TuningVariant[] = [
  { name: "baseline", opts: {} },
  { name: "json", opts: { json: true } },
  { name: "cap-256", opts: { maxTokens: 256 } },
  { name: "json+cap-256", opts: { json: true, maxTokens: 256 } },
];

export interface Fixture {
  /** Virtual source path shown to the model (e.g. "cryptic-names.ts"). */
  name: string;
  content: string;
  /** True = a deliberately-bad file we EXPECT to be flagged (recall); false = clean (false-positive check). */
  expectBad: boolean;
}

/** Load the good/bad fixture corpus. Fixtures are `.txt` (so eslint/tsc skip them); names drop the `.txt`. */
export async function loadFixtures(dir: string): Promise<Fixture[]> {
  const out: Fixture[] = [];
  for (const expectBad of [true, false]) {
    const sub = path.join(dir, expectBad ? "bad" : "good");
    for (const file of (await fs.readdir(sub)).filter((f) => f.endsWith(".txt")).sort()) {
      out.push({
        name: file.replace(/\.txt$/, ""),
        content: await fs.readFile(path.join(sub, file), "utf8"),
        expectBad,
      });
    }
  }
  return out;
}

export interface FileMeasurement {
  name: string;
  expectBad: boolean;
  issueCount: number | null; // null = unparseable (truncation)
  ms: number;
}

export interface VariantResult {
  name: string;
  perFile: FileMeasurement[];
  /** Of the bad files, the fraction that were correctly flagged (>=1 issue). The recall signal. */
  recall: number;
  /** Of the good files, how many were wrongly flagged. Lower is better. */
  falsePositives: number;
  /** Calls whose output didn't parse (the truncation hazard a low cap introduces). */
  parseFailures: number;
  avgMs: number;
}

/** Compute the headline metrics from raw per-file measurements (pure — unit-tested). */
export function summarize(name: string, perFile: FileMeasurement[]): VariantResult {
  const bad = perFile.filter((m) => m.expectBad);
  const good = perFile.filter((m) => !m.expectBad);
  const flagged = (m: FileMeasurement) => (m.issueCount ?? 0) > 0;
  return {
    name,
    perFile,
    recall: bad.length ? bad.filter(flagged).length / bad.length : 1,
    falsePositives: good.filter(flagged).length,
    parseFailures: perFile.filter((m) => m.issueCount === null).length,
    avgMs: perFile.length ? Math.round(perFile.reduce((s, m) => s + m.ms, 0) / perFile.length) : 0,
  };
}

/** Run one variant over the corpus with the given model + clock, returning measurements. */
export async function runVariant(
  model: ModelClient,
  variant: TuningVariant,
  fixtures: Fixture[],
  now: () => number = () => Date.now(),
): Promise<VariantResult> {
  const perFile: FileMeasurement[] = [];
  for (const fx of fixtures) {
    const start = now();
    const raw = await model.complete(buildLegibilityPrompt(fx.name, fx.content), variant.opts);
    perFile.push({ name: fx.name, expectBad: fx.expectBad, issueCount: parseIssueCount(raw), ms: now() - start });
  }
  return summarize(variant.name, perFile);
}

/** Render the comparison table. Recall drop vs baseline is the thing to watch. */
export function renderTable(results: VariantResult[]): string {
  const base = results.find((r) => r.name === "baseline");
  const rows = results.map((r) => {
    const recallDelta = base && r !== base ? `  (${r.recall - base.recall >= 0 ? "+" : ""}${Math.round((r.recall - base.recall) * 100)}%)` : "";
    const speedup = base && base.avgMs && r.avgMs ? `${(base.avgMs / r.avgMs).toFixed(1)}x` : "—";
    return `  ${r.name.padEnd(14)} recall ${(r.recall * 100).toFixed(0)}%${recallDelta.padEnd(10)}  fp ${r.falsePositives}  parsefail ${r.parseFailures}  ${r.avgMs}ms/call  ${speedup}`;
  });
  return ["", "  variant         recall            falsePos  parseFail  latency   speedup", ...rows, ""].join("\n");
}

/**
 * Panel calibration harness (spec 004, #80).
 *
 * Precision can only be measured against the REAL model — a stub can't be chatty.
 * So this is an on-demand harness (`npm run calibrate`), NOT part of `npm test`:
 * it runs the actual reviewer panel over curated fixtures and checks each meets
 * its expectation —
 *   - SILENT fixtures (well-specified, no material gap) must yield ZERO issues (SC-001);
 *   - FLAG fixtures (a real, file-grounded gap) must yield ≥1 issue citing the file (SC-002).
 *
 * Run it when tuning prompts or after a model bump. A chatty model fails here
 * (non-zero exit), so it gates a merge of panel changes even though CI (which
 * has no model) can't run it. Needs Ollama (or an API model).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { settings } from "../../src/core/settings.js";
import { resolveModel } from "../../src/core/model.js";
import { reviewPanel } from "../../src/ticket/review/panel.js";

interface Fixture {
  file: string;
  expect: "silent" | "flag";
  /** For `flag`: a blast-radius file the issue must cite. */
  citesFile?: string;
}

const FIXTURES: Fixture[] = [
  { file: "examples/tickets/panel-clean.md", expect: "silent" },
  { file: "examples/tickets/panel-schema-no-migration.md", expect: "flag", citesFile: "index-store.ts" },
];

const ROUNDS = Number(process.env.CALIBRATION_ROUNDS) || 1;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main(): Promise<void> {
  settings.review.enabled = true; // calibrate the panel specifically
  const model = await resolveModel();
  if (!model) {
    console.error("calibration needs a model — start Ollama (localhost:11434) or set DETERMINISTIC_LLM_API_*.");
    process.exit(2);
  }

  let failures = 0;
  console.log(`\n  Panel calibration — ${FIXTURES.length} fixture(s) × ${ROUNDS} round(s)\n`);

  for (const fx of FIXTURES) {
    const content = await fs.readFile(path.join(repoRoot, fx.file), "utf8");
    const counts: number[] = [];
    let lastIssues: { problem: string }[] = [];

    for (let r = 0; r < ROUNDS; r++) {
      const { issues } = await reviewPanel.run({ target: "ticket", path: fx.file, content, model });
      counts.push(issues.length);
      lastIssues = issues;
    }

    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    let ok: boolean;
    if (fx.expect === "silent") {
      ok = counts.every((c) => c === 0);
    } else {
      const cites = (i: { problem: string }) => !fx.citesFile || i.problem.toLowerCase().includes(fx.citesFile.toLowerCase());
      ok = lastIssues.length >= 1 && lastIssues.some(cites);
    }

    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} [${fx.expect}] ${fx.file} — counts: [${counts.join(", ")}] (avg ${avg.toFixed(1)})`);
    for (const i of lastIssues) console.log(`        • ${i.problem}`);
  }

  console.log(`\n  ${failures === 0 ? "PASS" : `FAIL — ${failures} fixture(s) off-target`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();

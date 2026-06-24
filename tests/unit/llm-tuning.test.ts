import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelClient } from "../../src/core/rule.js";
import {
  parseIssueCount,
  summarize,
  runVariant,
  loadFixtures,
  renderTable,
  buildLegibilityPrompt,
  type FileMeasurement,
} from "../perf/llm-tuning.js";

/**
 * #64 — the tuning harness logic, verified WITHOUT a model. A stub model lets us
 * prove recall / false-positive / parse-failure / latency accounting is correct
 * now; only the real measurement numbers wait on Ollama.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, "../perf/fixtures/legibility");

test("parseIssueCount: counts issues, null on unparseable (truncation)", () => {
  assert.equal(parseIssueCount('{"issues":[{"problem":"p","fix":"f","severity":"minor"}]}'), 1);
  assert.equal(parseIssueCount('{"issues":[]}'), 0);
  assert.equal(parseIssueCount('{"issues":[{"problem":"p","fix":"f","sev'), null); // cut off mid-JSON
  assert.equal(parseIssueCount("no json here"), null);
});

test("buildLegibilityPrompt: scoped to the one concern, embeds path + content", () => {
  const p = buildLegibilityPrompt("cryptic.ts", "export const d = 1;");
  assert.match(p, /ONE specific concern/);
  assert.match(p, /intent legibility/);
  assert.match(p, /FILE: cryptic\.ts/);
  assert.match(p, /export const d = 1;/);
});

test("summarize: recall, false positives, parse failures, avg latency", () => {
  const perFile: FileMeasurement[] = [
    { name: "bad1.ts", expectBad: true, issueCount: 2, ms: 100 }, // flagged → recall hit
    { name: "bad2.ts", expectBad: true, issueCount: 0, ms: 200 }, // missed → recall miss
    { name: "good1.ts", expectBad: false, issueCount: 1, ms: 300 }, // false positive
    { name: "good2.ts", expectBad: false, issueCount: null, ms: 400 }, // parse failure (and not a flag)
  ];
  const r = summarize("v", perFile);
  assert.equal(r.recall, 0.5); // 1 of 2 bad files flagged
  assert.equal(r.falsePositives, 1); // good1 wrongly flagged
  assert.equal(r.parseFailures, 1); // good2 unparseable
  assert.equal(r.avgMs, 250); // (100+200+300+400)/4
});

test("runVariant: drives the model over the corpus with an injected clock", async () => {
  const fixtures = await loadFixtures(FIXTURES);
  assert.ok(fixtures.some((f) => f.expectBad) && fixtures.some((f) => !f.expectBad), "corpus has good + bad");

  // A perfect stub: flags bad files (cryptic/no-docs), passes good ones.
  let t = 0;
  const stub: ModelClient = {
    complete(prompt: string) {
      const isBad = prompt.includes("export function p(") || prompt.includes("export function process(");
      return Promise.resolve(isBad ? '{"issues":[{"problem":"meaningless name","fix":"rename","severity":"minor"}]}' : '{"issues":[]}');
    },
  };
  const clock = () => (t += 5); // deterministic 5ms/call

  const r = await runVariant(stub, { name: "baseline", opts: {} }, fixtures, clock);
  assert.equal(r.recall, 1, "perfect stub flags every bad file");
  assert.equal(r.falsePositives, 0, "and never flags a clean file");
  assert.equal(r.parseFailures, 0);
});

test("renderTable: shows recall delta vs baseline and a speedup column", () => {
  const table = renderTable([
    { name: "baseline", perFile: [], recall: 1, falsePositives: 0, parseFailures: 0, avgMs: 200 },
    { name: "json+cap-256", perFile: [], recall: 0.5, falsePositives: 0, parseFailures: 1, avgMs: 20 },
  ]);
  assert.match(table, /baseline/);
  assert.match(table, /-50%/); // recall regression surfaced
  assert.match(table, /10\.0x/); // 200/20 speedup
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isReportStale, readCoveragePct } from "../../src/core/coverage.js";

async function tmp(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-fresh-"));
  await fs.mkdir(path.join(dir, "coverage"), { recursive: true });
  return dir;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const writeReport = (dir: string) =>
  fs.writeFile(path.join(dir, "coverage", "coverage-summary.json"), JSON.stringify({ total: { lines: { pct: 88 } } }), "utf8");

test("no report → stale (must generate)", async () => {
  const dir = await tmp();
  assert.equal(await isReportStale(dir), true);
  assert.equal(await readCoveragePct(dir), null);
});

test("report newer than all code files → fresh", async () => {
  const dir = await tmp();
  await fs.writeFile(path.join(dir, "a.ts"), "export const x = 1;\n", "utf8");
  await sleep(10);
  await writeReport(dir);
  assert.equal(await isReportStale(dir, async () => ["a.ts"]), false);
});

test("a code file modified after the report → stale", async () => {
  const dir = await tmp();
  await writeReport(dir);
  await sleep(10);
  await fs.writeFile(path.join(dir, "a.ts"), "export const x = 2;\n", "utf8"); // touched after report
  assert.equal(await isReportStale(dir, async () => ["a.ts"]), true);
});

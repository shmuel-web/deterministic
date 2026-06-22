import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { coverageThreshold } from "../../src/rules/static/coverage-threshold.js";

async function repoWithCoverage(pct: number | null): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-cov-"));
  if (pct !== null) {
    await fs.mkdir(path.join(dir, "coverage"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "coverage", "coverage-summary.json"),
      JSON.stringify({ total: { lines: { pct } } }),
      "utf8",
    );
  }
  return dir;
}
const run = async (root: string) => (await coverageThreshold.run({ target: "repo", path: root })).issues;

test("banded severity by coverage %", async () => {
  assert.equal((await run(await repoWithCoverage(100))).length, 0); // perfect
  assert.equal((await run(await repoWithCoverage(95)))[0]!.severity, "info"); // 90–99
  assert.equal((await run(await repoWithCoverage(85)))[0]!.severity, "minor"); // 80–89
  assert.equal((await run(await repoWithCoverage(75)))[0]!.severity, "major"); // 70–79
  assert.equal((await run(await repoWithCoverage(60)))[0]!.severity, "critical"); // < 70
});

test("boundaries: 90 → info, 80 → minor, 70 → major", async () => {
  assert.equal((await run(await repoWithCoverage(90)))[0]!.severity, "info");
  assert.equal((await run(await repoWithCoverage(80)))[0]!.severity, "minor");
  assert.equal((await run(await repoWithCoverage(70)))[0]!.severity, "major");
});

test("no coverage report → silent (nothing to measure)", async () => {
  assert.deepEqual(await run(await repoWithCoverage(null)), []);
});

test("the issue states the actual percentage", async () => {
  const out = await run(await repoWithCoverage(91.89));
  assert.match(out[0]!.problem, /91\.89%/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { coverageAgentic, band, parsePct } from "../../src/rules/static/coverage-agentic.js";

const run = async (root: string) => (await coverageAgentic.run({ target: "repo", path: root })).issues;
const tmp = async (files: Record<string, string> = {}) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-ag-"));
  for (const [rel, c] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), c, "utf8");
  }
  return dir;
};

test("band: shared coverage scale", () => {
  assert.equal(band(100), null);
  assert.equal(band(95), "info");
  assert.equal(band(85), "minor");
  assert.equal(band(75), "major");
  assert.equal(band(60), "critical");
});

test("parsePct: extracts {pct} from chatter", () => {
  assert.equal(parsePct('coverage is {"pct": 73.5} ok'), 73.5);
  assert.equal(parsePct("no json"), null);
});

test("defers when a coverage report already exists (static rule owns it)", async () => {
  const dir = await tmp({ "coverage/coverage-summary.json": JSON.stringify({ total: { lines: { pct: 50 } } }) });
  assert.deepEqual(await run(dir), []); // no double-count even though 50% would be critical
});

test("safe by default: no report + execution disabled → does nothing (no command runs)", async () => {
  const dir = await tmp({ "package.json": "{}" });
  assert.deepEqual(await run(dir), []);
});

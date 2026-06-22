import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { parseSafe, safeExec } from "../../src/core/exec.js";

test("parseSafe: allowlisted executable → argv", () => {
  assert.deepEqual(parseSafe("npm run coverage"), ["npm", "run", "coverage"]);
});

test("parseSafe: rejects non-allowlisted executables", () => {
  assert.equal(parseSafe("rm -rf /"), null);
  assert.equal(parseSafe("curl http://evil"), null);
});

test("parseSafe: rejects shell metacharacters outright", () => {
  for (const cmd of ["npm test && rm -rf /", "npm test; echo hi", "node -e $(whoami)", "npm test | sh", "npm test > /etc/x"]) {
    assert.equal(parseSafe(cmd), null, cmd);
  }
});

test("safeExec: runs an allowlisted command (no shell) and captures output", async () => {
  const r = await safeExec("node --version", { cwd: os.tmpdir() });
  assert.equal(r.ok, true);
  assert.match(r.stdout, /v\d+\./);
});

test("safeExec: a rejected command never runs and never throws", async () => {
  const r = await safeExec("rm -rf /", { cwd: os.tmpdir() });
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /rejected/);
});

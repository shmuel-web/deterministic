import { test } from "node:test";
import assert from "node:assert/strict";
import { runRules } from "../../src/core/orchestrator.js";
import { createExec } from "../../src/core/exec.js";
import type { Rule, RuleExec } from "../../src/core/rule.js";

/**
 * #70 — the execution capability is injected into `ctx.exec` only for rules that
 * declare `needsExec`, and only when the caller provides it (the opt-in). A rule
 * without `needsExec` never sees it; a rule that wants it but isn't given one
 * degrades to a clean pass rather than crashing.
 */

// A probe rule that reports whether it received `ctx.exec`, and what a run returns.
function probe(opts: { needsExec?: boolean } = {}): { rule: Rule; saw: { exec: boolean } } {
  const saw = { exec: false };
  const rule: Rule = {
    id: "static/exec-probe",
    target: "repo",
    type: "static",
    needsExec: opts.needsExec,
    run({ exec }) {
      saw.exec = Boolean(exec);
      return { issues: [] };
    },
  };
  return { rule, saw };
}

const noopExec: RuleExec = () => Promise.resolve({ ok: false, stdout: "", code: null });

test("injects ctx.exec only for needsExec rules", async () => {
  const wants = probe({ needsExec: true });
  const indifferent = probe({ needsExec: false });
  await runRules([wants.rule, indifferent.rule], { target: "repo", path: "." }, { exec: noopExec });
  assert.equal(wants.saw.exec, true, "needsExec rule should receive ctx.exec");
  assert.equal(indifferent.saw.exec, false, "a rule that doesn't declare needsExec must not see ctx.exec");
});

test("no exec provided (opted out) → needsExec rule sees no capability", async () => {
  const wants = probe({ needsExec: true });
  await runRules([wants.rule], { target: "repo", path: "." }, {}); // no exec in options
  assert.equal(wants.saw.exec, false, "absence of the capability is the off-mode guard");
});

test("a needsExec rule that runs a command scores from real output", async () => {
  const rule: Rule = {
    id: "static/node-version",
    target: "repo",
    type: "static",
    needsExec: true,
    async run({ exec }) {
      if (!exec) return { issues: [] };
      const res = await exec("node --version");
      // Emit an issue iff the command actually ran and produced a version — proves
      // the rule can run a command, read output, and decide from it (acceptance).
      return res.ok && /v\d+\./.test(res.stdout)
        ? { issues: [{ problem: `node ${res.stdout.trim()}`, fix: "n/a", severity: "info" }] }
        : { issues: [] };
    },
  };
  const issues = await runRules([rule], { target: "repo", path: "." }, { exec: createExec({ cwd: process.cwd() }) });
  assert.equal(issues.length, 1);
  assert.match(issues[0]!.problem, /node v\d+\./);
});

test("a rejected command comes back neutral (never throws, no fabricated issue)", async () => {
  const rule: Rule = {
    id: "static/blocked-cmd",
    target: "repo",
    type: "static",
    needsExec: true,
    async run({ exec }) {
      const res = await exec!("rm -rf /"); // not allowlisted → rejected
      assert.equal(res.ok, false);
      return { issues: [] };
    },
  };
  const issues = await runRules([rule], { target: "repo", path: "." }, { exec: createExec({ cwd: process.cwd() }) });
  assert.deepEqual(issues, []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { tsIgnoreCount } from "../../src/rules/static/ts-ignore-count.js";

const run = (path: string, content: string) => tsIgnoreCount.run({ target: "file", path, content });

test("ts-ignore-count: inert on non-TS files", async () => {
  const { issues } = await run("index.js", "// @ts-ignore\nconst x: any = 1;");
  assert.equal(issues.length, 0);
});

test("ts-ignore-count: clean TS file → no issues", async () => {
  const { issues } = await run("index.ts", "const x = 1;\n");
  assert.equal(issues.length, 0);
});

test("ts-ignore-count: one @ts-ignore → one minor issue", async () => {
  const { issues } = await run("index.ts", "// @ts-ignore\nconst x = bad();");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "minor");
});

test("ts-ignore-count: one @ts-expect-error → one minor issue", async () => {
  const { issues } = await run("index.ts", "// @ts-expect-error\nconst x = bad();");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "minor");
});

test("ts-ignore-count: two suppressions → two issues (penalty accumulates)", async () => {
  const content = "// @ts-ignore\nconst a = 1;\n// @ts-expect-error\nconst b = 2;";
  const { issues } = await run("util.ts", content);
  assert.equal(issues.length, 2);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { importCount } from "../../src/rules/static/import-count.js";

const run = (content: string) => importCount.run({ target: "file", path: "index.ts", content });

const makeImports = (n: number) => Array.from({ length: n }, (_, i) => `import { x${i} } from "./m${i}.js";`).join("\n");

test("import-count: 14 imports → clean", async () => {
  const { issues } = await run(makeImports(14));
  assert.equal(issues.length, 0);
});

test("import-count: 15 imports → clean (at soft cap)", async () => {
  const { issues } = await run(makeImports(15));
  assert.equal(issues.length, 0);
});

test("import-count: 20 imports → one info issue", async () => {
  const { issues } = await run(makeImports(20));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "info");
  assert.match(issues[0]!.problem, /20/);
});

test("import-count: 30 imports → minor issue", async () => {
  const { issues } = await run(makeImports(30));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "minor");
});

test("import-count: 40 imports → major issue", async () => {
  const { issues } = await run(makeImports(40));
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "major");
});

test("import-count: non-TS file with 20 imports still counts (language-agnostic)", async () => {
  const { issues } = await importCount.run({ target: "file", path: "index.js", content: makeImports(20) });
  assert.equal(issues.length, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { stripAnnotation } from "../../src/core/annotation.js";

test("leaves a file untouched when it has no leading annotation block", () => {
  const src = 'const START = "@deterministic";\nconst END = "@deterministic:end";\n';
  // Regression: source that mentions the sentinel must NOT be treated as a block.
  assert.equal(stripAnnotation(src), src);
});

test("strips only the leading block, preserving sentinel-bearing source below", () => {
  const annotated =
    "// @deterministic score: 90/100  scored: 2026-01-01T00:00:00Z\n" +
    "//   static/file-length  100/100  w1  ok\n" +
    "// @deterministic:end\n" +
    'const START = "@deterministic";\n' +
    'const END = "@deterministic:end";\n';
  const expected = 'const START = "@deterministic";\nconst END = "@deterministic:end";\n';
  assert.equal(stripAnnotation(annotated), expected);
});

test("preserves a shebang and strips the block after it", () => {
  const annotated = "#!/usr/bin/env node\n// @deterministic score: 50/100  scored: t\n// @deterministic:end\nconsole.log(1);\n";
  assert.equal(stripAnnotation(annotated), "#!/usr/bin/env node\nconsole.log(1);\n");
});

test("round-trips: no leading block → unchanged", () => {
  const src = "export const x = 1;\n";
  assert.equal(stripAnnotation(src), src);
});

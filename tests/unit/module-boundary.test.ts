import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ADR-0001 enforced as a build-failing check: the code-scoring side
 * (`src/commands`, `src/rules`) and the ticket-scoring side (`src/ticket`) MUST
 * NOT import each other in either direction. Both may depend only on `src/core`.
 * The single place they meet is the thin umbrella `src/cli.ts`. This is what lets
 * us later split `ticket/` + `core/` into their own package — see ADR-0001.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../../src");

async function tsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await tsFiles(full)));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const IMPORT = /\bfrom\s+["']([^"']+)["']/g;

/** Resolve every import in `file` to an absolute path under src (or null if external). */
async function importedPaths(file: string): Promise<string[]> {
  const src = await fs.readFile(file, "utf8");
  const targets: string[] = [];
  for (const m of src.matchAll(IMPORT)) {
    const spec = m[1]!;
    if (!spec.startsWith(".")) continue; // external package
    targets.push(path.resolve(path.dirname(file), spec));
  }
  return targets;
}

const within = (abs: string, sub: string): boolean =>
  abs === path.join(srcRoot, sub) || abs.startsWith(path.join(srcRoot, sub) + path.sep);

test("ticket module never imports the code-scoring side (ADR-0001)", async () => {
  for (const file of await tsFiles(path.join(srcRoot, "ticket"))) {
    for (const imp of await importedPaths(file)) {
      assert.ok(
        !within(imp, "commands") && !within(imp, "rules"),
        `${path.relative(srcRoot, file)} imports the code side (${path.relative(srcRoot, imp)}) — forbidden by ADR-0001`,
      );
    }
  }
});

test("code-scoring side never imports the ticket module (ADR-0001)", async () => {
  for (const dir of ["commands", "rules"]) {
    for (const file of await tsFiles(path.join(srcRoot, dir))) {
      for (const imp of await importedPaths(file)) {
        assert.ok(
          !within(imp, "ticket"),
          `${path.relative(srcRoot, file)} imports the ticket module (${path.relative(srcRoot, imp)}) — forbidden by ADR-0001`,
        );
      }
    }
  }
});

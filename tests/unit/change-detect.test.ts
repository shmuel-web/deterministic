import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { selectDetector, type ScanMarker } from "../../src/core/change-detect.js";
import { walkSourceFiles } from "../../src/core/scope.js";

/** A throwaway repo dir with the given files written into it. */
async function tmpRepo(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "det-cd-"));
  for (const [rel, c] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), c, "utf8");
  }
  return dir;
}

const withEnv = async (mode: string | undefined, fn: () => Promise<void>) => {
  const prev = process.env.DETERMINISTIC_CHANGE_DETECT;
  if (mode === undefined) delete process.env.DETERMINISTIC_CHANGE_DETECT;
  else process.env.DETERMINISTIC_CHANGE_DETECT = mode;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.DETERMINISTIC_CHANGE_DETECT;
    else process.env.DETERMINISTIC_CHANGE_DETECT = prev;
  }
};

test("scope.walkSourceFiles: lists scorable files, prunes excluded dirs", async () => {
  const dir = await tmpRepo({
    "a.ts": "export const a = 1;",
    "src/b.ts": "export const b = 2;",
    "node_modules/pkg/index.ts": "export const x = 3;", // excluded
    "dist/out.js": "module.exports = {};", // excluded
    "notes.txt": "hello", // no comment style → not scorable
  });
  const files = await walkSourceFiles(dir);
  assert.deepEqual(files, ["a.ts", "src/b.ts"]);
});

test("selectDetector: env forces the mode", async () => {
  await withEnv("mtime", () => {
    assert.equal(selectDetector(".").kind, "mtime");
    return Promise.resolve();
  });
  await withEnv("hash", () => {
    assert.equal(selectDetector(".").kind, "hash");
    return Promise.resolve();
  });
});

test("mtime: a foreign/null marker forces a full scan", async () => {
  const dir = await tmpRepo({ "a.ts": "1", "b.ts": "2" });
  await withEnv("mtime", async () => {
    const d = selectDetector(dir);
    assert.equal((await d.changedSince(null)).changed.sort().join(","), "a.ts,b.ts");
    const foreign: ScanMarker = { kind: "git", sha: "deadbeef" };
    assert.equal((await d.changedSince(foreign)).changed.length, 2);
  });
});

test("mtime: re-scores only files modified since the marker timestamp", async () => {
  const dir = await tmpRepo({ "old.ts": "1", "new.ts": "2" });
  await withEnv("mtime", async () => {
    const d = selectDetector(dir);
    const at = 1_000_000_000_000; // a fixed reference instant
    // old.ts mtime in the past, new.ts mtime in the future relative to `at`.
    await fs.utimes(path.join(dir, "old.ts"), new Date(at - 10_000), new Date(at - 10_000));
    await fs.utimes(path.join(dir, "new.ts"), new Date(at + 10_000), new Date(at + 10_000));
    const { changed, deleted } = await d.changedSince({ kind: "mtime", at });
    assert.deepEqual(changed, ["new.ts"]);
    assert.deepEqual(deleted, []); // mtime mode does not report deletions
  });
});

test("hash: detects content change, ignores touch-only, reports deletions", async () => {
  const dir = await tmpRepo({ "keep.ts": "1", "edit.ts": "2", "gone.ts": "3" });
  await withEnv("hash", async () => {
    const d = selectDetector(dir);
    const marker = await d.marker();
    assert.equal(marker.kind, "hash");

    // touch keep.ts (mtime moves) but DON'T change its content
    await fs.utimes(path.join(dir, "keep.ts"), new Date(), new Date());
    // genuinely change edit.ts
    await fs.writeFile(path.join(dir, "edit.ts"), "2 + 2", "utf8");
    // delete gone.ts
    await fs.rm(path.join(dir, "gone.ts"));

    const { changed, deleted } = await d.changedSince(marker);
    assert.deepEqual(changed, ["edit.ts"], "only the content change counts; a touch does not");
    assert.deepEqual(deleted, ["gone.ts"], "hash mode sees deletions");
  });
});

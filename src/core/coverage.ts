import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Severity } from "./rule.js";

/** Coverage report parsing, freshness checks, and severity bands. */

export const REPORT = path.join("coverage", "coverage-summary.json");
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|kt|rs)$/;

/** Banded severity by line-coverage %. 100 = clean; lower bands bite harder. */
export function band(pct: number): Severity | null {
  if (pct >= 100) return null;
  if (pct >= 90) return "info";
  if (pct >= 80) return "minor";
  if (pct >= 70) return "major";
  return "critical";
}

/** Read overall line-coverage % from the report, or null if absent/unreadable. */
export async function readCoveragePct(root: string): Promise<number | null> {
  try {
    const s = JSON.parse(await fs.readFile(path.join(root, REPORT), "utf8")) as {
      total?: { lines?: { pct?: number } };
    };
    const v = s.total?.lines?.pct;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

async function gitCodeFiles(root: string): Promise<string[]> {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\n")
      .filter((f) => CODE.test(f));
  } catch {
    return [];
  }
}

/**
 * Is the coverage report STALE — i.e., has any tracked code file been modified
 * since the report was generated? (mtime-based.) Coverage is a snapshot of a
 * past test run; if the code moved since, the number is no longer trustworthy.
 * No report → stale (must generate). Non-git / no code files → treated as fresh.
 * `listFiles` is injectable for testing.
 */
export async function isReportStale(
  root: string,
  listFiles: (root: string) => Promise<string[]> = gitCodeFiles,
): Promise<boolean> {
  let reportMtime: number;
  try {
    reportMtime = (await fs.stat(path.join(root, REPORT))).mtimeMs;
  } catch {
    return true; // no report → needs generating
  }
  for (const f of await listFiles(root)) {
    try {
      if ((await fs.stat(path.join(root, f))).mtimeMs > reportMtime) return true;
    } catch {
      /* deleted between ls-files and stat — ignore */
    }
  }
  return false;
}

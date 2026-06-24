import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { inGitRepo, headSha, listSourceFiles as gitListSourceFiles, changedSince as gitChangedSince } from "./git.js";
import { walkSourceFiles } from "./scope.js";

/**
 * Change detection, layered so git is no longer a hard dependency (#65).
 *
 *   git   → commit-scoped diff + working tree; sees deletions; the default when
 *           a repo is present (richest, zero extra I/O).
 *   mtime → zero-dep fallback for non-git folders: re-score files whose mtime is
 *           newer than the last scan. Cheap, but can't see deletions.
 *   hash  → correctness mode: content hashes per file, so a touch-without-change
 *           is NOT re-scored and deletions ARE detected. More I/O.
 *
 * All three implement one `ChangeDetector` interface, so `init` / `score repo`
 * are detector-agnostic. The chosen detector's `marker()` is stored in the index;
 * a marker of a different kind (env switched between runs) safely forces a full
 * rescan rather than a wrong diff.
 */

/** A stored snapshot of repo state, by detector kind. Persisted in the index. */
export type ScanMarker =
  | { kind: "git"; sha: string }
  | { kind: "mtime"; at: number }
  | { kind: "hash"; hashes: Record<string, string> };

export interface ChangeSet {
  changed: string[];
  deleted: string[];
}

export interface ChangeDetector {
  readonly kind: ScanMarker["kind"];
  /** All scorable source files in the repo, now. */
  listSourceFiles(): Promise<string[]>;
  /** A marker capturing the current state, to store for the next run. */
  marker(): Promise<ScanMarker>;
  /** Files changed/deleted since `prev`. A null or foreign-kind marker → full scan. */
  changedSince(prev: ScanMarker | null): Promise<ChangeSet>;
}

/** Git — wraps the existing git-backed helpers; the marker is the HEAD sha. */
const gitDetector: ChangeDetector = {
  kind: "git",
  listSourceFiles: () => Promise.resolve(gitListSourceFiles()),
  marker: () => Promise.resolve({ kind: "git", sha: headSha() }),
  changedSince: (prev) => Promise.resolve(gitChangedSince(prev?.kind === "git" ? prev.sha : null)),
};

/** mtime — re-score files modified since the last scan timestamp (zero-dep). */
function mtimeDetector(root: string): ChangeDetector {
  return {
    kind: "mtime",
    listSourceFiles: () => walkSourceFiles(root),
    marker: () => Promise.resolve({ kind: "mtime", at: Date.now() }),
    async changedSince(prev) {
      const files = await walkSourceFiles(root);
      if (prev?.kind !== "mtime") return { changed: files, deleted: [] };
      const changed: string[] = [];
      for (const f of files) {
        try {
          if ((await fs.stat(path.join(root, f))).mtimeMs > prev.at) changed.push(f);
        } catch {
          /* race: file vanished between walk and stat — ignore */
        }
      }
      // mtime alone cannot distinguish a deletion from a never-existed file; the
      // hash detector is the mode that reports deletions. Documented limitation.
      return { changed, deleted: [] };
    },
  };
}

async function hashFile(abs: string): Promise<string | null> {
  try {
    return createHash("sha256").update(await fs.readFile(abs)).digest("hex");
  } catch {
    return null;
  }
}

/** hash — content hashes per file: exact change detection, deletions included. */
function hashDetector(root: string): ChangeDetector {
  async function snapshot(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const f of await walkSourceFiles(root)) {
      const digest = await hashFile(path.join(root, f));
      if (digest) out[f] = digest;
    }
    return out;
  }
  return {
    kind: "hash",
    listSourceFiles: () => walkSourceFiles(root),
    marker: async () => ({ kind: "hash", hashes: await snapshot() }),
    async changedSince(prev) {
      const now = await snapshot();
      if (prev?.kind !== "hash") return { changed: Object.keys(now), deleted: [] };
      const changed = Object.keys(now).filter((f) => now[f] !== prev.hashes[f]);
      const deleted = Object.keys(prev.hashes).filter((f) => !(f in now));
      return { changed, deleted };
    },
  };
}

/**
 * Pick the detector for this environment. `DETERMINISTIC_CHANGE_DETECT` forces a
 * mode (`git` | `mtime` | `hash`); otherwise auto: git when a repo is present
 * (richest), else the mtime fallback. init and score repo MUST use the same
 * selection — it's deterministic given the env, and a kind mismatch self-heals
 * into a full rescan.
 */
export function selectDetector(root = "."): ChangeDetector {
  const mode = (process.env.DETERMINISTIC_CHANGE_DETECT ?? "auto").toLowerCase();
  if (mode === "git") return gitDetector;
  if (mode === "mtime") return mtimeDetector(root);
  if (mode === "hash") return hashDetector(root);
  return inGitRepo() ? gitDetector : mtimeDetector(root);
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { listSourceFiles } from "./git.js";

/**
 * Lazy-cached import graph for the repo. Computes once on first access,
 * then serves from cache. Tracks both fan-out (outgoing imports) and
 * fan-in (incoming imports) per file.
 */

export interface ImportGraph {
  /** file → number of files that import it (fan-in / incoming) */
  fanIn: Map<string, number>;
  /** file → number of files it imports (fan-out / outgoing) */
  fanOut: Map<string, number>;
}

let cached: ImportGraph | null = null;

/**
 * Extract import paths from file content. Handles:
 * - `import ... from "..."` (TS/JS)
 * - `import "..."` (side-effect)
 * - `import(...)` (dynamic)
 * Relative paths only (we care about internal coupling).
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  // Static imports: import ... from "./foo" or import "./foo"
  const staticRe = /^\s*import\s+(?:.*?from\s+)?["'](\.[^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(content)) !== null) {
    if (m[1]) imports.push(m[1]);
  }
  // Dynamic imports: import("./foo")
  const dynRe = /import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
  while ((m = dynRe.exec(content)) !== null) {
    if (m[1]) imports.push(m[1]);
  }
  return imports;
}

/** Resolve a relative import to a normalized file path (without extension). */
function resolveImport(fromFile: string, importPath: string): string {
  const dir = path.dirname(fromFile);
  let resolved = path.join(dir, importPath);
  // Strip common extensions so matching is extension-agnostic
  resolved = resolved.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
  return resolved;
}

/** Check if a resolved path matches any known source file (with extension). */
function matchesSourceFile(resolved: string, sourceFiles: string[]): string | null {
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  for (const ext of exts) {
    const candidate = resolved + ext;
    if (sourceFiles.includes(candidate)) return candidate;
  }
  // Also try index files
  for (const ext of exts) {
    const candidate = path.join(resolved, `index${ext}`);
    if (sourceFiles.includes(candidate)) return candidate;
  }
  return null;
}

/**
 * Build (or return cached) import graph for the repo.
 * Scans all source files, parses imports, and computes fan-in/fan-out.
 */
export async function getImportGraph(): Promise<ImportGraph> {
  if (cached) return cached;

  const sourceFiles = listSourceFiles();
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();

  // Initialize counts
  for (const f of sourceFiles) {
    fanIn.set(f, 0);
    fanOut.set(f, 0);
  }

  // Parse imports for each file
  const contents = await Promise.all(
    sourceFiles.map(async (f) => {
      try {
        return { file: f, content: await fs.readFile(f, "utf8") };
      } catch {
        return { file: f, content: "" };
      }
    }),
  );

  for (const { file, content } of contents) {
    const imports = extractImports(content);
    let outCount = 0;

    for (const imp of imports) {
      const resolved = resolveImport(file, imp);
      const target = matchesSourceFile(resolved, sourceFiles);
      if (target && target !== file) {
        outCount++;
        fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
      }
    }

    fanOut.set(file, outCount);
  }

  cached = { fanIn, fanOut };
  return cached;
}

/** Invalidate cache (for testing or after repo changes). */
export function resetImportGraph(): void {
  cached = null;
}

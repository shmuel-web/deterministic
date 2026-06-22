// @deterministic score: 100/100 — no issues
// @deterministic:end
import path from "node:path";

/** How a file expresses comments — line-prefixed or block-delimited. */
export type CommentStyle =
  | { kind: "line"; prefix: string }
  | { kind: "block"; open: string; close: string };

const LINE_SLASH = { kind: "line", prefix: "//" } as const;
const LINE_HASH = { kind: "line", prefix: "#" } as const;
const LINE_DASH = { kind: "line", prefix: "--" } as const;
const BLOCK_C = { kind: "block", open: "/*", close: "*/" } as const;
const BLOCK_HTML = { kind: "block", open: "<!--", close: "-->" } as const;

const BY_EXT: Record<string, CommentStyle> = {
  ".ts": LINE_SLASH, ".tsx": LINE_SLASH, ".js": LINE_SLASH, ".jsx": LINE_SLASH,
  ".mjs": LINE_SLASH, ".cjs": LINE_SLASH, ".java": LINE_SLASH, ".c": LINE_SLASH,
  ".h": LINE_SLASH, ".cpp": LINE_SLASH, ".cc": LINE_SLASH, ".go": LINE_SLASH,
  ".rs": LINE_SLASH, ".swift": LINE_SLASH, ".kt": LINE_SLASH, ".scala": LINE_SLASH,
  ".php": LINE_SLASH, ".dart": LINE_SLASH,
  ".py": LINE_HASH, ".rb": LINE_HASH, ".sh": LINE_HASH, ".bash": LINE_HASH,
  ".zsh": LINE_HASH, ".yml": LINE_HASH, ".yaml": LINE_HASH, ".toml": LINE_HASH,
  ".css": BLOCK_C, ".scss": BLOCK_C, ".less": BLOCK_C,
  ".html": BLOCK_HTML, ".htm": BLOCK_HTML, ".xml": BLOCK_HTML, ".vue": BLOCK_HTML,
  ".svelte": BLOCK_HTML, ".md": BLOCK_HTML, ".markdown": BLOCK_HTML,
  ".sql": LINE_DASH,
};

/**
 * Comment style for a file, or `null` when the format has no comments (e.g.
 * JSON) — the caller then falls back to a `<name>.deterministic.md` sidecar.
 */
export function getCommentStyle(filePath: string): CommentStyle | null {
  return BY_EXT[path.extname(filePath).toLowerCase()] ?? null;
}

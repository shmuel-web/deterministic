// @deterministic score: 94/100  scored: 2026-06-21T08:18:55.439Z
//   static/file-length  100/100  w1  96 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (stripAnnotation) is 13 lines — within the 50-line cap.
//   llm/intent-legibility  85/100  w3  The file's purpose as a deterministic annotation system for AI agents is clear from naming, structure, and comments, though the specific use case could be made more explicit in documentation.
// @deterministic:end
import { promises as fs } from "node:fs";
import type { RuleTarget } from "./rule.js";
import type { IdentifiedSignal } from "./arbitrator.js";
import { getCommentStyle, type CommentStyle } from "./comment-style.js";

/**
 * Annotations live INSIDE the scored file as native-syntax comments (Principle
 * IV; research.md D2) — a feedback channel to the next AI agent. We maintain an
 * idempotent block delimited by the `@deterministic` sentinel.
 */
export interface Annotation {
  target: RuleTarget;
  path: string;
  score: number;
  signals: IdentifiedSignal[];
  scoredAt: string; // ISO 8601, supplied by the caller
}

const START = "@deterministic";
const END = "@deterministic:end";

/** Body lines of the annotation, before comment-syntax wrapping. */
function bodyLines(a: Annotation): string[] {
  const lines = [`${START} score: ${a.score}/100  scored: ${a.scoredAt}`];
  for (const s of a.signals) {
    lines.push(`  ${s.ruleId}  ${s.score}/100  w${s.weight}  ${s.reasoning}`);
  }
  // Surface a "next agent" hint only when something genuinely needs attention,
  // so the hint stays actionable rather than echoing praise.
  const worst = [...a.signals].sort((x, y) => x.score - y.score)[0];
  if (worst && worst.score < 70) lines.push(`  > next: ${worst.reasoning}`);
  lines.push(END);
  return lines;
}

/** Render the annotation as a comment block in the file's comment style. */
export function renderBlock(a: Annotation, style: CommentStyle): string {
  const body = bodyLines(a);
  if (style.kind === "line") {
    return body.map((l) => `${style.prefix} ${l}`).join("\n");
  }
  return [`${style.open} ${body[0]}`, ...body.slice(1, -1), `${body[body.length - 1]} ${style.close}`].join("\n");
}

// Our block's first line always starts (after optional indent) with a comment
// marker immediately followed by the sentinel — e.g. `// @deterministic ...`,
// `# @deterministic ...`, `/* @deterministic ...`, `<!-- @deterministic ...`.
// Source code that merely mentions "@deterministic" (this module, docs, tests)
// never matches, so it is never corrupted.
const BLOCK_START = new RegExp(`^\\s*(//|#|--|/\\*|<!--)\\s*${START}\\b`);

/**
 * Remove our annotation block (idempotency + strip-before-score).
 * We only ever WRITE the block at the top of the file (after an optional
 * shebang), so we only ever strip it there.
 */
export function stripAnnotation(content: string): string {
  const lines = content.split("\n");
  const start = lines[0]?.startsWith("#!") ? 1 : 0; // skip a leading shebang
  if (!lines[start] || !BLOCK_START.test(lines[start]!)) {
    return content; // no annotation block at the top — nothing of ours to strip
  }
  let end = start;
  while (end < lines.length && !lines[end]!.includes(END)) end++;
  if (end >= lines.length) return content; // unterminated; leave content untouched
  if (lines[end + 1] === "") end += 1; // drop one trailing blank line we inserted
  lines.splice(start, end - start + 1);
  return lines.join("\n");
}

/** Insert the block at the top, preserving a leading shebang if present. */
function insertAtTop(content: string, block: string): string {
  if (content.startsWith("#!")) {
    const nl = content.indexOf("\n");
    const shebang = nl === -1 ? content : content.slice(0, nl + 1);
    return `${shebang}${block}\n${content.slice(shebang.length)}`;
  }
  return `${block}\n${content}`;
}

/**
 * Write the annotation into the file (idempotent). Comment-less formats fall
 * back to a `<name>.deterministic.md` sidecar.
 */
export async function writeAnnotation(a: Annotation): Promise<void> {
  const style = getCommentStyle(a.path);
  if (!style) {
    const block = renderBlock(a, { kind: "block", open: "<!--", close: "-->" });
    await fs.writeFile(`${a.path}.deterministic.md`, block + "\n", "utf8");
    return;
  }
  const original = await fs.readFile(a.path, "utf8");
  const stripped = stripAnnotation(original);
  await fs.writeFile(a.path, insertAtTop(stripped, renderBlock(a, style)), "utf8");
}

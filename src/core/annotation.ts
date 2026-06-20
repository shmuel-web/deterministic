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

/** Remove any existing `@deterministic` block from content (idempotency + strip-before-score). */
export function stripAnnotation(content: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.includes(START) && !l.includes(END));
  if (start === -1) return content;
  let end = lines.findIndex((l, i) => i >= start && l.includes(END));
  if (end === -1) end = start;
  // also drop a single trailing blank line left behind
  if (lines[end + 1] === "") end += 1;
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

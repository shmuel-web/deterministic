import { promises as fs } from "node:fs";
import type { RuleTarget, Severity } from "./rule.js";
import type { IdentifiedIssue } from "./score.js";
import { getCommentStyle, type CommentStyle } from "./comment-style.js";

/**
 * Annotations live INSIDE the scored file as native-syntax comments (Principle
 * IV; research.md D2) — a feedback channel to the next AI agent. We maintain an
 * idempotent block delimited by the `@deterministic` sentinel.
 *
 * The block IS the issue list: the score, then every problem with its fix. A
 * clean file lists nothing. There is no praise and no timestamp (timestamps only
 * churn diffs) — just what's wrong and how to fix it.
 */
export interface Annotation {
  target: RuleTarget;
  path: string;
  score: number;
  issues: IdentifiedIssue[];
}

const START = "@deterministic";
const END = "@deterministic:end";

const SEV_ORDER: Record<Severity, number> = { critical: 0, major: 1, minor: 2, info: 3 };

/** Body lines of the annotation, before comment-syntax wrapping. */
function bodyLines(a: Annotation): string[] {
  if (a.issues.length === 0) {
    return [`${START} score: ${a.score}/100 — no issues`, END];
  }

  const lines = [`${START} score: ${a.score}/100`];

  // Collapse identical findings (e.g. the same rule firing on many `any`s) into
  // one line with a count, so a verbose rule doesn't flood the block.
  const collapsed = new Map<string, { issue: IdentifiedIssue; count: number }>();
  for (const i of a.issues) {
    const key = `${i.ruleId}|${i.severity}|${i.problem}|${i.fix}`;
    const seen = collapsed.get(key);
    if (seen) seen.count++;
    else collapsed.set(key, { issue: i, count: 1 });
  }

  // Worst first, so the most important problem is the first thing read.
  const ordered = [...collapsed.values()].sort(
    (x, y) => SEV_ORDER[x.issue.severity] - SEV_ORDER[y.issue.severity],
  );
  for (const { issue, count } of ordered) {
    const tag = count > 1 ? `${issue.severity} ×${count}` : issue.severity;
    lines.push(`  [${tag}] ${issue.ruleId}  ${issue.problem} → ${issue.fix}`);
  }

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

  // Clean files carry NO block — absence means 100 (the score lives in the index).
  // The annotation appears only when it has something worth saying.
  if (a.issues.length === 0) {
    if (!style) {
      await fs.rm(`${a.path}.deterministic.md`, { force: true });
      return;
    }
    const original = await fs.readFile(a.path, "utf8");
    const stripped = stripAnnotation(original);
    if (stripped !== original) await fs.writeFile(a.path, stripped, "utf8"); // remove a now-stale block
    return;
  }

  if (!style) {
    const block = renderBlock(a, { kind: "block", open: "<!--", close: "-->" });
    await fs.writeFile(`${a.path}.deterministic.md`, block + "\n", "utf8");
    return;
  }
  const original = await fs.readFile(a.path, "utf8");
  const stripped = stripAnnotation(original);
  await fs.writeFile(a.path, insertAtTop(stripped, renderBlock(a, style)), "utf8");
}

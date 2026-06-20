import type { Rule } from "../../core/rule.js";

const SOFT_CAP = 50; // lines per function body

/**
 * Static: long functions are hard to test and reason about (finer-grained than
 * file-length). Heuristic, brace-based detection — good enough for C-family /
 * JS / TS without a full AST. Inert on files with no brace functions.
 */

interface Fn {
  name: string;
  lines: number;
}

/** Find brace-delimited function bodies and their line counts. */
function findFunctions(content: string): Fn[] {
  const lines = content.split("\n");
  const fnStart = /\b(function\b|=>\s*\{|\b(constructor|get|set)\b|[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/;
  const fns: Fn[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.includes("{") || !fnStart.test(line)) continue;

    // Walk braces from this line to find the matching close.
    let depth = 0;
    let started = false;
    let j = i;
    for (; j < lines.length; j++) {
      for (const ch of lines[j] ?? "") {
        if (ch === "{") { depth++; started = true; }
        else if (ch === "}") depth--;
      }
      if (started && depth <= 0) break;
    }
    const span = j - i + 1;
    if (span > 1) {
      const name = line.match(/([A-Za-z0-9_]+)\s*\(/)?.[1] ?? "(anonymous)";
      fns.push({ name, lines: span });
      i = j; // skip past this function body
    }
  }
  return fns;
}

export const functionLength: Rule = {
  id: "static/function-length",
  target: "file",
  type: "static",
  description: `Penalizes functions longer than ~${SOFT_CAP} lines.`,
  run({ content }) {
    const fns = findFunctions(content ?? "");
    if (fns.length === 0) {
      return { score: 100, weight: 1, reasoning: "No brace-delimited functions detected — rule inert." };
    }
    const worst = fns.reduce((a, b) => (b.lines > a.lines ? b : a));
    const over = Math.max(0, worst.lines - SOFT_CAP);
    return {
      score: Math.max(0, Math.round(100 - over * 1.5)),
      weight: 1,
      reasoning:
        over === 0
          ? `Longest function (${worst.name}) is ${worst.lines} lines — within the ${SOFT_CAP}-line cap.`
          : `Function ${worst.name} is ${worst.lines} lines — ${over} over the ${SOFT_CAP}-line cap; consider extracting.`,
    };
  },
};

import type { Rule, RuleIssue } from "../../core/rule.js";

const SOFT_CAP = 15;
const HARD_CAP = 30;

/**
 * Static: a file with too many functions is doing too many things.
 * Counts top-level + nested function declarations (function keyword,
 * arrow functions, methods, constructors). Heuristic brace-based
 * detection — good enough for TS/JS without a full AST.
 */

interface Fn {
  name: string;
}

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
      fns.push({ name });
      i = j; // skip past this function body
    }
  }
  return fns;
}

export const functionCount: Rule = {
  id: "static/function-count",
  target: "file",
  type: "static",
  description: `Flags files with more than ${SOFT_CAP} function declarations — a signal the file is doing too many things.`,
  run({ content }) {
    const count = findFunctions(content ?? "").length;
    if (count <= SOFT_CAP) return { issues: [] };

    const over = count - SOFT_CAP;
    const severity: RuleIssue["severity"] =
      count >= HARD_CAP ? "major" : over >= 10 ? "minor" : "info";

    return {
      issues: [
        {
          problem: `file has ${count} function declarations — too many responsibilities`,
          fix: "split into smaller, focused modules (one concern per file)",
          severity,
        },
      ],
    };
  },
};

import type { Rule, RuleIssue } from "../../core/rule.js";

const SOFT_CAP = 10;
const HARD_CAP = 20;

/**
 * Static: cyclomatic complexity counts independent paths through code.
 * Each branch/loop/case adds 1 to the base of 1. Reports the worst
 * function and the file average. Heuristic brace-based detection —
 * good enough for TS/JS without a full AST.
 */

interface Fn {
  name: string;
  complexity: number;
}

/** Count decision points within a block of code (lines[start..end]). */
function countDecisions(lines: string[], start: number, end: number): number {
  let count = 0;
  for (let i = start; i <= end; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    // if / else if / else if
    if (/\bif\s*\(/.test(trimmed)) count++;
    // else if (else alone doesn't add)
    if (/\belse\s+if\s*\(/.test(trimmed)) count++;

    // Loops
    if (/\b(for|while|do)\b/.test(trimmed) && /\{/.test(trimmed)) count++;

    // switch / case
    if (/\bswitch\s*\(/.test(trimmed)) count++;
    if (/^\s*case\s+/.test(trimmed)) count++;

    // Ternary operator (? :) — but not in type annotations or template literals
    if (/\?[^:]*:/.test(trimmed) && !/^\s*\/\//.test(trimmed)) {
      // Only count if there's a standalone ternary, not inside type defs
      if (/\?\s*[^?]/.test(trimmed) && !/<[^>]*\?/.test(trimmed)) count++;
    }

    // Logical operators (&&, ||) — each adds a branch path
    const andCount = (trimmed.match(/&&/g) ?? []).length;
    const orCount = (trimmed.match(/\|\|/g) ?? []).length;
    count += andCount + orCount;

    // catch blocks
    if (/\bcatch\s*\(/.test(trimmed)) count++;
  }
  return count;
}

function findFunctionsComplexity(content: string): Fn[] {
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
      // Cyclomatic complexity = 1 (base) + decision points
      const complexity = 1 + countDecisions(lines, i, j);
      fns.push({ name, complexity });
      i = j;
    }
  }
  return fns;
}

export const cyclomaticComplexity: Rule = {
  id: "static/cyclomatic-complexity",
  target: "file",
  type: "static",
  description: `Flags functions with cyclomatic complexity above ${SOFT_CAP}. Reports the worst offender and file average.`,
  run({ content }) {
    const fns = findFunctionsComplexity(content ?? "");
    if (fns.length === 0) return { issues: [] };

    const worst = fns.reduce((a, b) => b.complexity > a.complexity ? b : a);
    if (worst.complexity <= SOFT_CAP) return { issues: [] };

    const avg = Math.round(fns.reduce((s, f) => s + f.complexity, 0) / fns.length);
    const over = worst.complexity - SOFT_CAP;
    const severity: RuleIssue["severity"] =
      worst.complexity >= HARD_CAP ? "major" : over >= 5 ? "minor" : "info";

    return {
      issues: [
        {
          problem: `worst function \`${worst.name}\` has complexity ${worst.complexity} (file avg: ${avg}) — ${over} over the ${SOFT_CAP} cap`,
          fix: "extract branches into smaller functions, replace conditionals with polymorphism, or simplify logic",
          severity,
        },
      ],
    };
  },
};

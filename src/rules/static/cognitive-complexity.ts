import type { Rule, RuleIssue } from "../../core/rule.js";

const SOFT_CAP = 15;
const HARD_CAP = 25;

/**
 * Static: cognitive complexity (SonarSource model). Unlike cyclomatic,
 * it penalizes nesting — deeply nested code is harder to follow even
 * if branch count is low. Reports worst function + file average.
 * Heuristic brace-based detection for TS/JS without a full AST.
 */

interface Fn {
  name: string;
  complexity: number;
}

/**
 * Count cognitive complexity within a function body.
 *
 * Rules (simplified SonarSource model):
 * - Nesting structures (if, else if, for, while, switch, catch) add
 *   1 + current_nesting_level
 * - break/continue/return/throw inside nesting add nesting_level
 * - Logical operators (&&, ||) at nesting level add 1 each
 * - goto/labels add 1
 */
function computeCognitiveComplexity(lines: string[], start: number, end: number): number {
  let total = 0;
  // Track nesting depth via brace counting
  let depth = 0;

  for (let i = start; i <= end; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    // Count opening braces for nesting
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;

    // Before processing this line's constructs, compute nesting level
    const lineNesting = depth;

    // Nesting structures: 1 + nesting_level
    if (/\bif\s*\(/.test(trimmed)) {
      total += 1 + lineNesting;
    }
    if (/\belse\s+if\s*\(/.test(trimmed)) {
      total += 1 + lineNesting;
    }
    // Note: bare `else` does NOT add complexity in cognitive model

    if (/\b(for|while)\s*\(/.test(trimmed)) {
      total += 1 + lineNesting;
    }

    if (/\bswitch\s*\(/.test(trimmed)) {
      total += 1 + lineNesting;
    }
    // Each case/default adds 1
    if (/^\s*(case\s+|default\s*:)/.test(trimmed)) {
      total += 1;
    }

    if (/\bcatch\s*\(/.test(trimmed)) {
      total += 1 + lineNesting;
    }

    // Breaks in linear flow inside nesting: add nesting_level
    if (lineNesting > 0) {
      if (/\b(break|continue)\b/.test(trimmed)) total += lineNesting;
      if (/\breturn\b/.test(trimmed)) total += lineNesting;
      if (/\bthrow\b/.test(trimmed)) total += lineNesting;
    }

    // Logical operators: each adds 1
    const andCount = (trimmed.match(/&&/g) ?? []).length;
    const orCount = (trimmed.match(/\|\|/g) ?? []).length;
    total += andCount + orCount;

    // Labels (goto-like): add 1
    if (/^[A-Za-z_][A-Za-z0-9_]*:\s/.test(trimmed) && !/^\s*(case|default)\s/.test(trimmed)) {
      total += 1;
    }

    // Update depth for next line
    depth += opens - closes;
  }

  return total;
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
      const complexity = computeCognitiveComplexity(lines, i, j);
      fns.push({ name, complexity });
      i = j;
    }
  }
  return fns;
}

export const cognitiveComplexity: Rule = {
  id: "static/cognitive-complexity",
  target: "file",
  type: "static",
  description: `Flags functions with cognitive complexity above ${SOFT_CAP}. Reports worst offender + file average.`,
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
          problem: `worst function \`${worst.name}\` has cognitive complexity ${worst.complexity} (file avg: ${avg}) — ${over} over the ${SOFT_CAP} cap`,
          fix: "reduce nesting depth, extract inner branches into helper functions, or flatten conditional chains",
          severity,
        },
      ],
    };
  },
};

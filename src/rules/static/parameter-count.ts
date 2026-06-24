import type { Rule, RuleIssue } from "../../core/rule.js";

const SOFT_CAP = 7;

/**
 * Static: functions with too many parameters signal poor decomposition.
 * Reports the worst offender per file. Heuristic brace-based detection —
 * good enough for TS/JS without a full AST.
 */

interface Fn {
  name: string;
  params: number;
}

function findFunctionParams(content: string): Fn[] {
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
      // Count parameters: find the opening paren, then count commas at depth 0.
      const parenStart = line.indexOf("(");
      if (parenStart === -1) { i = j; continue; }

      let paramStr = "";
      let pDepth = 0;
      // Collect everything between the first ( and matching )
      for (let k = parenStart; k < line.length; k++) {
        const ch = line[k]!;
        if (ch === "(") pDepth++;
        else if (ch === ")") { pDepth--; if (pDepth === 0) break; }
        if (pDepth >= 1) paramStr += ch;
      }

      // Count params by commas at depth 0 (handles nested generics, tuples, etc.)
      let commas = 0;
      let gd = 0;
      for (const ch of paramStr) {
        if (ch === "<" || ch === "(" || ch === "[") gd++;
        else if (ch === ">" || ch === ")" || ch === "]") gd--;
        else if (ch === "," && gd === 0) commas++;
      }
      // At least one param if there's anything, else zero.
      const params = paramStr.trim().length > 0 ? commas + 1 : 0;
      const name = line.match(/([A-Za-z0-9_]+)\s*\(/)?.[1] ?? "(anonymous)";
      fns.push({ name, params });
      i = j;
    }
  }
  return fns;
}

export const parameterCount: Rule = {
  id: "static/parameter-count",
  target: "file",
  type: "static",
  description: `Flags functions with more than ${SOFT_CAP} parameters — poor decomposition.`,
  run({ content }) {
    const fns = findFunctionParams(content ?? "");
    if (fns.length === 0) return { issues: [] };

    // Report the worst offender only (per issue description).
    const worst = fns.reduce((a, b) => b.params > a.params ? b : a);
    if (worst.params <= SOFT_CAP) return { issues: [] };

    const over = worst.params - SOFT_CAP;
    const severity: RuleIssue["severity"] =
      worst.params >= 12 ? "major" : over >= 3 ? "minor" : "info";

    return {
      issues: [
        {
          problem: `function \`${worst.name}\` has ${worst.params} parameters — ${over} over the ${SOFT_CAP}-param cap`,
          fix: "group related parameters into an options object or split the function",
          severity,
        },
      ],
    };
  },
};

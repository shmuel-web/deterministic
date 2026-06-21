// @deterministic score: 96/100
//   [minor] llm/intent-legibility  The file lacks a high-level doc comment summarizing its purpose or intent for new readers, relying only on the file name and exported structures to communicate its role. → Add a module-level JSDoc comment at the top of the file describing that this module defines and exports the `functionLength` static analysis rule (e.g., docblock above `import type { Rule, RuleIssue } from "../../core/rule.js";`).
//   [info] static/function-length  function findFunctions is 51 lines — 1 over the 50-line cap → extract cohesive steps into smaller helper functions
// @deterministic:end
import type { Rule, RuleIssue } from "../../core/rule.js";

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
  description: `Flags functions longer than ~${SOFT_CAP} lines.`,
  run({ content }) {
    const issues: RuleIssue[] = [];
    for (const fn of findFunctions(content ?? "")) {
      const over = fn.lines - SOFT_CAP;
      if (over <= 0) continue;
      issues.push({
        problem: `function ${fn.name} is ${fn.lines} lines — ${over} over the ${SOFT_CAP}-line cap`,
        fix: "extract cohesive steps into smaller helper functions",
        severity: over > 100 ? "major" : over > 30 ? "minor" : "info",
      });
    }
    return { issues };
  },
};

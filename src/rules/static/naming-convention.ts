import type { Rule, RuleIssue } from "../../core/rule.js";

/**
 * Static: identifiers should follow conventional casing.
 * Functions/variables → camelCase, types/interfaces/classes/enums → PascalCase.
 * Heuristic regex-based detection — good enough for TS/JS without a full AST.
 * Inert on non-TS/JS files.
 */

const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL = /^[A-Z][a-zA-Z0-9]*$/;

interface Violation {
  name: string;
  expected: "camelCase" | "PascalCase";
  kind: string;
}

function checkCasing(name: string, expected: "camelCase" | "PascalCase"): boolean {
  const re = expected === "camelCase" ? CAMEL : PASCAL;
  return re.test(name);
}

function extractViolations(content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments, blank lines, strings
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    // --- Functions ---
    // export function foo(, function foo(
    const fnMatch = trimmed.match(/(?:export\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
    if (fnMatch?.[1] && !checkCasing(fnMatch[1], "camelCase")) {
      violations.push({ name: fnMatch[1], expected: "camelCase", kind: "function" });
    }

    // const foo = ( or const foo = async (
    const arrowMatch = trimmed.match(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(/);
    if (arrowMatch?.[1] && !checkCasing(arrowMatch[1], "camelCase")) {
      // Skip if it looks like a React component (PascalCase const = is fine)
      if (!PASCAL.test(arrowMatch[1])) {
        violations.push({ name: arrowMatch[1], expected: "camelCase", kind: "function" });
      }
    }

    // --- Types / Interfaces / Classes / Enums ---
    const typeMatch = trimmed.match(/(?:export\s+)?(?:type|interface|class|enum)\s+([A-Za-z0-9_]+)\b/);
    if (typeMatch?.[1] && !checkCasing(typeMatch[1], "PascalCase")) {
      const kind = trimmed.match(/(?:type|interface|class|enum)/)?.[0] ?? "type";
      violations.push({ name: typeMatch[1], expected: "PascalCase", kind });
    }
  }

  return violations;
}

export const namingConvention: Rule = {
  id: "static/naming-convention",
  target: "file",
  type: "static",
  description: "Checks that identifiers follow conventional casing (camelCase for functions/variables, PascalCase for types).",
  run({ path, content }) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) return { issues: [] };

    const violations = extractViolations(content ?? "");
    if (violations.length === 0) return { issues: [] };

    // One issue per violation so penalties accumulate.
    const issues: RuleIssue[] = violations.map((v) => ({
      problem: `${v.kind} \`${v.name}\` does not match ${v.expected} convention`,
      fix: `rename to ${v.expected === "camelCase" ? "camelCase" : "PascalCase"} (e.g. ${v.expected === "camelCase" ? v.name[0]!.toLowerCase() + v.name.slice(1) : v.name[0]!.toUpperCase() + v.name.slice(1)})`,
      severity: "info",
    }));

    return { issues };
  },
};

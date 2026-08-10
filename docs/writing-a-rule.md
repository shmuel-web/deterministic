# Writing a Rule

A rule finds problems. It never returns a score — the engine derives the score
from the issues a rule returns. This keeps praise structurally impossible and
every deduction auditable.

## The contract (frozen)

```ts
interface Rule {
  id: string;          // namespaced: "static/my-rule" or "llm/my-rule"
  target: "file" | "repo";
  type: "static" | "llm";
  description?: string;
  run(context: RuleContext): RuleResult | Promise<RuleResult>;
}

interface RuleResult {
  issues: RuleIssue[];  // empty = clean pass
}

interface RuleIssue {
  problem: string;   // what's wrong — with specifics (counts, names, line numbers)
  fix: string;       // the one concrete change that resolves it
  severity: "info" | "minor" | "major" | "critical";
}
```

Scoring: `score = max(0, 100 − Σ penalty)` where `info=−1, minor=−3, major=−9, critical=−27`.
One `critical` issue drops a file to 73. Passing rules contribute nothing.

**Conformance rules:**
1. `run()` returns `RuleResultSchema`-valid output — never throws to signal a problem.
2. `id` is unique and namespaced (`static/…` or `llm/…`).
3. Every issue has a non-empty `fix`. No fix = don't emit the issue.
4. A TS-specific rule guards on `path` inside `run()` and returns `{ issues: [] }` for non-TS files.
5. A clean target returns `{ issues: [] }` — never praise.

## Severity guide

| Severity | Penalty | When |
|----------|---------|------|
| `info` | −1 | Cosmetic / nit (a lazy variable name) |
| `minor` | −3 | Real but localized (an `any`, a slightly-long function) |
| `major` | −9 | Structural risk (600-line module, missing tests) |
| `critical` | −27 | Must-fix (hardcoded secret, broken contract) |

## Static rules

Static rules do pure text analysis — no LLM, no I/O. They run inline and are
fast. Use them for anything countable or regex-matchable.

**Pattern** — follow `missing-types.ts` exactly:

```ts
// src/rules/static/my-rule.ts
import type { Rule, RuleIssue } from "../../core/rule.js";

export const myRule: Rule = {
  id: "static/my-rule",
  target: "file",           // or "repo"
  type: "static",
  description: "One-sentence description of what this rule flags.",
  run({ path, content }) {
    // Guard for inert targets (e.g. non-TS files)
    if (!/\.tsx?$/.test(path)) return { issues: [] };

    // Count occurrences — one issue per occurrence so penalty accumulates
    const count = (content ?? "").match(/your-pattern/g)?.length ?? 0;

    const issue: RuleIssue = {
      problem: "one-sentence problem with specifics",
      fix: "one concrete change to fix it",
      severity: "minor",
    };
    return { issues: Array.from({ length: count }, () => ({ ...issue })) };
  },
};
```

**Per-occurrence vs single issue:**
- Use per-occurrence (`Array.from({ length: count }, ...)`) when each instance
  is independently fixable and penalty should accumulate (e.g. each `@ts-ignore`).
- Use a single banded issue when the symptom is a file-level property and
  severity encodes magnitude (e.g. total import count).

**Banded severity example** (`import-count.ts`):

```ts
const over = count - SOFT_CAP;
const severity = over >= 20 ? "major" : over >= 10 ? "minor" : "info";
```

Use `>=` at boundaries — `>` silently drops the boundary value one tier too weak.

## LLM rules

LLM rules make judgment calls that pure text analysis can't. They **must** use
the `llmRule()` factory — never hand-write an open-ended prompt.

```ts
// src/rules/llm/my-rule.ts
import { llmRule } from "../../core/llm-rule.js";

export const myRule = llmRule({
  id: "llm/my-rule",
  target: "file",
  description: "One-sentence description.",
  topic: "ONE concern — nothing else",
  lookFor: `- first concrete symptom to flag
- second concrete symptom to flag`,
  maxSeverity: "minor",   // judgment rules rarely warrant major/critical
});
```

`llmRule()` handles:
- Prompt construction with guardrails (scoped to `topic`, no praise, no vague advice)
- Zod-validated output + one retry on malformed JSON
- Severity clamping to `maxSeverity`
- Returning `{ issues: [] }` on any failure (Principle VI — never fabricate)

**`topic` must be ONE concern.** "Find issues in this file" is open-ended — a
cooperative model always finds something. Declare exactly what you're looking for.

## Register the rule

Add the rule to `deterministic.config.ts`:

```ts
// 1. Import
import { myRule } from "./src/rules/static/my-rule.js";   // note .js extension (ESM)

// 2. Add to the rules array under the correct target section
export const rules: Rule[] = [
  // file target
  myRule,
  // ...
];
```

The rule engine routes each rule to its declared `target` automatically.

## Test the rule

Create `tests/unit/my-rule.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { myRule } from "../../src/rules/static/my-rule.js";

const run = (content: string) =>
  myRule.run({ target: "file", path: "index.ts", content });

test("my-rule: clean file → no issues", async () => {
  const { issues } = await run("const x = 1;");
  assert.equal(issues.length, 0);
});

test("my-rule: one occurrence → one minor issue", async () => {
  const { issues } = await run("/* trigger */");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "minor");
});

test("my-rule: inert on non-TS files", async () => {
  const { issues } = await myRule.run({ target: "file", path: "index.js", content: "/* trigger */" });
  assert.equal(issues.length, 0);
});
```

Run all tests through Docker (never run locally):

```bash
docker build -t det-test . && docker run --rm det-test
```

Or against a single file:

```bash
docker run --rm -v "$(pwd)":/app -w /app node:22-alpine \
  sh -c "npm ci --silent && npx tsx --test tests/unit/my-rule.test.ts"
```

## Try it

Score a real file with your rule registered:

```bash
docker run --rm -v "$(pwd)":/app -w /app node:22-alpine \
  sh -c "npm ci --silent && npx tsx src/cli.ts score file <path>"
```

The output lists every fired rule and its issues. A clean rule pass contributes
nothing to the output — only issues appear.

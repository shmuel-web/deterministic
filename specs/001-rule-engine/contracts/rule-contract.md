# Contract: The Rule Interface v2 (FROZEN — Principle I)

This is the keystone every rule and lane builds against. Changing its **shape**
is a MAJOR governance event (constitution §Governance). Adding rules is not.

**v2 in one line:** a rule returns the *issues* it found — not a score. The
engine derives the score. This makes praise structurally impossible.

## TypeScript shape

```ts
export type RuleTarget = "file" | "repo" | "ticket";
export type RuleType = "static" | "llm";
export type Severity = "info" | "minor" | "major" | "critical";

export const PENALTY: Record<Severity, number> = { info: 1, minor: 3, major: 9, critical: 27 };

export interface RuleIssue {
  problem: string;   // what's wrong — with specifics (counts, line numbers, names)
  fix: string;       // the concrete change that resolves it
  severity: Severity;
}

export interface RuleResult {
  issues: RuleIssue[];   // empty ⟺ a clean pass. No score, no weight.
}

export interface ModelClient { complete(prompt: string): Promise<string>; }

export interface RuleContext {
  target: RuleTarget;
  path: string;
  content?: string;
  model?: ModelClient;   // present only for LLM rules (Orchestrator-injected)
}

export interface Rule {
  id: string;            // e.g. "static/file-length", "llm/intent-legibility"
  target: RuleTarget;
  type: RuleType;
  description?: string;
  run(context: RuleContext): RuleResult | Promise<RuleResult>;
}
```

## Zod schema (runtime enforcement)

```ts
export const RuleIssueSchema = z.object({
  problem: z.string().min(1),
  fix: z.string().min(1),
  severity: z.enum(["info", "minor", "major", "critical"]),
});
export const RuleResultSchema = z.object({ issues: z.array(RuleIssueSchema) });
```

## Scoring (derived, not returned)

```
fileScore = max(0, 100 − Σ PENALTY[issue.severity]  over ALL issues from ALL rules)
```
Not an average — passing rules contribute nothing, so the score is invariant to
rule count and a serious issue dominates. No issues anywhere → 100.

## Conformance rules (contract tests must assert)

1. `run()` returns an object passing `RuleResultSchema` (sync or async).
2. A rule declares ONE `target` and ONE `type`; `id` is unique and namespaced (`static/…` or `llm/…`).
3. **Every issue has a `fix`.** A deduction without a concrete fix is not a real issue — don't emit it.
4. A rule MUST NOT throw to signal problems — it returns issues. Throwing is an error path the Orchestrator isolates (FR-002).
5. No language-specific assumptions in the interface; a TS-specific rule guards on input inside `run()` and returns `{ issues: [] }` when inert.
6. LLM rules MUST validate model output with Zod + retry; on failure return `{ issues: [] }` (never fabricate problems — Principle VI).
7. A clean target returns `{ issues: [] }` — never a "100 + praise" signal. There is no praise channel.

## Severity guidance for authors

- **info** (−1): cosmetic / nit (a lazy variable name).
- **minor** (−3): real but localized (an `any`, a slightly-long function).
- **major** (−9): structural / correctness risk (a 600-line module, missing tests).
- **critical** (−27): must-fix (a hardcoded secret, a broken contract). One drops a file to 73; a few fail it.

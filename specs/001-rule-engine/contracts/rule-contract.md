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

// EXECUTION capability (#70): run one allowlisted command, never throws.
export type RuleExec = (command: string) => Promise<ExecResult>;

export interface RuleContext {
  target: RuleTarget;
  path: string;
  content?: string;
  model?: ModelClient;   // present only for LLM rules (Orchestrator-injected)
  exec?: RuleExec;       // present only for `needsExec` rules when execution is opted in (Orchestrator-injected)
}

export interface Rule {
  id: string;            // e.g. "static/file-length", "llm/intent-legibility"
  target: RuleTarget;
  type: RuleType;
  description?: string;
  needsExec?: boolean;   // declares the rule wants ctx.exec (spec 002 execution tier)
  run(context: RuleContext): RuleResult | Promise<RuleResult>;
}
```

> **Additive, not a shape change.** `exec?`/`needsExec?` are optional and
> backward-compatible — existing rules ignore them, exactly like `model?`. The
> frozen *shape* (a rule returns issues, not a score) is untouched. `exec` is a
> capability injected ONLY for rules that declare `needsExec`, and ONLY when
> execution is opted in (off by default); its absence is the off-mode guard, and
> a rejected/failed command returns a neutral `{ ok: false }` — never a throw,
> never a fabricated issue (Principles II, VI).

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

## LLM rules MUST be scoped (use `llmRule()`)

An LLM rule judges **one concern and nothing else**. "Find issues in this file"
is open-ended — an agreeable model always finds *something* (architecture,
library swaps, refactors), which is noise. So LLM rules are built with the
`llmRule({ topic, lookFor, maxSeverity })` scaffold (`src/core/llm-rule.ts`),
which bakes the guardrails into the prompt:

- report ONLY issues about the declared `topic`; never comment on anything else;
- intentional stubs / TODOs are not issues;
- every issue needs a concrete fix; if none, return `{ issues: [] }` — never invent, never praise;
- severity is clamped to `maxSeverity` (judgment rules default to `minor`).

```ts
export const intentLegibility = llmRule({
  id: "llm/intent-legibility",
  target: "file",
  description: "...",
  topic: "intent legibility — judged ONLY from the clarity of names and doc comments",
  lookFor: "- a misleading exported name\n- a missing doc comment on the main export\n- no statement of the file's purpose",
  maxSeverity: "minor",
});
```

Do NOT hand-write an open-ended LLM prompt. Declare a topic.

## Severity guidance for authors

- **info** (−1): cosmetic / nit (a lazy variable name).
- **minor** (−3): real but localized (an `any`, a slightly-long function).
- **major** (−9): structural / correctness risk (a 600-line module, missing tests).
- **critical** (−27): must-fix (a hardcoded secret, a broken contract). One drops a file to 73; a few fail it.

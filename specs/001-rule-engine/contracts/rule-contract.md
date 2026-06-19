# Contract: The Rule Interface (FROZEN — Principle I)

This is the keystone contract every rule and every lane builds against. Changing
its **shape** is a MAJOR governance event (constitution §Governance). Adding
rules is not a contract change.

## TypeScript shape

```ts
export type RuleTarget = "file" | "repo" | "ticket";
export type RuleType = "static" | "llm";

export interface RuleSignal {
  score: number;     // 0–100
  weight: number;    // ≥ 0; project config may override
  reasoning: string; // non-empty — required (Principle III)
}

export interface ModelClient {
  complete(prompt: string): Promise<string>;
}

export interface RuleContext {
  target: RuleTarget;
  path: string;
  content?: string;
  model?: ModelClient; // present only for LLM rules (Orchestrator-injected)
}

export interface Rule {
  id: string;          // e.g. "static/file-length", "llm/dod-quality"
  target: RuleTarget;
  type: RuleType;
  description?: string;
  run(context: RuleContext): RuleSignal | Promise<RuleSignal>;
}
```

## Zod schema (runtime enforcement)

```ts
export const RuleSignalSchema = z.object({
  score: z.number().min(0).max(100),
  weight: z.number().min(0),
  reasoning: z.string().min(1),
});
```

## Conformance rules (contract tests must assert)

1. `run()` returns an object passing `RuleSignalSchema` (sync or async).
2. A rule only declares ONE `target` and ONE `type`.
3. `id` is unique and namespaced by type (`static/…` or `llm/…`).
4. A rule MUST NOT throw to signal a low score — it returns a low `score` with `reasoning`. Throwing is an error path the Orchestrator isolates (FR-002).
5. The interface carries NO language-specific assumptions; a TS-specific rule guards on input inside `run()` (e.g. file extension) and returns a neutral signal when inert.
6. LLM rules MUST validate model output with Zod + retry before returning; on failure return a neutral signal (Principle VI).

## Composition contract (Arbitrator)

- Input: `IdentifiedSignal[]` (`RuleSignal & { ruleId }`).
- Output: `{ score: number (0–100, rounded), reasoning: string, signals: IdentifiedSignal[] }`.
- Score = weighted average; `reasoning` enumerates every signal. Empty input → `score: 100`, reasoning "No applicable rules fired."

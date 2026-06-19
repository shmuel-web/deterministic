# Phase 1 — Data Model: Rule Engine (Lane 0)

Entities, their fields, validation rules, and concrete examples. Schemas are enforced with Zod (Principle VI). See [contracts/rule-contract.md](./contracts/rule-contract.md) for the frozen interface.

## Entities

### RuleSignal (the audit atom)
A single rule's output.

| Field | Type | Rules |
|-------|------|-------|
| `score` | number | 0–100 inclusive |
| `weight` | number | ≥ 0 (config may override) |
| `reasoning` | string | non-empty (required — Principle III) |

### Rule
A self-contained scoring unit (see contract).

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | namespaced, e.g. `static/file-length`, `llm/dod-quality` |
| `target` | enum | `file` \| `repo` \| `ticket` |
| `type` | enum | `static` \| `llm` |
| `run(context)` | fn | returns `RuleSignal` (sync or async) |

### RuleContext
What a rule receives.

| Field | Type | Notes |
|-------|------|-------|
| `target` | enum | the target kind |
| `path` | string | file path / repo root / ticket path |
| `content` | string? | file or ticket content; absent for repo-level rules |
| `model` | ModelClient? | present only for LLM rules (injected by Orchestrator) |

### IdentifiedSignal
`RuleSignal` + `ruleId` — what the Arbitrator composes and the annotation stores.

### Annotation (persisted, composes up — Principle IV)

| Field | Type | Rules |
|-------|------|-------|
| `target` | enum | `file` \| `repo` \| `ticket` |
| `path` | string | identifies the scored thing |
| `score` | number | 0–100, the arbitrated result |
| `signals` | IdentifiedSignal[] | every contributing signal (audit trail) |
| `scoredAt` | string | ISO 8601 timestamp |

**Representation**: the annotation is serialized **into the scored file as a comment block** in the file's native comment syntax (see research.md D2), delimited by a `@deterministic` sentinel so it can be found and replaced idempotently. The same logical fields (score, signals, scoredAt) are rendered as comment lines. For comment-less formats (e.g. JSON) a sibling `<name>.deterministic.md` sidecar holds the block. The scorer strips this block from content before running rules. The file is the source of truth; re-scoring rewrites only that file's block.

## Concrete example — a TypeScript file, annotated in place

After `score-file`, the block is written at the top of the file using `//` comments. The next agent that opens `orchestrator.ts` reads its standing and the hint before touching it:

```ts
// ┌─ @deterministic ─ score: 76/100 ─ scored: 2026-06-19T11:53:25Z ──────────
// │ static/file-length      55/100  w1  612 lines — over the 300 soft cap; split this module
// │ static/missing-types    100/100 w2  No `any` annotations
// │ static/coverage         40/100  w2  31% covered — add tests before extending
// │ llm/intent-legibility   90/100  w3  Clear orchestration role
// │ ▸ next agent: reduce length and raise coverage before adding to this file
// └──────────────────────────────────────────────────────────────────────────
import { ... } from "...";
// ...real source continues...
```

Score `76` = weighted average of the signals shown. Every point is traceable to a rule — no black box (Principle III). On re-score, this exact block is located by the `@deterministic` sentinel and replaced; the scorer strips it first so `file-length` does not count these comment lines.

## Concrete example — a ticket (Markdown), DoD pair (Principle II)

Markdown has no line comment, so the block uses an HTML comment (non-rendering):

```md
<!-- @deterministic score: 35/100 scored: 2026-06-19T12:10:00Z
  static/ticket-has-dod   0/100  w2  No 'Definition of Done' / acceptance-criteria section found
  llm/dod-quality        55/100  w3  Goal stated, but success is not measurable; no validation path
  ▸ next: add measurable acceptance criteria and a validation path
-->
# DET-42: Improve dashboard performance
...
```

Determinism + judgment composing on one concern: a **static** rule says the DoD is *absent*; an **LLM** rule grades the *quality* of the intent that's there.

## Logical record (what the comment block encodes)

The comment rendering above serializes this logical annotation (the same fields the engine reads back when composing repo/ticket scores):

```json
{
  "target": "file",
  "path": "src/core/orchestrator.ts",
  "score": 76,
  "signals": [
    { "ruleId": "static/file-length", "score": 55, "weight": 1, "reasoning": "612 lines — over the 300 soft cap; split this module" },
    { "ruleId": "static/coverage", "score": 40, "weight": 2, "reasoning": "31% covered — add tests before extending" }
  ],
  "scoredAt": "2026-06-19T11:53:25.697Z"
}
```

## Validation & edge rules
- Output failing `RuleSignalSchema` → signal dropped with a warning; run continues (FR-002).
- No applicable rules → score `100` with reasoning "No applicable rules fired" (never silent 0).
- Inert rule (e.g. TS rule on non-TS file) → neutral `100` signal explaining inertness; no penalty.
- LLM malformed output → neutral signal (Principle VI), never crash.

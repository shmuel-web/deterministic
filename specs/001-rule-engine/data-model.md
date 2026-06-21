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

**Representation**: the annotation is serialized **into the scored file as a comment block** in the file's native comment syntax (see research.md D2), delimited by a `@deterministic` sentinel so it can be found and replaced idempotently. For comment-less formats (e.g. JSON) a sibling `<name>.deterministic.md` sidecar holds the block. The scorer strips this block from content before running rules. The file is the source of truth; re-scoring rewrites only that file's block.

**Low-noise by design (the annotation is a punch-list, not a report):**
- The composite **score** is always shown (the headline).
- Only rules **with room to improve** (`score < 100`) are listed — each a thing the next agent can act on.
- **Perfect rules collapse** into a single `(N rules passed)` line. This keeps the score auditable (Principle III — we don't hide that they ran) while preventing noise that would otherwise grow with every rule added.
- A `> next:` hint is added only when the worst rule is genuinely low (`< 70`), so it stays actionable.
- The interactive CLI output (transient) still prints the **full** per-rule breakdown — only the *persisted* annotation is trimmed.

## Concrete example — a TypeScript file, annotated in place

A file with one rule needing attention (the others pass):

```ts
// @deterministic score: 76/100  scored: 2026-06-19T11:53:25Z
//   static/file-length  55/100  w1  612 lines — over the 300 soft cap; split this module
//   static/coverage     40/100  w2  31% covered — add tests before extending
//   (2 rules passed)
//   > next: 31% covered — add tests before extending
// @deterministic:end
import { ... } from "...";
// ...real source continues...
```

A clean file shows almost nothing — just the score and the pass count:

```ts
// @deterministic score: 98/100  scored: 2026-06-21T11:46:02Z
//   llm/intent-legibility  95/100  w3  Clear intent; types and docs make the role obvious
//   (3 rules passed)
// @deterministic:end
```

Score is the weighted average of **all** signals (passed ones included); only the *display* is trimmed. On re-score the block is located by the sentinel and replaced; the scorer strips it first so the rules never count the annotation's own lines.

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

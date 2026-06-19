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

**Store**: keyed by `${target}:${path}` in `.deterministic/annotations.json`. Re-scoring a target overwrites its entry only — higher-level scores read entries, never the tree.

## Concrete example — file annotation

A real `score-file` result (static path; LLM rule skipped only illustratively — in normal runs a model is resolved):

```json
{
  "file:src/core/orchestrator.ts": {
    "target": "file",
    "path": "src/core/orchestrator.ts",
    "score": 91,
    "signals": [
      {
        "ruleId": "static/file-length",
        "score": 100,
        "weight": 1,
        "reasoning": "55 lines — within the 300-line soft cap."
      },
      {
        "ruleId": "static/missing-types",
        "score": 100,
        "weight": 2,
        "reasoning": "No `any` annotations."
      },
      {
        "ruleId": "llm/intent-legibility",
        "score": 78,
        "weight": 3,
        "reasoning": "Clear orchestration role; the dispatch branch would read better with a short comment."
      }
    ],
    "scoredAt": "2026-06-19T11:53:25.697Z"
  }
}
```

Score `91` = weighted average: `(100·1 + 100·2 + 78·3) / (1+2+3) = 90.67 → 91`. Every point is traceable to a rule — no black box.

## Concrete example — ticket annotation (DoD pair, Principle II)

```json
{
  "ticket:tickets/DET-42.md": {
    "target": "ticket",
    "path": "tickets/DET-42.md",
    "score": 35,
    "signals": [
      {
        "ruleId": "static/ticket-has-dod",
        "score": 0,
        "weight": 2,
        "reasoning": "No 'Definition of Done' / acceptance-criteria section found."
      },
      {
        "ruleId": "llm/dod-quality",
        "score": 55,
        "weight": 3,
        "reasoning": "Goal is stated but success is not measurable; no validation path."
      }
    ],
    "scoredAt": "2026-06-19T12:10:00.000Z"
  }
}
```

Shows determinism + judgment composing on one concern: a static rule says the DoD is *absent*; an LLM rule grades the *quality* of what intent exists.

## Validation & edge rules
- Output failing `RuleSignalSchema` → signal dropped with a warning; run continues (FR-002).
- No applicable rules → score `100` with reasoning "No applicable rules fired" (never silent 0).
- Inert rule (e.g. TS rule on non-TS file) → neutral `100` signal explaining inertness; no penalty.
- LLM malformed output → neutral signal (Principle VI), never crash.

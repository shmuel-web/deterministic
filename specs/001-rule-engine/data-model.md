# Phase 1 — Data Model: Rule Engine (Lane 0)

Entities, their fields, validation rules, and concrete examples. Schemas are enforced with Zod (Principle VI). See [contracts/rule-contract.md](./contracts/rule-contract.md) for the frozen interface.

## Entities

### RuleIssue (the audit atom)
A single, actionable finding — the unit a rule speaks in.

| Field | Type | Rules |
|-------|------|-------|
| `problem` | string | non-empty; what's wrong, with specifics |
| `fix` | string | non-empty; the concrete change that resolves it |
| `severity` | enum | `info` \| `minor` \| `major` \| `critical` |

Penalty by severity (3× geometric): `info −1, minor −3, major −9, critical −27`.

### RuleResult
What every rule returns. No score, no weight.

| Field | Type | Rules |
|-------|------|-------|
| `issues` | RuleIssue[] | empty ⟺ a clean pass |

### Rule
A self-contained scoring unit (see contract).

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | namespaced, e.g. `static/file-length`, `llm/intent-legibility` |
| `target` | enum | `file` \| `repo` |
| `type` | enum | `static` \| `llm` |
| `run(context)` | fn | returns `RuleResult` (sync or async) |

### RuleContext
What a rule receives.

| Field | Type | Notes |
|-------|------|-------|
| `target` | enum | the target kind |
| `path` | string | file path / repo root |
| `content` | string? | file content; absent for repo-level rules |
| `model` | ModelClient? | present only for LLM rules (injected by Orchestrator) |

### IdentifiedIssue
`RuleIssue` + `ruleId` — what the scorer pools and the annotation lists.

### Derived score
`score = max(0, 100 − Σ PENALTY[severity])` over all issues. NOT an average — passing rules contribute nothing.

### Annotation (persisted, composes up — Principle IV)

| Field | Type | Rules |
|-------|------|-------|
| `target` | enum | `file` \| `repo` |
| `path` | string | identifies the scored thing |
| `score` | number | 0–100, the derived score |
| `issues` | IdentifiedIssue[] | the findings (the audit trail). No timestamp — it only churns diffs. |

**Representation**: the annotation is serialized **into the scored file as a comment block** in the file's native comment syntax (see research.md D2), delimited by a `@deterministic` sentinel so it can be found and replaced idempotently. For comment-less formats (e.g. JSON) a sibling `<name>.deterministic.md` sidecar holds the block. The scorer strips this block from content before running rules. The file is the source of truth; re-scoring rewrites only that file's block.

**The annotation IS the issue list** — score, then each problem with its fix and severity, worst first. A clean file lists nothing. No praise, no timestamp. The interactive CLI prints the same findings (it just can't be "trimmed" — there's nothing to trim).

## Concrete example — a TypeScript file with issues

```ts
// @deterministic score: 64/100
//   [major] static/file-length  612 lines — 312 over the 300-line soft cap → split into smaller, focused modules
//   [minor ×3] static/missing-types  `any` annotation erases type safety → replace `any` with a concrete type
// @deterministic:end
import { ... } from "...";
// ...real source continues...
```

Score: `100 − 9 (major) − 3×3 (three minors) = 82`… here shown as 64 with an extra major elsewhere. Every point lost maps to a fixable issue. Identical findings collapse into one `×N` line.

## A clean file lists nothing

```ts
// @deterministic score: 100/100 — no issues
// @deterministic:end
```

## Validation & edge rules
- A rule result failing `RuleResultSchema` → the rule is dropped with a warning; the run continues (FR-002).
- No applicable rules / no issues → score `100`, empty issue list (never a silent 0).
- Inert rule (e.g. a TS rule on a non-TS file) → `{ issues: [] }`; no penalty.
- LLM malformed output after retry → `{ issues: [] }` (never fabricate problems — Principle VI).

# Implementation Plan: Rule Engine & `score-file` (Lane 0 Keystone)

**Branch**: `001-rule-engine` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-rule-engine/spec.md`

## Summary

Build the keystone of Deterministic: a frozen, language-agnostic **Rule contract**, a **model-resolution** step (local Ollama → user API → hard error), an **Orchestrator** that gathers applicable rules and runs static rules inline / routes LLM rules to reviewer agents, an **Arbitrator** that composes weighted signals into one auditable score, an **annotation store** that lets higher-level scores compose incrementally, a working **`score-file`** command, and a **starter rule set** (static + LLM, including the ticket Definition-of-Done pair). Everything runs locally; LLM rules use Gemma 4 via Ollama.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 18+ (dev on Node 24), ESM / NodeNext
**Primary Dependencies**: Zod (schema validation), Mastra (agent orchestration for LLM rules), Ollama HTTP API (`localhost:11434`, model `gemma4`); tsx for dev run
**Storage**: In-file comment annotations in each file's native syntax (committed in-repo); `<name>.deterministic.md` sidecar fallback for comment-less formats (see research.md D2). The file is the source of truth.
**Testing**: `node:test` + `tsx` for unit/contract tests; static rules are deterministic and unit-tested; the LLM path is contract-tested with a stubbed `ModelClient`
**Target Platform**: Developer laptop (macOS/Linux), CLI, fully local
**Project Type**: Single project — CLI + library (`src/`)
**Performance Goals**: Static-only file score < 10s on a dev laptop; static rules add negligible overhead; LLM rule latency bounded by the local model
**Constraints**: Local-first (no cloud by default); LLM required (fail fast if no model); every score auditable; no O(whole-repo) recomputation
**Scale/Scope**: This feature = the `file` target end-to-end + the contract all lanes build on. Starter set ~5 rules. Repo/ticket targets are later lanes (contract must already support them).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies |
|-----------|------------------------|
| I. Frozen language-agnostic contract | One `Rule` interface in `src/core/rule.ts`; TS-specific logic lives only inside individual rules. Contract shape is the reviewed artifact (`contracts/rule-contract.md`). |
| II. Determinism where achievable, judgment where not | Static rules run inline and carry weight; LLM rules via agents; both compose. DoD pair (static presence + LLM quality) is in the starter set. |
| III. Auditable scores | `Arbitrator` output enumerates every signal (id, weight, reasoning); `reasoning` required by the Zod schema. |
| IV. Annotations compose up | File is the atomic unit; the annotation is written into the file as a comment block; repo/ticket lanes read those blocks for changed files — no whole-tree re-reads. |
| V. Local-first, LLM required | `resolveModel()`: local Ollama → user API → hard error. Judgment never silently skipped. |
| VI. Validate model output | LLM rule output Zod-validated with retry; malformed → neutral signal, never crash/poison. |

**Result: PASS.** No violations; Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-rule-engine/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (model resolution, annotation storage, agent staging)
├── data-model.md        # Phase 1 — entities + concrete annotation example
├── quickstart.md        # Phase 1 — run score-file, add a rule
├── contracts/
│   └── rule-contract.md # Phase 1 — the frozen Rule + RuleSignal contract
└── tasks.md             # Phase 2 — created by /spec-tasks (NOT here)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── rule.ts          # Rule contract + Zod schemas (RuleSignal, ModelClient) — Principle I
│   ├── orchestrator.ts  # Gather applicable rules; run static inline / LLM via agents
│   ├── arbitrator.ts    # Compose weighted signals → one auditable score
│   ├── annotation.ts    # Read/parse/write the in-file @deterministic comment block (idempotent); strip-before-score
│   ├── comment-style.ts # Extension → comment syntax (// , #, /* */, <!-- -->); sidecar fallback
│   └── model.ts         # resolveModel(): local Ollama → user API → hard error
├── agents/
│   └── roles.ts         # Scout / Reviewers / Arbitrator / Orchestrator role interfaces (Mastra wiring staged)
├── rules/
│   ├── static/
│   │   ├── file-length.ts
│   │   ├── missing-types.ts
│   │   └── ticket-has-dod.ts        # static: Definition of Done present?
│   └── llm/
│       ├── intent-legibility.ts
│       └── dod-quality.ts           # llm: quality of the Definition of Done
├── commands/
│   ├── score-file.ts      # INTERNAL file scoring (atomic unit) + annotation write; hidden `file` dev cmd
│   ├── init.ts            # `init` — expensive baseline: annotate every file (Lane 1)
│   ├── score-repo.ts      # `score repo` — cheap incremental composer (Lane 1)
│   ├── score-ticket.ts    # `score ticket` (Lane 2)
│   └── validate-ticket.ts # `validate ticket` (Lane 3)
└── cli.ts                 # `init` / `score repo|ticket` / `validate ticket`

deterministic.config.ts  # rule registry + weights (per target)

tests/
├── contract/            # rule-contract conformance, arbitrator audit shape
├── unit/                # individual static rules
└── integration/         # score-file end-to-end (static path; LLM path with stub model)
```

**Structure Decision**: Single TypeScript project (CLI + library). Mirrors the scoring graph: `core/` is the engine, `rules/` the product, `agents/` the LLM executors, `commands/` the public surface. Generalizes to repo/ticket targets without contract changes.

## Triage Framework: [SYNC] vs [ASYNC] Classification

**Execution Strategy**: Hybrid — the frozen contract and engine seams are human-reviewed ([SYNC]); individual rules and stubs are agent-delegable ([ASYNC]).

### Preliminary Task Classification

| Task Category | Estimated [SYNC] Tasks | Estimated [ASYNC] Tasks | Rationale |
|---------------|----------------------|----------------------|-----------|
| Business Logic (contract, arbitrator, orchestrator, model resolution) | 4 | 0 | Shared seams everything depends on — must be reviewed; a wrong contract blocks the team. |
| Data Operations (annotation store) | 1 | 0 | Defines the persisted shape other lanes read. |
| UI Components | 0 | 0 | CLI output only; no UI. |
| Integrations (Ollama client, Mastra agent wiring) | 1 | 1 | Model client reviewed [SYNC]; reviewer-agent stubs [ASYNC]. |
| Infrastructure (CLI dispatch, config, starter rules, tests) | 1 | 5 | Each rule is an independent, parallelizable [ASYNC] unit against the frozen contract. |

### Triage Decision Criteria Applied

**High-Risk [SYNC] Classifications:**
- The `Rule` contract + Zod schemas (Principle I — changing it later is a MAJOR event).
- The `Arbitrator` composition (defines what "auditable score" means).
- `resolveModel()` (Principle V — required-LLM behavior, fail-fast).
- The annotation schema (Principle IV — the shared persisted contract).

**Agent-Delegated [ASYNC] Classifications:**
- Each starter rule (file-length, missing-types, ticket-has-dod, intent-legibility, dod-quality) — independent, against the frozen contract.
- The Lane-1/2/3 command stubs.

### Triage Audit Trail

| Task | Classification | Primary Criteria | Risk Level | Rationale |
|------|----------------|------------------|------------|-----------|
| Rule contract + Zod | SYNC | Shared dependency | High | Frozen keystone; blocks all rules/lanes. |
| Arbitrator | SYNC | Correctness/audit | Med | Defines score semantics + auditability. |
| resolveModel() | SYNC | Constitution V | Med | Must fail fast, never silently skip judgment. |
| Annotation store | SYNC | Shared contract | Med | Other lanes read this shape. |
| Orchestrator | SYNC | Integration | Med | Wires static + LLM dispatch. |
| Starter rules (x5) | ASYNC | Isolated unit | Low | Independent; conform to frozen contract. |
| Command stubs (x3) | ASYNC | Isolated unit | Low | Throw "Lane N" until built. |

## Complexity Tracking

> No constitution violations — section intentionally empty.

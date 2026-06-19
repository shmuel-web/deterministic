# Tasks: Rule Engine & `score-file` (Lane 0 Keystone)

**Feature**: `001-rule-engine` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Format: `[ID] [P?] [Story] [SYNC|ASYNC] Description`

- **[P]**: can run in parallel (different files, no dependency)
- **[US#]**: the user story a task serves
- **[SYNC]**: human-reviewed (shared seam / high-risk); **[ASYNC]**: agent-delegable (isolated unit) — from the plan's triage

## Path Conventions
Single TS project. Engine in `src/core/`, rules in `src/rules/`, commands in `src/commands/`, tests in `tests/`. Config at repo root (`deterministic.config.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] **T001** [SYNC] Initialize TypeScript project: `package.json` (ESM, `type:module`, bin `deterministic`, scripts dev/build/typecheck/test), `tsconfig.json` (NodeNext, strict), deps `zod`, devDeps `typescript`/`tsx`/`@types/node`.
- [ ] **T002** [P] Create source tree: `src/core/`, `src/rules/static/`, `src/rules/llm/`, `src/commands/`, `tests/{contract,unit,integration}/`.
- [ ] **T003** [P] Configure `node:test` + `tsx` test runner and a `pnpm test` script.

## Phase 2: Foundational — the Keystone (BLOCKS all user stories)

> The frozen contract + engine seams. All [SYNC] except where noted. No rules can be written until T004 lands.

- [ ] **T004** [SYNC] Define the **frozen Rule contract** + Zod schemas in `src/core/rule.ts` — `Rule`, `RuleSignal` (`RuleSignalSchema`), `RuleContext`, `ModelClient`. Per [contracts/rule-contract.md](./contracts/rule-contract.md). (Principle I)
- [ ] **T005** [P] [SYNC] Implement `arbitrate()` in `src/core/arbitrator.ts` — weighted average → `{score, reasoning, signals}`; empty → 100 "no rules fired". (Principle III)
- [ ] **T006** [SYNC] Implement the Orchestrator in `src/core/orchestrator.ts` — gather rules for a target, run static inline, route LLM rules (inject `model`), validate each signal, isolate a throwing rule. (Depends T004)
- [ ] **T007** [SYNC] Implement `resolveModel()` in `src/core/model.ts` — local Ollama (`localhost:11434`) → user API (`DETERMINISTIC_LLM_API_*`) → hard error. (Principle V)
- [ ] **T008** [P] [ASYNC] Implement `comment-style.ts` — extension → comment syntax (`//`, `#`, `/* */`, `<!-- -->`); sidecar fallback for comment-less formats.
- [ ] **T009** [SYNC] Implement `annotation.ts` — parse/write the idempotent in-file `@deterministic` block (find-by-sentinel & replace, else insert at top), **strip-before-score**, and read-back for composition. (Depends T004, T008; Principle IV)
- [ ] **T010** [SYNC] Create `deterministic.config.ts` — rule registry + per-rule weights; config weight overrides rule self-weight. (Depends T004)
- [ ] **T011** [P] [SYNC] Contract conformance test in `tests/contract/` — asserts every registered rule's output passes `RuleSignalSchema`, ids namespaced/unique, and the arbitrator audit shape.

---

## Phase 3: User Story 1 — Score a file, get an auditable result (P1) 🎯 MVP

**Goal**: `score-file <path>` → 0–100 score + per-rule breakdown + in-file annotation. **Independent test**: run it on a repo file, see the breakdown and the written `@deterministic` block.

- [ ] **T012** [SYNC] [US1] Implement `src/commands/score-file.ts` — read file, strip prior annotation, run rules via Orchestrator, `arbitrate()`, write the in-file annotation block, print the breakdown. (Depends Phase 2)
- [ ] **T013** [US1] Implement `src/cli.ts` — dispatch `score-file` (+ help); stubs for other commands.
- [ ] **T014** [P] [US1] [ASYNC] Static rule `src/rules/static/file-length.ts` (soft cap ~300 lines). Register in config.
- [ ] **T015** [P] [US1] [ASYNC] Static rule `src/rules/static/missing-types.ts` (penalize `any` in TS files; inert elsewhere). Register in config.
- [ ] **T016** [US1] Integration test `tests/integration/score-file.test.ts` — score a fixture file, assert score range, breakdown present, and annotation written + idempotent on re-run (SC-001, SC-002, SC-005).

**Checkpoint**: static end-to-end scoring works and self-annotates — demoable MVP.

---

## Phase 4: User Story 2 — Judgment is always available (model resolution) (P1)

**Goal**: LLM rules run against a resolved model; no model → clear error. **Independent test**: with Ollama up an LLM rule contributes; with none configured the run errors.

- [ ] **T017** [SYNC] [US2] Ollama `ModelClient` in `src/core/model.ts` (HTTP `generate`, model `qwen3-coder`); wire into `resolveModel()`.
- [ ] **T018** [P] [US2] [ASYNC] User-API `ModelClient` (endpoint + key) as the fallback path.
- [ ] **T019** [US2] Wire `resolveModel()` into `score-file`/Orchestrator: LLM rules receive the model; fail fast with actionable message if none. (SC-004)
- [ ] **T020** [P] [US2] [ASYNC] LLM rule `src/rules/llm/intent-legibility.ts` — prompt, Zod validate-and-retry, neutral on malformed. (Principle VI) Register in config.
- [ ] **T021** [US2] Contract test with a **stub `ModelClient`**: valid JSON → signal; malformed → neutral (no crash); no-model → error.

---

## Phase 5: User Story 3 — Author & register a rule against the contract (P2)

**Goal**: a contributor adds a rule with zero engine edits. **Independent test**: add a rule file + config entry, see it fire.

- [ ] **T022** [P] [US3] [ASYNC] Write `docs/writing-a-rule.md` — the contract, static vs LLM, register-with-weight, try it. (SC-003)
- [ ] **T023** [US3] Verify extensibility: confirm T014/T015/T020 each touched only a rule file + `deterministic.config.ts` (no engine edits); note in PR.

---

## Phase 6: User Story 4 — Static + LLM compose on one concern (DoD) (P3)

**Goal**: ticket scoring where a static rule checks DoD presence and an LLM rule grades DoD quality. **Independent test**: score tickets with/without a DoD.

- [ ] **T024** [P] [US4] [ASYNC] Static rule `src/rules/static/ticket-has-dod.ts` (target `ticket`; present/absent). Register in config.
- [ ] **T025** [P] [US4] [ASYNC] LLM rule `src/rules/llm/dod-quality.ts` (target `ticket`; grades quality). Register in config.
- [ ] **T026** [US4] Integration test: score ticket fixtures (with/without DoD); assert the static rule flips and the LLM rule grades; annotation uses HTML-comment block. (SC-006)

---

## Phase 7: Polish & Cross-Cutting

- [ ] **T027** [P] [ASYNC] Lane stubs: `analyze-repo.ts` (Lane 1), `analyze-ticket.ts` (Lane 2), `validate.ts` (Lane 3) — throw "Lane N — not implemented".
- [ ] **T028** [P] Update `README.md` + `CLAUDE.md` with `score-file` usage and the annotation behavior.
- [ ] **T029** Run `quickstart.md` end-to-end against this repo (dogfood); capture a real annotated file for the demo.

---

## Dependencies & Execution Order

### Phase order
- **Setup (P1)** → **Foundational (P2, BLOCKS everything)** → **User Stories (P3–P6)** → **Polish (P7)**.

### User-story independence
- **US1 (P1)** after Phase 2 — the MVP, no dependency on other stories.
- **US2 (P1)** after Phase 2 — adds the model path; `intent-legibility` needs it.
- **US3 (P2)** after at least one rule exists (validates DX).
- **US4 (P3)** after Phase 2 — independent ticket-target slice.

### Parallel opportunities
- Setup: T002, T003 in parallel.
- Foundational: T005, T008, T011 in parallel with the T004→T006/T009/T010 chain.
- **Rules are the big parallel front** (the "everyone writes rules" plan): T014, T015, T020, T024, T025 are all independent `[ASYNC]` units against the frozen contract once T004/T010 land.

### Suggested MVP cut
T001–T016 (Setup + Foundational + US1) = a self-annotating `score-file` you can demo. US2 adds judgment; US4 adds the ticket DoD story.

# Feature Specification: Rule Engine & `score-file` (Lane 0 Keystone)

**Feature Branch**: `001-rule-engine`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Lane 0 — the rule engine keystone: a frozen, language-agnostic Rule contract with validated output; model resolution (local Ollama default, user-provided API fallback, hard error if neither); an Orchestrator that gathers applicable rules and dispatches static inline / LLM to reviewer agents; an Arbitrator that composes weighted signals into one auditable score; an annotation store; a working score-file command end-to-end; and a starter rule set mixing static and LLM rules including the ticket Definition-of-Done pair."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Score a file and get an auditable result (Priority: P1)

A developer points the tool at a single source file and gets back a 0–100 score composed from the rules that fired, each with its weight and a one-line reason. The score is persisted as an annotation.

**Why this priority**: This is the atomic unit the entire product composes from (repo and ticket scores read file annotations). Without it, nothing else exists. It is the demonstrable MVP.

**Independent Test**: Run the file scorer on a real file in this repo; confirm a 0–100 score, a per-rule breakdown (id, weight, reasoning) that explains the number, and an annotation written to the local store.

**Acceptance Scenarios**:

1. **Given** a healthy source file, **When** it is scored, **Then** a 0–100 score is returned with a per-rule breakdown and an annotation is persisted.
2. **Given** a file with an obvious problem (e.g. very long, or many untyped values), **When** it is scored, **Then** the responsible rule(s) lower the score and their `reasoning` names the problem.
3. **Given** the same unchanged file is scored twice, **When** scored again, **Then** the result is identical for static rules (deterministic).

---

### User Story 2 - Judgment is always available (model resolution) (Priority: P1)

Because tickets and intent need judgment, an LLM must always be reachable. The engine resolves a model before scoring: local Ollama by default, a user-provided LLM API as fallback, and a hard, actionable error if neither is configured.

**Why this priority**: Constitution Principle V — an LLM is required; judgment is never silently skipped. A partial, judgment-free score presented as complete is a correctness failure, not a degraded pass.

**Independent Test**: With local Ollama running, LLM rules execute and contribute signals. With no model configured at all, the run exits with a clear "configure a model" error rather than a silent static-only score.

**Acceptance Scenarios**:

1. **Given** a local model is reachable, **When** a target is scored, **Then** LLM rules run and their signals appear in the breakdown.
2. **Given** no local model but a configured API, **When** a target is scored, **Then** LLM rules run against the API.
3. **Given** no model configured (local or remote), **When** scoring is attempted, **Then** the tool fails fast with an actionable message and does not emit a score.

---

### User Story 3 - Author and register a rule against a stable contract (Priority: P2)

A contributor adds a new rule (static or LLM) implementing the one contract, registers it with a weight in config, and sees it take effect — without modifying the engine.

**Why this priority**: "Everyone writes rules" is the main parallel activity on Fuseday; the frozen contract is what lets 8 people contribute without colliding.

**Independent Test**: Add a new static rule file, register it with a weight, score a file, and observe the new rule's signal in the breakdown — with zero edits to orchestrator/arbitrator code.

**Acceptance Scenarios**:

1. **Given** a new rule implementing the contract, **When** it is registered with a weight, **Then** it fires on its target and contributes a weighted signal.
2. **Given** a rule emits malformed output, **When** the engine runs, **Then** that signal is rejected without aborting the run or corrupting other signals.

---

### User Story 4 - Static and LLM rules compose on one concern (Priority: P3)

A single concern can need both rule kinds. For a ticket's Definition of Done: a static rule checks it is *present*; an LLM rule judges its *quality*. Both fire on the ticket and compose into one score.

**Why this priority**: Demonstrates the determinism-vs-judgment model (Principle II) end-to-end and seeds the ticket-scoring lane.

**Independent Test**: Score a ticket with and without a Definition of Done; confirm the static presence rule flips, and the LLM quality rule produces a graded signal when one is present.

**Acceptance Scenarios**:

1. **Given** a ticket lacking a Definition of Done, **When** scored, **Then** the static presence rule scores it low and says so.
2. **Given** a ticket with a vague Definition of Done, **When** scored, **Then** the LLM quality rule grades it below a crisp one.

---

### Edge Cases

- **No applicable rules for a target**: return a neutral score with an explicit note ("no rules fired"), never a silent 0.
- **Model becomes unreachable mid-run**: fail fast with a clear error (Principle V) — do not silently drop judgment rules.
- **A rule throws**: isolate the failure to that rule; the rest of the score still composes.
- **Rule inert for the input** (e.g. a TypeScript-specific rule on a non-TS file): contribute a neutral/explained signal, do not penalize.
- **Oversized file/ticket content for an LLM rule**: bound what is sent to the model; never fail because content is large.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define ONE rule contract — `id`, `target` (file | repo | ticket), `type` (static | llm), and `run(context) → { score 0–100, weight, reasoning }`. The contract MUST be language-agnostic; language-specific logic lives inside rules.
- **FR-002**: The system MUST validate every rule's output against a schema; a malformed signal MUST be rejected/skipped with a warning, never abort the run.
- **FR-003**: The Orchestrator MUST gather the rules applicable to a target and execute them — static rules inline, LLM rules via the reviewer agents.
- **FR-004**: The Arbitrator MUST compose signals into a single 0–100 score using transparent weighting, and the result MUST enumerate every contributing rule with its weight and reasoning (auditable — Principle III).
- **FR-005**: The system MUST resolve a model before any run: local Ollama by default, user-provided LLM API as fallback, and a hard actionable error if neither is configured. Judgment rules MUST NOT be silently skipped (Principle V).
- **FR-006**: LLM rule output MUST be schema-validated with validate-and-retry; malformed responses MUST degrade to a neutral signal, never crash a run or poison a score (Principle VI).
- **FR-007**: The system MUST provide **internal file scoring** (the atomic unit) that scores one file end-to-end and prints the auditable breakdown. It is composed by the public commands (`init`, `score repo`, `validate ticket`); it is NOT a public command (exposed directly only as a hidden `file` dev command).
- **FR-008**: A file score MUST be persisted as an annotation (target, path, score, signals, timestamp), keyed so higher-level scores can compose from it incrementally without re-reading the tree (Principle IV).
- **FR-009**: Rules MUST be registered with weights in project config; a project MUST be able to enable/disable/reweight rules without engine changes. Config weight overrides a rule's self-reported weight.
- **FR-010**: A starter rule set MUST ship: static file rules (file length, missing types), an LLM file rule (intent legibility), and the ticket Definition-of-Done pair (static presence + LLM quality).
- **FR-011**: The system MUST score the three deterministic targets distinctly — file rules score files; the same engine path generalizes to repo/ticket targets (built in later lanes) without contract changes.

### Key Entities

- **Rule**: a self-contained scoring unit — identity, target, type, and a `run` that returns a signal.
- **Rule Signal**: a rule's output — score (0–100), weight, reasoning. The audit atom.
- **Rule Context**: what a rule receives — target kind, path, content, and (for LLM rules) a resolved model handle.
- **Annotation**: a persisted score for one target — target, path, score, contributing signals, timestamp.
- **Model Resolution**: the decision of which LLM backs LLM rules (local → API → error).
- **Rule Configuration**: which rules run on which target and at what weight.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer scores any file with a single command and receives a 0–100 score plus a per-rule breakdown, in under 10 seconds on a dev laptop (static-only path).
- **SC-002**: 100% of a score's contributing signals are inspectable (rule id, weight, reasoning) — no unexplained number.
- **SC-003**: A contributor can add and register a new rule touching only a rule file plus config (zero engine edits), in under 15 minutes.
- **SC-004**: With no model configured, the tool exits with a clear, actionable error 100% of the time — it never emits a judgment-free score presented as complete.
- **SC-005**: Re-scoring composes from a stored annotation rather than recomputing — re-running on an unchanged file does not redo upstream work.
- **SC-006**: The Definition-of-Done concern is demonstrably scored by both a static (presence) and an LLM (quality) rule on the same ticket.

## Assumptions

- Per the constitution, the stack is TypeScript/Node with a local Ollama + Qwen 3 Coder model available on dev machines; the hackathon scope is TypeScript-only.
- Annotations are stored in a local store by default; whether they are committed in-repo vs. kept as CI metadata is an open question deferred to the DevOps lane.
- `init` / `score repo` (Lane 1), `score ticket` (Lane 2), and `validate ticket` (Lane 3) are later lanes; this feature delivers internal file scoring end-to-end plus the frozen contract every other lane builds on.
- The reviewer-agent roles (Scout / Architect / Implementation / PM / Arbitrator) are the executors for LLM rules; their full multi-perspective implementation may be staged, but the contract and orchestration seam land here.

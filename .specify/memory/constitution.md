# Deterministic Constitution

A linter for AI coding agents. It validates the *task*, the *repo*, and the
*execution* — so AI-driven delivery becomes verifiable, not just fast. These
principles are the non-negotiable spine; specs, plans, and tasks are checked
against them.

## Core Principles

### I. The Rule Contract Is the Frozen Keystone
Everything scores through one interface: `Rule { id, target: file|repo|ticket, type: static|llm, run(context) → { score, weight, reasoning } }`.
- The contract MUST stay language-agnostic. Language-specific logic (TS, etc.) lives *inside* individual rules, never in the interface.
- A score is computed from rules — never from one monolithic prompt that "vibes a number."
- Changing the contract's shape is a MAJOR governance event (see Governance). New rules are not.

### II. Determinism First — Static Rules Carry the Weight
Static rules (AST, complexity metrics, regex, `tsc`) are fast, free, and perfectly repeatable; they are the backbone that makes the name *Deterministic* honest.
- LLM rules MUST be reserved for genuine judgment calls (intent legibility, scope coherence).
- A target's score MUST NOT depend solely on LLM rules. When no model is available, static rules still produce a meaningful score.

### III. Every Score Is Auditable
No black-box numbers.
- Every score MUST be decomposable into the exact rules that fired, their weights, and a human-readable `reasoning` string per signal.
- `reasoning` is mandatory on every signal. "Measured, not assumed" is literal.

### IV. Annotations Compose Up
The file is the atomic scoring unit. Repo and ticket scores are composites.
- Repo/ticket scores MUST be composed from persisted file annotations plus target-level traits — never by re-reading the whole tree.
- Scoring MUST be incremental: touch a file → re-annotate that one file → higher-level scores update cheaply. No O(whole-repo) runs.

### V. Local-First, Zero-Permission
The whole tool runs on the developer's machine.
- Model calls MUST go to a local LLM (Ollama, `localhost:11434`) by default — no API keys, no cloud, no data leaving the laptop.
- CI integration (GitLab/GitHub) is an OPTIONAL enhancement. Core value MUST work fully local before any CI is wired.

### VI. Trust the Model's Output Only After Validation (NON-NEGOTIABLE)
Local models emit flakier JSON than a frontier API.
- Every LLM rule output MUST be validated against a Zod schema before use, with validate-and-retry on failure.
- A malformed model response MUST degrade gracefully (neutral signal), never crash a run or poison a score.

## Technology Constraints (locked)

- **Language/runtime:** TypeScript, Node 18+, ESM (NodeNext).
- **Agent orchestration:** Mastra.
- **Local LLM:** Ollama serving **Qwen 3 Coder** at `localhost:11434` (LLM rules only; static rules need no model).
- **Validation:** Zod on every LLM rule output.
- **Repo detection:** file-based.
- **Observability:** Langfuse via OpenTelemetry.
- **Explicitly NOT used:** LangGraph JS, OMA.

Deployment/hosting is explicitly out of scope — local-on-every-laptop is the target.

## Development Workflow

- **Spec-driven:** features flow through Spec-Kit — `specify → plan → tasks → implement` with review gates. No implementation lane starts before its spec is approved.
- **Everyone writes rules:** the cleanest unit of parallel contribution is a single rule authored against the frozen contract. Rules land independently and often.
- **Visible teamwork:** contributors commit under their own name; small, legible commits over large opaque ones.
- **Dogfooding:** we run Deterministic on Deterministic; our own scored artifacts are the demo.
- **Protect the happy path:** the end-to-end workflow (`score-file` → compose → validate) must keep working; new rules must not break a run.

## Governance

- This constitution supersedes ad-hoc practice. Specs, plans, and reviews verify compliance with the principles above.
- **Rule-contract changes** (Principle I) require a MAJOR version bump, explicit rationale, and a migration note for existing rules/annotations.
- Complexity must be justified against the principles; when in doubt, prefer the simpler, more deterministic, more local option.
- Runtime development guidance lives in `CLAUDE.md` and `docs/PLAN.md`; this document is the source of principle-level truth.

**Version**: 1.0.0 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-19

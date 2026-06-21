# Deterministic Constitution

A linter for AI coding agents. It validates the *task*, the *repo*, and the
*execution* — so AI-driven delivery becomes verifiable, not just fast. These
principles are the non-negotiable spine; specs, plans, and tasks are checked
against them.

## Core Principles

### I. The Rule Contract Is the Frozen Keystone
Everything scores through one interface: `Rule { id, target: file|repo|ticket, type: static|llm, run(context) → { issues: [{ problem, fix, severity }] } }`.
- A rule does NOT return a score. It returns the **issues** it found — each a concrete problem with a `fix` and a `severity`. The engine derives the score (see Principle III). This makes praise structurally impossible: no issues ⟺ a clean 100.
- The contract MUST stay language-agnostic. Language-specific logic (TS, etc.) lives *inside* individual rules, never in the interface.
- A score is computed from issues — never from one monolithic prompt that "vibes a number."
- Changing the contract's shape is a MAJOR governance event (see Governance). New rules are not.

### II. Determinism Where It's Achievable, Judgment Where It Isn't
The mix of static and LLM rules is a property of the *target*, not a fallback ranking — both kinds run and compose into one score.
- **Code (files, tasks) leans deterministic:** linters, AST checks, type checks, coverage — repeatable scripts carry the score. This is where the name *Deterministic* is most literal.
- **Tickets lean on judgment:** an LLM evaluates what no script can — is the intent legible, is the scope coherent, *how good* is the Definition of Done.
- **Static and LLM are complementary, not alternatives.** One concern often needs both: a static rule checks a ticket *has* a Definition of Done (present/absent, no model needed); an LLM rule judges the *quality* of that DoD. Both are real signals on the same target.
- An LLM is REQUIRED — judgment rules are never silently skipped. A run with no model configured (local or remote) is an error, not a degraded pass.

### III. The Score Is Derived From Issues
No black-box numbers, and no praise.
- A file starts at 100; each issue subtracts a penalty by severity (`info −1, minor −3, major −9, critical −27`). `score = max(0, 100 − Σ penalties)`. No issues → 100.
- This is NOT an average: passing rules contribute nothing, so the score is invariant to how many rules ran and a serious issue dominates rather than being diluted.
- Every point lost MUST map to a named issue with a concrete `fix`. If a rule can't name a fix, it has no business deducting. "Measured, not assumed" is literal.

### IV. Annotations Compose Up
The file is the atomic scoring unit. Repo and ticket scores are composites.
- Repo/ticket scores MUST be composed from persisted file annotations plus target-level traits — never by re-reading the whole tree.
- Scoring MUST be incremental: touch a file → re-annotate that one file → higher-level scores update cheaply. No O(whole-repo) runs.

### V. Local-First — but an LLM Is Always Required
An LLM is mandatory (scoring always uses judgment), so a model must always be reachable. Local is the default, not the only option.
- The default is a local LLM (Ollama, `localhost:11434`): zero-permission, no keys, no data leaving the laptop — the adoption wedge.
- If no local model is available, the user MUST provide an LLM API (endpoint + key). The tool fails fast with a clear message when neither is configured; it never scores without judgment.
- CI integration (GitLab/GitHub) is an OPTIONAL enhancement. Core value MUST work locally before any CI is wired.

### VI. Trust the Model's Output Only After Validation (NON-NEGOTIABLE)
Local models emit flakier JSON than a frontier API.
- Every LLM rule output MUST be validated against a Zod schema before use, with validate-and-retry on failure.
- A malformed model response MUST degrade gracefully (neutral signal), never crash a run or poison a score.

## Technology Constraints (locked)

- **Language/runtime:** TypeScript, Node 18+, ESM (NodeNext).
- **Agent orchestration:** Mastra.
- **LLM (required):** default is a local model — Ollama serving **Gemma 4** (Google's open model; top-scoring open weights and efficient enough to run on modest hardware) at `localhost:11434`. Fallback is a user-provided LLM API (endpoint + key) when no local model is available. Used by LLM rules; static rules need no model.
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

### Amendment log
- **v2.0.0 (2026-06-21)** — Rule contract changed from `run() → { score, weight, reasoning }` to `run() → { issues: [{ problem, fix, severity }] }`. *Rationale:* a rule returning a score-plus-reasoning produced meaningless near-perfect praise (e.g. `98 — "crystal clear"`), which is noise, not signal. Rules now emit only fixable issues; the engine derives the score by penalty subtraction (Principle III). *Migration:* every rule returns `{ issues }` instead of `{ score, weight, reasoning }`; per-rule `weight` is removed (importance now lives in per-issue `severity`); annotations carry the issue list, not a score breakdown; no timestamp.

**Version**: 2.0.0 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-21

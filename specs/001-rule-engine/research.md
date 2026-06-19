# Phase 0 — Research & Decisions: Rule Engine (Lane 0)

Resolves the unknowns flagged in the spec and plan. Each decision records the choice, rationale, and rejected alternatives.

## D1. Model resolution (Principle V — LLM required)

**Decision**: A single `resolveModel()` runs before any scoring and returns a `ModelClient` or throws:
1. If a local Ollama is reachable at `OLLAMA_HOST` (default `http://localhost:11434`) and the configured model is present → use it.
2. Else if a user LLM API is configured (`DETERMINISTIC_LLM_API_URL` + `DETERMINISTIC_LLM_API_KEY`) → use it.
3. Else → throw an actionable error ("No LLM configured: start Ollama or set DETERMINISTIC_LLM_API_*"). Never produce a judgment-free score presented as complete.

**Rationale**: Constitution V — judgment is integral, local is the default wedge, but an LLM is mandatory. Fail fast beats a silently partial score.

**Rejected**: Skip LLM rules when no model (violates V — the bug we corrected in the constitution); require an API always (kills the zero-permission local wedge).

## D2. Annotation storage — committed vs CI metadata (open question)

**Decision (Lane 0 default)**: Local JSON store at `.deterministic/annotations.json`, **git-ignored** for now. The schema and store API are stable; *where* annotations ultimately live (committed in-repo vs. CI artifact) is owned by the DevOps lane (Lane 4) and does not change the schema.

**Rationale**: Lane 0 must not block on a workflow decision. Keeping the store ignored avoids churn/merge-noise during the hackathon while the format is exercised. Switching to committed later is a `.gitignore` change, not a schema change.

**Rejected**: Commit annotations now (premature; noisy diffs while format settles); CI-only metadata (breaks local-first — Principle V).

## D3. Reviewer agents — how much to build in Lane 0

**Decision**: Lane 0 ships the `ModelClient` seam and a **single reviewer path** for LLM rules (one model call per LLM rule, validated). The full multi-perspective panel (Scout → Architect/Implementation/PM → Arbitrator agent) is defined as interfaces in `agents/roles.ts` and staged for the multi-agent lane. The pure-function `arbitrate()` already covers static aggregation.

**Rationale**: The keystone must run end-to-end and unblock rule authoring today. Multi-agent richness is rubric-valuable but additive — it slots behind the same contract without reshaping it.

**Rejected**: Build the full agent panel now (delays the unblocking keystone; high risk before the contract is proven).

## D4. Mastra usage in Lane 0

**Decision**: Keep Mastra at the edge. LLM rules talk to a thin `ModelClient` (Ollama HTTP / API). Mastra agent orchestration is wired when the reviewer panel lands (D3), behind the same `ModelClient`/role interfaces.

**Rationale**: Minimize moving parts in the keystone; prove parseable local-model JSON first. Stack stays "locked" — Mastra is still the orchestration layer, just introduced with the agents that need it.

## D5. Score composition (Arbitrator)

**Decision**: Transparent **weighted average** of signals (config weight overrides rule self-weight), output enumerating every signal. The `arbitrate()` function is the seam where future strategies (veto, multi-reviewer reconciliation) plug in without changing callers.

**Rationale**: Principle III (auditable) and simplicity. The "average vs. weighted vs. veto" question is answered by the Arbitrator being the single swap point.

## D6. Testing the LLM path deterministically

**Decision**: `ModelClient` is an interface; tests inject a **stub client** returning canned JSON, so LLM-rule logic (prompt → validate-and-retry → signal) is tested without a live model. Static rules are tested directly (pure functions).

**Rationale**: Determinism in CI/local tests; Principle VI (validate-and-retry) is itself unit-testable by feeding malformed responses to the stub.

## Resolved unknowns

All `NEEDS CLARIFICATION` from Technical Context are resolved: model resolution (D1), storage (D2), agent scope (D3), Mastra scope (D4), composition (D5), testing (D6).

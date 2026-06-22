# Feature Specification: Agentic Execution Rules

**Feature Branch**: `002-agentic-execution-rules` · **Created**: 2026-06-22 · **Status**: Draft

**Input**: "Rules that need to RUN a tool (coverage, complexity, security…) where an agent decides which tool fits the repo, runs it, interprets the output, and emits banded issues — language-agnostic, without hardcoding per-tool parsers."

## Why
Some signals can't be read statically — they're produced by *running* a tool: real coverage %, cyclomatic complexity, `npm audit`, bundle size. And the *right* tool differs by repo (c8 vs `pytest --cov` vs `go test -cover`). A static rule would need a parser per tool per language. An **agent** can instead inspect the repo, pick the tool, run it, read the output, and emit issues — generalizing across ecosystems. This is the third rule tier (static · llm · **agentic**) and where the agent framework genuinely earns its place.

## User Scenarios

### US1 — Coverage on any repo (P1)
Point Deterministic at a JS *or* Python *or* Go repo with no coverage report on disk. With execution enabled, an agent figures out the coverage command, runs it, reads the %, and emits a banded issue. **Independent test:** on a repo with a known coverage tool, the rule produces a band matching the actual %.

### US2 — Safe by default (P1)
Execution is **opt-in**. With it off (default), agentic execution rules do nothing dangerous — they stay silent or use a read-only fast path. **Independent test:** with execution disabled, no command runs.

### US3 — Deterministic measurement (P2)
Re-running produces the same band for unchanged code. The agent's *choice* of command is pinned/cached so the path is stable; the *measurement* (the %) is reproducible. **Independent test:** two runs on unchanged code → same issue.

## Requirements

- **FR-001**: A `safeExec` capability runs a command only if its executable is on an **allowlist** (npm, npx, node, c8, nyc, pytest, python, go, eslint, …), **rejects shell metacharacters** (`; | & $ \` > <` …), enforces a **hard timeout**, runs in the repo dir, and **never throws** (returns `{ok, stdout, code}`).
- **FR-002**: Execution is gated by `settings.execution.enabled` (**default false**). Disabled → execution rules do not run commands.
- **FR-003**: The agentic coverage rule MUST: read an existing coverage report if present (fast, no exec); else, with execution enabled + a model, ask the agent for the coverage command, validate it via `safeExec`'s allowlist, run it, interpret the output for the line %, and emit a banded issue.
- **FR-004**: Coverage severity bands: `100 none · 90–99 info · 80–89 minor · 70–79 major · <70 critical`.
- **FR-005**: The agent's chosen command MUST be cached (e.g. in the index/config) so subsequent runs reuse it — determinism of the path.
- **FR-006**: Agentic execution rules run only on `init` / `validate` (NOT every `score repo`) — they're expensive.
- **FR-007**: Coexists with the static `coverage-threshold` (#71): if a report exists, the static/fast path owns it; the agent only runs when discovery is needed. No double-count.
- **FR-008**: A malformed agent response or a failed command degrades to **no issue** (never crash, never fabricate).
- **FR-009 (staleness)**: A coverage report is **stale** if any tracked code file was modified after it was generated (mtime). A stale report's number MUST NOT be trusted. The two coverage rules partition by execution mode: **execution OFF** → the static rule bands a *fresh* report and *flags* a stale one ("re-run coverage"); **execution ON** → the agentic rule uses a fresh report as-is and **re-runs** when the report is stale or absent. Exactly one fires in each mode (no double-count).

## Key Entities
- **safeExec** — the sandboxed command runner (allowlist + timeout + no-throw).
- **Agentic rule** — a `Rule` (type `llm`) whose `run()` uses the model + `safeExec` in a decide→run→interpret loop.
- **Execution settings** — `{ enabled, timeoutMs, allowlist }`.

## Success Criteria
- **SC-001**: With execution off, zero commands run (verified).
- **SC-002**: `safeExec` refuses a non-allowlisted executable and anything with shell metacharacters, and times out a hung command.
- **SC-003**: On our own repo, the agentic coverage rule yields the same band as the static one (~info at ~92%).
- **SC-004**: Adding a new agentic execution rule (e.g. complexity) reuses `safeExec` with no new infra.

## Assumptions
- Determinism is about the *measurement*, not the discovery; pinning the command makes the path stable too.
- A 2-step model+exec loop is hand-rollable now; richer multi-agent panels (the architect/testing-expert reviewers, #72) are the Mastra upgrade on the same foundation.
- Safety posture: opt-in, allowlist, timeout, no shell. The allowlist is the hard boundary.

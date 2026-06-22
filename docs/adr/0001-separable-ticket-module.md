# ADR 0001 — Separable ticket-scoring module

**Status:** Accepted · **Date:** 2026-06-22

## Context
Deterministic has two kinds of scoring with different homes:
- **Code scoring** (file + repo) runs on the **developer's machine** (and CI), against source files.
- **Ticket scoring** runs in **CI / a GitHub Action / a webhook** — when an issue is created or updated, score it and post back.

They share an engine (the rule contract, penalty scoring, the LLM-rule scaffold,
the model client) but otherwise serve different surfaces, inputs, and runtimes.
We want the option to later ship them as **two separate tools with independent
deployments** — without a painful untangling.

## Decision
Split the codebase into three modules with a **hard peer boundary**:

```
src/core/     shared kernel — contract, scoring, llm-rule scaffold, model, pool, orchestrator, comment-style
src/code/     CODE scoring (dev machine): init, score-repo, score-file; file rules; annotation; index; git
src/ticket/   TICKET scoring (CI/action): score-ticket; ticket rules; ticket input/output
src/cli.ts    thin umbrella — the ONLY place code + ticket are composed
```

**The rule (enforced, not just convention):**
- `src/code/**` MUST NOT import `src/ticket/**`, and vice-versa — in *either* direction.
- Both MAY import `src/core/**` only.
- Anything shared between code and ticket lives in `core` (never reached across).
- `src/cli.ts` may import both; it is the composition root and is *discardable* on a split.

## Enforcement
A boundary check runs in **CI and fails the pipeline** on any `code ↔ ticket`
import. Start with a small in-repo script (zero deps); `dependency-cruiser` is a
drop-in upgrade if we want a battle-tested tool. (A dogfooded
`static/module-boundary` Deterministic rule is a nice-to-have, not the sole gate.)

## Consequences
- **Splitting later is a lift, not surgery:** move `src/ticket/` + `src/core/` into their own package/repo, give it its own entrypoint and deployment, drop the umbrella CLI. No detangling.
- **Discipline cost:** shared logic must be promoted to `core` rather than imported across the boundary. This is healthy — it keeps `core` honest and the modules thin.
- **End-state:** when we do split, the natural shape is npm workspaces — `packages/core | code | ticket` — where module resolution makes a cross-import impossible. Until then, the directory boundary + CI check is sufficient.

## Alternatives considered
- **One monolith** — rejected; the whole point is a cheap future split.
- **npm workspaces now** — deferred; heavier restructure than warranted before we actually ship two tools. The directory boundary + CI check buys the same guarantee for now.

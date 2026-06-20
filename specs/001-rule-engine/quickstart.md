# Quickstart — Rule Engine (Lane 0)

## Prerequisites
- Node 18+ (npm ships with it)
- A model (Principle V — required):
  - **Local (default):** Ollama running with `qwen3-coder` → `ollama serve` / `brew services start ollama`, then `ollama pull qwen3-coder`
  - **or** set `DETERMINISTIC_LLM_API_URL` + `DETERMINISTIC_LLM_API_KEY`

## Public commands
```bash
deterministic init                      # first run: score & annotate the whole repo (expensive)
deterministic score repo                # recompute the repo score (cheap, incremental)
deterministic score ticket <path>       # score a ticket
deterministic validate ticket <path>    # run tests/checks + re-score touched files → confirm done
```
File scoring is the **internal atomic unit** these compose — not a public command. (`init`, `score repo`, and `validate` all score files internally.)

## Run the keystone (Lane 0)
The public commands above are Lanes 1–3 (stubs for now). The Lane 0 engine is exercised via the internal/dev `file` command:
```bash
npm install
npm run deterministic file src/core/orchestrator.ts
```
Expected: a `0–100` score and a per-rule breakdown (id, weight, reasoning), plus a `@deterministic` comment block written **into the scored file itself** (native comment syntax) so the next agent reads its standing inline.

```text
  src/core/orchestrator.ts  →  91/100
   • [static/file-length] 100/100 (w1)  55 lines — within the 300-line soft cap.
   • [static/missing-types] 100/100 (w2)  No `any` annotations.
   • [llm/intent-legibility] 78/100 (w3)  Clear role; dispatch branch could use a comment.
```

When an LLM rule is configured but **no model** is available, the run exits with an actionable error (never a judgment-free score).

## Add a rule (the main parallel activity)
1. Create `src/rules/static/<name>.ts` (or `llm/<name>.ts`) exporting a `Rule` (see [contracts/rule-contract.md](./contracts/rule-contract.md)).
2. Register it with a weight in `deterministic.config.ts`.
3. `npm run deterministic file <file>` and confirm your rule's signal appears.

A static rule is a pure function of `RuleContext`. An LLM rule uses `ctx.model` and validates output with Zod + retry.

## Verify (acceptance)
- Score is reproducible for static rules across runs (SC-001/-002).
- Removing the model → clear error (SC-004).
- Adding a rule touches only a rule file + config, no engine edits (SC-003).

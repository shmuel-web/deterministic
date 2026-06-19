# Quickstart — Rule Engine (Lane 0)

## Prerequisites
- Node 18+ and pnpm
- A model (Principle V — required):
  - **Local (default):** Ollama running with `qwen3-coder` → `ollama serve` / `brew services start ollama`, then `ollama pull qwen3-coder`
  - **or** set `DETERMINISTIC_LLM_API_URL` + `DETERMINISTIC_LLM_API_KEY`

## Run
```bash
pnpm install
pnpm deterministic score-file src/core/orchestrator.ts
```
Expected: a `0–100` score and a per-rule breakdown (id, weight, reasoning), plus an annotation written to `.deterministic/annotations.json`.

```text
  src/core/orchestrator.ts  →  91/100
   • [static/file-length] 100/100 (w1)  55 lines — within the 300-line soft cap.
   • [static/missing-types] 100/100 (w2)  No `any` annotations.
   • [llm/intent-legibility] 78/100 (w3)  Clear role; dispatch branch could use a comment.
```

With **no model configured**, the command exits with an actionable error (never a judgment-free score).

## Add a rule (the main parallel activity)
1. Create `src/rules/static/<name>.ts` (or `llm/<name>.ts`) exporting a `Rule` (see [contracts/rule-contract.md](./contracts/rule-contract.md)).
2. Register it with a weight in `deterministic.config.ts`.
3. `pnpm deterministic score-file <file>` and confirm your rule's signal appears.

A static rule is a pure function of `RuleContext`. An LLM rule uses `ctx.model` and validates output with Zod + retry.

## Verify (acceptance)
- Score is reproducible for static rules across runs (SC-001/-002).
- Removing the model → clear error (SC-004).
- Adding a rule touches only a rule file + config, no engine edits (SC-003).

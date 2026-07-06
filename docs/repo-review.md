# Agentic repo-review panel (#72)

The JUDGMENT tier of repo scoring: expert **personas** review the project as a
whole and emit scoped, fixable issues — the place where multi-agent orchestration
(and Mastra) earns its keep, unlike presence/execution rules which are a single
prompt or a single command.

## Shape — Scout → Reviewers → Arbitrator

```
Scout ──► assembled repo context (structure, key configs, prior findings)
            │  one shared picture, gathered once, no model
            ▼
Reviewers ─► Architect      (cohesion, coupling, module boundaries, maintainability)
            Testing-expert  (test strategy, what's untested that matters)
            │  each a bounded LENS with explicit non-goals, model-judged
            ▼
Arbitrator ► validate (frozen contract) · cap severity · attribute `repo-review/<persona>`
            · dedupe the same gap raised by two personas
            ▼
          reconciled issues  →  the repo issue list
```

Files: `src/rules/repo-review/` — `scout.ts`, `reviewers.ts`, `arbitrator.ts`,
`panel.ts` (hand-rolled orchestration), `mastra-panel.ts` (Mastra orchestration),
`rule.ts` (the registered, opt-in rule).

## Two orchestrators, same pieces

- **Hand-rolled** (`reviewRepo`, default) — a `ModelClient`-injected loop. The
  offline test path and the zero-extra-dependency default.
- **Mastra** (`reviewRepoWithMastra`, opt-in) — each persona is a Mastra `Agent`;
  the model is local Ollama via its OpenAI-compatible endpoint (`/v1`), so no keys
  and nothing leaves the box (Principle V). This is the "Mastra earns its
  place" path. The Scout/Reviewer/Arbitrator boundaries are identical, so the two
  are interchangeable.

## Opt-in (it's the expensive tier — OFF by default)

```ts
// src/core/settings.ts
repoReview: {
  enabled: false,    // turn the panel on
  useMastra: false,  // true → Mastra orchestration instead of the hand-rolled loop
}
```

When `enabled` is false the registered rule (`static/repo-review-panel`) is silent
and resolves no model. When on, it resolves the **deep** model tier and runs the
panel on `init` / `score repo`. Like every judgment rule: no model → a clean pass,
never a crash, never a fabricated issue.

## Connect / run it

```bash
# local model (default)
ollama serve            # + a deep model, e.g. gemma4
# then flip settings.repoReview.enabled = true (and useMastra = true for the Mastra path)
npm run deterministic -- init
```

## Why agentic here (and not for file/presence rules)

Multiple personas + shared-context gathering + reconciliation is real
orchestration, not a single prompt. Presence rules answer from a file read;
execution rules run one command; only whole-repo judgment needs distinct expert
lenses argued and reconciled. Extend the panel by adding a persona to
`REPO_PANEL` — the Scout and Arbitrator scale unchanged.

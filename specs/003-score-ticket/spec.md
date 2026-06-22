# Feature Specification: `score ticket` (Lane 2)

**Feature Branch**: `003-score-ticket` · **Created**: 2026-06-22 · **Status**: Draft

**Input**: "Score a ticket — is the task well-specified enough to act on, and how complex/risky is it given the files it would touch and the repo it lives in?"

## The core concept: scoring commands COMPOSE (a dependency chain)

The three scoring commands are **not independent** — they build on each other:

```
  file scoring (atomic)
       │  each file's score is written as an annotation + cached in the index
       ▼
  repo score   = aggregate of file scores  +  repo-level rules (tests/CI/coverage/…)
       │
       ▼
  ticket score = the ticket's OWN rules        (is it well-specified? — DoD, measurable, validation path)
               + its BLAST RADIUS              (the files it would change, inheriting their file scores)
               + the REPO state                (the repo score — is this a safe place to make the change?)
```

So **to score a ticket you must look at the repo score and at the files the ticket would need to change**:
- A **file score** feeds the **repo score**.
- The **repo score** *and* the **blast-radius file scores** together feed the **ticket score**.
- …but the ticket *also* has **its own rules** that score it independently of any code (specification quality).

"A ticket is as complex as the files it's going to touch." A perfectly-written ticket that touches a 600-line untested hotspot is still a risky ticket; a vague ticket that touches one clean file is risky for a different reason. The ticket score must reflect both.

## Two dimensions of a ticket score
1. **Specification quality** (the ticket's own rules) — can this even be acted on and verified? Missing DoD, unmeasurable goal, no validation path → the task isn't ready, regardless of the code.
2. **Execution risk** (the composition) — the blast-radius files' scores (complexity/health) weighted by the repo state (tests/coverage/CI). Touching fragile code in an unhealthy repo is high-risk to deliver.

## User Scenarios

### US1 — The bad-ticket roast (P1)
`score ticket "To the moon 🚀🌕💸"` → the ticket's own rules fire (no DoD, unmeasurable, no validation path) → **score near 0**, with quotable, specific reasons. The demo's opening hook. **Independent test:** a contentless ticket scores at/near 0 from spec-quality rules alone.

### US2 — Blast-radius complexity (P1)
A clear ticket ("add retry to `orchestrator.ts`") is scored *down* if its blast radius (the files it touches) is complex/risky — the ticket inherits those files' scores. **Independent test:** the same ticket scores lower when it targets a flagged file than a clean one.

### US3 — Repo-state weighting (P2)
The same ticket is riskier in a repo with no tests/coverage (you can't verify the change). The repo score weights the execution-risk dimension. **Independent test:** identical ticket + blast radius scores lower when the repo score is lower.

## Requirements

- **FR-001**: `deterministic score ticket <path>` scores a ticket and writes/prints its issues (annotation = HTML comment for markdown tickets).
- **FR-002 (own rules)**: The ticket's own rules run regardless of any code — `ticket-has-dod` (static), `dod-quality` (llm), `no-acceptance-criteria` (static), `unmeasurable-goal` (llm), `undefined-validation-path` (llm). These produce the **specification-quality** issues.
- **FR-003 (blast radius)**: The engine MUST resolve the ticket's **blast radius** — the files/modules it would change — and read those files' scores from the index (their annotations). A Scout does this resolution (read the ticket + repo, infer touched files). The ticket **inherits** the complexity of its blast radius.
- **FR-004 (composition / the dependency)**: The ticket score MUST be a function of: (a) its own-rule issues, (b) the blast-radius file scores, and (c) the repo score. This is the dependency chain `file → repo → ticket`; `score ticket` **consumes** outputs of `score repo` / file scoring.
- **FR-005 (runtime dependency)**: Because blast-radius analysis reads file scores from the index, `score ticket` depends on the repo having been scored (`init` / `score repo`). If the index is empty/stale, it MUST still produce the **specification-quality** score from the ticket's own rules, and clearly note that execution-risk was not assessed (degrade, don't fail).
- **FR-006**: Every issue keeps the frozen contract (`problem, fix, severity`); the score derives from penalties as everywhere else.

## Key Entities
- **Ticket** — the task description (a markdown file now; a GitLab/GitHub issue via an adapter later).
- **Blast radius** — the set of files/modules the ticket would change (resolved by the Scout).
- **Scout** — the agent that reads the ticket + repo and resolves the blast radius (and pulls those files' index scores).
- **Composition** — ticket score = own-rule issues ⊕ blast-radius file scores ⊕ repo score.

## Success Criteria
- **SC-001**: A contentless ticket scores near 0 from own-rule issues alone (US1).
- **SC-002**: The same ticket scores measurably lower when its blast radius is flagged files vs clean files (US2).
- **SC-003**: With an empty index, `score ticket` still returns a spec-quality score and notes execution-risk was skipped (FR-005).
- **SC-004**: The dependency is real and one-directional: file → repo → ticket; ticket scoring never re-scores files itself, it reads their cached scores.

## Assumptions
- Blast-radius resolution is a Scout (agentic) concern; it may start heuristic (filename/path matching from the ticket text) and grow into a full agent.
- Ticket input is a markdown file for v1; the GitLab/GitHub-issue input adapter is later (and is where the flywheel — issue created → score → post back — lives).
- `score ticket` lives in `src/ticket/` (the separable module, ADR-0001), depending only on `core`.

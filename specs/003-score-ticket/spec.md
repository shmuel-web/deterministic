# Feature Specification: `score ticket` (Lane 2)

**Feature Branch**: `003-score-ticket` · **Created**: 2026-06-22 · **Status**: Draft

**Input**: "Score a ticket — is the task well-specified enough to act on, and how complex/risky is it given the files it would touch?"

## The core concept: scoring commands COMPOSE (a dependency chain)

The three scoring commands are **not independent** — they build on each other:

```
  file scoring (atomic)
       │  each file's score is written as an annotation + cached in the index
       ▼
  ticket score =  average(BLAST-RADIUS file scores)   ← the BASE (the files it would change)
                − Σ(the ticket's OWN spec-quality penalties: DoD, measurable goal, validation path)
                clamped to [0, 100]
```

So **to score a ticket you must look at the files the ticket would need to change**:
- A **file score** is cached in the index by `init` / `score repo`.
- The **average of the blast-radius file scores** (the files the ticket touches) is the ticket's **base** — the ticket inherits the health of the code it will change.
- The ticket's **own rules** then subtract **spec-quality penalties** from that base.
- If no blast radius is resolved (empty/stale index, or the ticket names no files), the base is **100** and only spec-quality penalties apply (FR-005 — degrade, don't fail).

**Why average, and why not the repo score.** The base is the average of *only the touched files* — not the repo score. The repo score averages across the *whole* repo (mostly clean files), so it would dilute a ticket's risk *up* — "healthy repo, must be fine" — masking exactly what we want to surface. Averaging only the blast-radius files keeps the signal local without over-penalizing a wide blast radius of mildly-imperfect files (which `min` or sum-of-deficits would). The **repo score is intentionally NOT in the single-repo ticket math**; it is reserved for **multi-repo workflows** ("which repo is the safer place to make this change?").

"A ticket is as complex as the files it's going to touch." A perfectly-written ticket that touches a 600-line untested hotspot is still a risky ticket; a vague ticket that touches one clean file is risky for a different reason. The score reflects both.

## Two dimensions of a ticket score
1. **Specification quality** (the ticket's own rules) — can this even be acted on and verified? Missing DoD, unmeasurable goal, no validation path → the task isn't ready, regardless of the code. These are **penalties**.
2. **Execution risk** (the base) — the average score of the files in the ticket's blast radius. Touching fragile/complex code is high-risk to deliver, so the ticket inherits that code's health as its starting point.

## User Scenarios

### US1 — The bad-ticket roast (P1)
`score ticket "To the moon 🚀🌕💸"` → the ticket's own rules fire (no DoD, unmeasurable, no validation path) → **score near 0**, with quotable, specific reasons. The demo's opening hook. **Independent test:** a contentless ticket scores at/near 0 from spec-quality rules alone.

### US2 — Blast-radius complexity (P1)
A clear ticket ("add retry to `orchestrator.ts`") is scored *down* if its blast radius (the files it touches) is complex/risky — the ticket's **base** is the average of those files' scores. **Independent test:** the same well-specified ticket scores lower when it targets a flagged file than a clean one.

## Requirements

- **FR-001**: `deterministic score ticket <path>` scores a ticket and writes/prints its issues (annotation = HTML comment for markdown tickets).
- **FR-002 (own rules → penalties)**: The ticket's own rules run regardless of any code — `ticket-has-dod` (static), `unmeasurable-goal` (llm), `undefined-validation-path` (llm). These produce the **specification-quality** issues, whose penalties subtract from the base.
- **FR-003 (blast radius → base)**: The engine MUST resolve the ticket's **blast radius** — the files it would change — and read those files' scores from the index. A Scout does this resolution (read the ticket + repo, infer touched files). The ticket's **base** is the **average** of the blast-radius files' scores; the ticket inherits the health of the code it will change.
- **FR-004 (composition / the dependency)**: `ticket score = clamp(average(blast-radius file scores) − Σ(own-rule penalties), 0, 100)`. The base is the blast-radius average (100 if none resolved); own-rule penalties subtract from it. This is the dependency chain `file → ticket`; `score ticket` **consumes** cached file scores and never re-scores files. The **repo score is NOT part of this** (it averages the whole repo and would dilute the signal *up*); it is reserved for **multi-repo** "which repo is safer" workflows.
- **FR-005 (runtime dependency / degrade)**: Because the base reads file scores from the index, `score ticket` depends on the repo having been scored (`init` / `score repo`). If the index is empty/stale or no files are resolved, the base is **100** and only the spec-quality penalties apply, and it MUST clearly note that execution-risk was not assessed (degrade, don't fail).
- **FR-006**: Spec-quality issues keep the frozen contract (`problem, fix, severity`); penalties subtract as everywhere else. The base is the only place a non-100 starting point enters — and it is itself a composition of file scores that were each derived from issues.

## Key Entities
- **Ticket** — the task description (a markdown file now; a GitLab/GitHub issue via an adapter later).
- **Blast radius** — the set of files the ticket would change (resolved by the Scout).
- **Scout** — reads the ticket + repo and resolves the blast radius (and pulls those files' index scores). Heuristic first (filename/path/symbol matching), agentic later.
- **Composition** — `ticket score = clamp(avg(blast-radius file scores) − Σ(own-rule penalties), 0, 100)`. Base from code health; penalties from spec quality. Repo score excluded (multi-repo only).

## Success Criteria
- **SC-001**: A contentless ticket scores low from own-rule penalties alone (US1).
- **SC-002**: The same well-specified ticket scores measurably lower when its blast radius is flagged files vs clean files — i.e. the base moves (US2).
- **SC-003**: With an empty index (or no files resolved), `score ticket` uses base 100, returns a spec-quality-only score, and notes execution-risk was skipped (FR-005).
- **SC-004**: The dependency is real and one-directional: file → ticket; ticket scoring never re-scores files, it reads their cached scores. The repo score is not consulted in single-repo mode.

## Assumptions
- Blast-radius resolution is a Scout (agentic) concern; it may start heuristic (filename/path matching from the ticket text) and grow into a full agent.
- Ticket input is a markdown file for v1; the GitLab/GitHub-issue input adapter is later (and is where the flywheel — issue created → score → post back — lives).
- `score ticket` lives in `src/ticket/` (the separable module, ADR-0001), depending only on `core`.

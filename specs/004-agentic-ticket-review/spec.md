# Feature Specification: Agentic Ticket Review (the reviewer panel)

**Feature Branch**: `004-agentic-ticket-review` · **Created**: 2026-06-22 · **Status**: Draft

**Input**: "A panel of expert reviewers (Implementation Developer, Architect, QA, Lead PM) reads the ticket *and the blast-radius files the Scout found*, and flags the small, commonly-forgotten things that hurt delivery — a schema change with no migration, a feature flag with no cleanup, untested edge cases — but stays SILENT when there's nothing material. Their issues carry penalties like any rule; the judgment is just more abstract and file-grounded."

## Why
The highest-value omissions in a ticket — missing migration, missing FF cleanup, broken back-compat, untested edge cases — **cannot be found from the ticket text alone**. A text-only rule can't know a ticket "changes a schema"; a reviewer that *reads the files the change touches* can. This is the **agentic tier** (static · llm · agentic, building on spec 002) and the one place the agent framework (Mastra) genuinely earns its place: multi-agent orchestration over real file context.

It also **absorbs** the "focus rules" shortlist (edge-cases, tests-required, migration, rollback…) — those become reviewer *charters*, not separate rules.

## The hard problem: precision, not recall
An open "experts, find problems" panel is exactly what our scoped-rule discipline bans — an agreeable model pads issues to seem useful, and that is *worse than nothing* for a linter. The design goal is **silence by default**: a well-formed ticket must produce **zero** issues. The ticket is complete until a reviewer can *prove* a specific, material gap. There is no reward for finding something.

## The reviewers (charters — non-overlapping by construction)
Each persona is a bounded lens (the agentic analogue of a rule's single `topic`):

- **Implementation Developer** — *"Can this be built correctly from what's written + the code it touches?"* Concrete, code-level gaps grounded in the blast-radius files: an input/error/empty/null/timeout path the change must cover but the ticket ignores; a changed signature that breaks its callers in the touched files; missing config/env/secret the change needs; an unstated dependency/ordering between touched files. NOT system structure, test presence, or scope.
- **Architect** — *"Does this change fit the system safely?"* Systemic ripples the touched files imply: a schema/data-shape change with **no migration**; a feature flag added with **no cleanup/lifecycle**; broken **backward/forward compatibility** across a module/API boundary; a risky change with no **rollback/rollout**; data-integrity or cross-module impact the blast radius reveals. NOT line-level code, verification, or scope.
- **QA** — *"How do we know it's correct and done?"* Verification gaps grounded in the change: new behavior with **no test asked for**; edge/failure cases that must be verified but aren't called out; acceptance criteria not mapped to a checkable result; missing test data/fixtures; a regression surface validation doesn't touch. NOT whether the design is sound or how the code is written.
- **Lead PM** — *"Is this one right, shippable unit of work?"* Scope/readiness gaps: several **unrelated deliverables bundled** into one ticket (should split); the user/business **outcome unstated**; a cross-team or cross-ticket **dependency not linked**; user-facing impact with **no docs/comms/rollout** consideration. NOT technical detail.

Overlap (e.g. Developer "must handle empty input" vs QA "no test for empty input") is intentional and distinct (handling vs verification); the synthesizer dedups any true collisions.

## The funnel (how overshoot is prevented)
Every reviewer runs the same funnel; most proposed issues die in it:

1. **Applicability gate** (per reviewer, first, cheap). The reviewer answers *does my concern even apply to this ticket + these files?* If not → it produces nothing and does **not** look for gaps. (The migration reviewer on a docs-only ticket stops here.) An agent that doesn't run can't invent.
2. **Evidence + materiality bar** (the draft). An issue counts only if it (a) **cites a specific file/fact** from the Scout's blast radius, AND (b) is **material** — *would skipping it cause a bug, a broken deploy, or a failed validation?* Nice-to-haves and ungrounded opinions fail by construction.
3. **Adversarial defense** (the killer). Every drafted issue is challenged by a **Defender** that argues the ticket is fine — "already implied / out of scope / handled elsewhere / a matter of taste." An issue survives only if it beats the defense.
4. **Synthesize + dedup**. Survivors are deduped across reviewers, capped at **info/minor**, and pruned with a bias toward fewer. **Zero survivors → the panel contributes no penalty** — the silence we want.

## User Scenarios

### US1 — Silence on a good ticket (P1, the precision test)
A well-specified ticket whose blast radius is clean runs the full panel → **zero issues**. The panel adds nothing it can't justify. **Independent test:** the `good-ticket` fixture → empty panel output.

### US2 — The file-grounded catch (P1, the value test)
A ticket changes a feature-flag enum / DB schema in a blast-radius file but never mentions a migration → the **Architect** raises exactly that, **citing the file**, at minor. **Independent test:** a ticket whose blast radius contains such a change yields one Architect issue naming the file.

### US3 — Defender suppresses overshoot (P2)
A reviewer drafts a soft "consider adding metrics" with no material impact → the Defender refutes it → it does not appear. **Independent test:** issue count on good tickets is 0 with the defense pass; removing it lets soft issues through.

## Requirements

- **FR-001 (one rule, same contract)**: The panel is **one agentic Rule** (`target: ticket`, type `llm`). It returns pooled `{problem, fix, severity}` issues that compose into the existing `base − penalties` model (spec 003). The orchestrator and score model do not change.
- **FR-002 (four reviewers)**: The panel runs four scoped personas — Implementation Developer, Architect, QA, Lead PM — with the charters above. Charters are the extension point for adding reviewers later.
- **FR-003 (silence by default)**: The panel's default output is **zero** issues. An issue exists only if it clears the full funnel. The prompts must frame "nothing to report" as the expected, common, unrewarded outcome (constitution Principle VI: never invent issues, never praise).
- **FR-004 (applicability gate)**: Each reviewer first determines whether its concern applies to this ticket + files; if not, it emits nothing and skips gap-finding.
- **FR-005 (evidence + materiality)**: Every issue MUST cite a specific blast-radius file/fact AND be material (skipping it causes a bug / broken deploy / failed validation). Ungrounded or non-material drafts are dropped.
- **FR-006 (adversarial defense)**: Every drafted issue is challenged by a Defender arguing the ticket is complete; only survivors are kept.
- **FR-007 (synthesize/dedup/cap)**: Survivors are deduped across reviewers and capped at **info/minor**. Zero survivors → no penalty contributed.
- **FR-008 (file grounding via the Scout)**: The panel reads the **content** of the Scout's blast-radius files (spec 003). With no blast radius resolved, reviewers that require file evidence stay silent — the panel never fabricates grounding (degrade, don't fail).
- **FR-009 (determinism posture)**: Pinned model, fixed personas/prompts, runs **on-demand only** (`score ticket` / `validate ticket`, NOT every `score repo`). The *process* is deterministic; prose may vary; the info/minor cap bounds score variance.
- **FR-010 (Mastra)**: The panel is orchestrated with **Mastra** — the justified home for the agent framework. Single-prompt scoped rules stay non-Mastra.
- **FR-011 (cost honesty)**: The panel is the only multi-call tier (≈ 4 reviewers × gate+draft, + defense, + synthesize). It is expensive and gated to on-demand runs; this is stated, not hidden.

## Key Entities
- **Panel** — the agentic Rule that orchestrates the reviewers and funnel, returns pooled issues.
- **Reviewer** — a persona + charter (a bounded lens). Four to start.
- **Charter** — the reviewer's single concern and explicit non-goals (what it must NOT flag).
- **Applicability gate** — the per-reviewer "does this even apply?" check.
- **Defender** — the adversarial agent that argues the ticket is complete; issues must survive it.
- **Synthesizer** — pools, dedups, caps, prunes toward fewer.
- **Blast radius** — the Scout's resolved files (spec 003); the panel reads their content.

## Success Criteria
- **SC-001 (precision)**: The `good-ticket` fixture → **zero** panel issues, repeatably (calibration regression test). A chatty model update fails this test.
- **SC-002 (value)**: A ticket whose blast radius contains an un-migrated schema/FF change → exactly one Architect issue, citing the file, at minor.
- **SC-003 (evidence)**: Every panel issue names a blast-radius file/fact and a concrete fix.
- **SC-004 (composition)**: Panel issues subtract from the blast-radius base via the existing penalty model; capped info/minor; no new scoring path.
- **SC-005 (degrade)**: With no blast radius, the panel emits no fabricated, ungrounded issues.

## Assumptions
- Reviewers read file **content** (read-only); **no command execution** (lower risk than spec 002's execution rules — reading, not running).
- Start with four personas; **Defender strictness** and **charter boundaries** are tunable — start strict (quiet) and loosen only if real gaps are missed.
- This refines the earlier "focus rules" idea (`edge-cases-unspecified`, `tests-not-required`, …) by absorbing them into charters — we do **not** build those as separate rules.
- Builds on the agentic tier established in spec 002; no constitution amendment required (adding a tier was already governed there).

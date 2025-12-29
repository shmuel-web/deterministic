# Scoring

## Intent

Deterministic computes a single **repository score** that reflects how
friendly and predictable a codebase is for AI agents.

The score is derived from:
- **file-level scores** (0–100 per file)
- **repo-level penalties**

This keeps local quality signals dominant, while allowing lightweight
repo-wide adjustments.

---

## File-level scoring

Each analyzed file receives a score between **0 and 100**.

File-level rules include (examples):
- file size
- function size
- documentation density
- other file-scoped rules

Each file score is computed independently.

---

## File-level aggregation

Let:

- `F = number of analyzed files`
- `S_i = score of file i`

The **base repository score** is the arithmetic mean:

base_score = (S_1 + S_2 + ... + S_F) / F


This ensures:
- large repos are not overly penalized
- no single file dominates the score
- improvements scale gradually

---

## Repo-level adjustments

After computing the base score, **repo-level rules** apply
small penalties.

Repo-level rules include (examples):
- README completeness
- agent feedback loop presence
- tooling signals

Repo-level rules are intentionally low impact.

Let:

- `P = total repo-level penalties`

---

## Final repository score

final_score = clamp(0, 100, base_score - P)

Where:
- `clamp(0, 100, x)` restricts the score to the range 0–100

---

## Design principles

- File-level quality dominates the score
- Repo-level rules adjust, but do not overpower
- All components are deterministic and reproducible
- No dynamic weighting or learning in v0

---

## Rationale

AI coding agents operate primarily at the file level.
Repo-level context matters, but should not outweigh local clarity.

This scoring model:
- encourages incremental improvement
- avoids large jumps
- remains explainable to developers and teams

---

## Status

Proposed (v0)
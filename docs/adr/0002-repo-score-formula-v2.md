# ADR 0002 — Repo-score formula v2 (worst-file dominant)

**Status:** Accepted · **Date:** 2026-06-24 · **Issue:** #66

## Context

A file's score is deliberately **not an average** — it's `100 − Σ penalty`, so one
serious issue dominates and passing checks can't inflate it. The README states this
as the product's core promise: *"It's not an average, so passing checks can't inflate
a score and one serious issue dominates."*

But the **repo** score (v1) contradicted that promise. It was:

```
repoScore = 100 − repoPenalty − (Σ per-file deficit / totalFiles)
```

The per-file part is an **average**. In a large tree it dilutes toward zero: a single
file with a critical issue (deficit 27) in a 1 000-file repo moves the headline by
`27/1000 ≈ 0` — it rounds away. The repo can show **99/100 while harbouring a
catastrophic file**. That is exactly the failure mode the file-level model was designed
to prevent, applied one level up. For a tool whose job is to answer *"is this repo safe
for an agent to act on?"*, hiding the worst file is the wrong default.

## Decision

Apply the file model **at repo scale**. The headline becomes **worst-file dominant**:

```
repoScore = 100 − repoPenalty − worstFileDeficit
            worstFileDeficit = max over flagged files of (100 − fileScore)   // 0 if all clean
```

- **repoPenalty** (absolute) is unchanged — repo-wide gaps like "no tests" / "no CI"
  still hit hard regardless of repo size.
- The averaged number is **kept, not discarded** — it's renamed **`repoHealth`** and
  surfaced as a *secondary* metric: "how broadly clean is the tree?"

So we report **two numbers with distinct meanings**:

| Number | Question it answers | Formula |
|--------|---------------------|---------|
| **score** (headline) | Is the repo safe to act on? Its *weakest link*. | `100 − repoPenalty − worstFileDeficit` |
| **health** (secondary) | How *broadly* clean is the tree? | `100 − repoPenalty − avgFileDeficit` |

The README badge and `DETERMINISTIC.md` headline use **score**; the dashboard prints
**health** and names the weakest file beside it, so breadth stays visible.

## Consequences

- **A critical file can no longer hide.** One bad file caps the repo score at that
  file's score — consistent with "one serious issue dominates" at every scale.
- **The headline drops for repos that were coasting on dilution.** This is intended:
  the number now reflects the real worst case, not an average that flatters scale.
- **Breadth is not lost** — it moved to `health`. A repo with 1 bad file and one with
  500 bad files share a headline but diverge sharply on health (and on the flagged-files
  list), so the dashboard still distinguishes them.
- **Count-invariance is preserved** where it matters: clean files never inflate either
  number, and adding files can't lift the headline above the worst file.

## Alternatives considered

- **Keep v1 (pure average)** — rejected: contradicts the stated thesis and hides
  critical files in large repos.
- **Percentile (e.g. p90 file score)** — more robust to a single outlier than the worst
  file, but it *reintroduces* the hiding problem (a lone critical file sits below p90 and
  vanishes). Rejected for the headline; could inform a future `health` refinement.
- **Weighted blend of health and worst** — tunable, but adds an opaque magic weight and
  muddies the meaning of the number. Rejected in favour of two clean, separately-named
  metrics.
- **Worst-file only, drop health** — rejected: breadth is genuinely useful signal; we
  keep it, just not as the headline.

# Deterministic

**A linter for AI coding agents.** Writing code is cheap now; shipping bad code still isn't. Deterministic scores the *task*, the *repo*, and the *execution* so AI-driven delivery is verifiable — not just fast.

It runs locally, leaves a small honest footprint in your files, and we build it with itself.

## The idea

Rules find **issues**; the engine derives the **score**. A rule never returns a number — it returns the problems it found, each with a concrete `fix` and a `severity`:

```
score = max(0, 100 − Σ penalty)      info −1 · minor −3 · major −9 · critical −27
```

No issues → 100. It's not an average, so passing checks can't inflate a score and one serious issue dominates. Every point lost maps to a named, fixable problem — and praise is structurally impossible.

## The loop

```bash
deterministic init            # first run: score & annotate the whole repo, build the index
deterministic score repo      # cheap: re-score only what git says changed
deterministic score ticket    # is this task well-specified enough to act on?   (coming)
deterministic validate ticket # after the agent: run checks + re-score the diff (coming)
```

## Where results live (the footprint is a guest)

- **In each file** — issues are written in as native-syntax comments, but *only when there's something to fix*. Clean files are left untouched.
- **On the README** — the repository score, one line (see below).
- **In `DETERMINISTIC.md`** — the full dashboard: repo-level issues and an index of every flagged file.

The mark appears only when it earns the room — minimal, removable, opt-out.

## Local-first

LLM rules run on a **local model by default** (Ollama + Gemma 4) — no API keys, no cloud, no data leaving your machine. A user-provided API is the fallback. Static rules need no model at all. See [`docs/local-llm.md`](docs/local-llm.md).

## Docs

- [`docs/architecture.md`](docs/architecture.md) — the one-page architecture
- [`docs/adr/0001-separable-ticket-module.md`](docs/adr/0001-separable-ticket-module.md) — why ticket scoring is a separable module
- `.specify/memory/constitution.md` — the project's principles

## Stack

TypeScript · Node 18+ · Zod · Ollama + Gemma 4 · git · spec-driven (Spec-Kit). MIT.

<!-- deterministic:start -->
> 🤖 This repo is linted for AI coding agents by **Deterministic** — repo score **99/100**. See [DETERMINISTIC.md](./DETERMINISTIC.md).
<!-- deterministic:end -->

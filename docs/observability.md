# Observability (dev) — tracing the agents

Deterministic runs real multi-step LLM workflows (the reviewer panel, the scoped
rules). In **development** you can trace every LLM call to a **self-hosted
Langfuse** to see exactly what the agents are doing. This is a dev aid — **never
shipped**, off by default, zero footprint when off.

## Setup
1. Bring up Langfuse: see [`dev/langfuse/README.md`](../dev/langfuse/README.md).
2. Put the keys + `DETERMINISTIC_DEV_TRACING=1` in `.env` (see `.env.example`).
3. Run a command that uses the LLM (e.g. `deterministic score ticket <path>` with the panel enabled).

## What you see
One **trace per scoring run**, with spans nested to mirror the workflow:
```
score ticket: <path>            (trace)
  ├─ Architect                  (span)
  │    ├─ gate        (generation: prompt, output, latency)
  │    ├─ draft       (generation)
  │    └─ defender    (generation)
  ├─ Developer
  ├─ QA
  └─ PM
```
Each generation records the prompt, the output, and latency — so the otherwise
opaque pipeline (which reviewer fired, what the gate decided, what the Defender
refuted) becomes legible, and per-call latency is measured for free.

## How it's wired (and why it's invisible when off)
- A pluggable **`TraceSink`** seam (`src/core/tracing.ts`). Langfuse is one impl,
  **dynamically imported only when tracing is on** — so the shipped tool never
  loads it and carries no dependency in its hot path.
- `resolveModel()` wraps each client with `traced()` — a no-op identity when off.
- Commands open a trace (`withTrace`); the panel opens a span per reviewer
  (`withSpan`); the model boundary records each call. Core rules stay unaware of
  Langfuse.

## Fail-closed (the deliberate part)
When `DETERMINISTIC_DEV_TRACING` is on and Langfuse is unreachable — at startup
**or** if a trace fails to flush — the process **fails**. In development we
observe every LLM call or we don't run; there are no silent, un-traced calls.
Unset the variable to run normally.

## Why a tool here (and not elsewhere)
We avoid frameworks we don't need — we *declined* Mastra because the funnel is
hand-rolled and works. But observability is a real, unmet need (otherwise
hand-rolled badly with throwaway scripts), and Langfuse — open-source,
self-hostable, OpenTelemetry-compatible — fits it cleanly. Same discipline both
times: **add a tool only when the need is real.** This is also the natural home
for the latency/token data we'd been measuring by hand, and for eval datasets
(the calibration harness) later.

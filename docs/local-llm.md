# Local LLM usage & performance

Deterministic's LLM rules run against a **local model by default** (constitution
Principle V): Ollama serving **Gemma 4** at `localhost:11434`. Static rules need
no model.

## Setup
```bash
brew install ollama
brew services start ollama        # or: ollama serve
ollama pull gemma4
```
No model? The tool falls back to a user-provided API (`DETERMINISTIC_LLM_API_URL`
+ `DETERMINISTIC_LLM_API_KEY`), and fails fast with a clear message if neither is
configured. Override the local model with `DETERMINISTIC_OLLAMA_MODEL`.

## Concurrency — two knobs, and they must agree
- **`DETERMINISTIC_CONCURRENCY`** (our app, default `4`) — how many files/LLM calls we dispatch at once, behind one shared limiter so we never flood the model.
- **`OLLAMA_NUM_PARALLEL`** (the server) — how many requests Ollama actually serves at once. **Unset by default → it often serves ~1**, so our app-side fan-out just queues. To set it, restart Ollama with the env (e.g. stop the brew service and run `OLLAMA_NUM_PARALLEL=4 ollama serve`).

## What we measured (be realistic)
On an M4 Pro / 48 GB with Gemma 4 (~3.3 GB resident):

| Setup | Result |
|---|---|
| One LLM call | **~22 s** |
| 38-file `init`, serial (`NUM_PARALLEL` unset) | ~13 min |
| 38-file `init`, `NUM_PARALLEL=4` + `CONCURRENCY=4` | **~9.5 min (~1.4×)** |

**Parallelism has a low ceiling here.** A single model on one GPU is compute-bound — four concurrent requests *share the same silicon*, so you get ~1.4×, not 4×. True N× would need N model instances / N GPUs (a server concern, not a laptop one).

## The levers that actually matter
1. **Incremental scoring (biggest win).** `init` is the only expensive run. After it, `score repo` re-scores **only the files git says changed** — usually a handful — so day-to-day cost is seconds, not minutes. Don't re-`init`.
2. **Per-call cost** (tracked in #64). Each call is ~22 s mostly because the model generates a lot; capping output (`num_predict`), trimming the content slice, or a smaller/faster model cuts this directly. ⚠️ Tune carefully — `format:"json"` cut latency ~10× but degraded the model's recall (it stopped finding real issues). Speed/quality tradeoff; measure quality, don't assume.
3. **Parallelism** (#63) helps modestly once `OLLAMA_NUM_PARALLEL` is raised — but it's the smallest lever of the three on a single-GPU laptop.

**Rule of thumb:** lean on incremental + per-call cost; treat parallelism as a minor top-up, not the answer.

## Measured findings (#85)
On gemma4 8B Q4, single Apple GPU:
- **Generation dominates.** Prompt processing is ~250–480 tok/s (~3 s); generation is **~6.7 tok/s** — a verbose issue is 700–1100 tokens → **~110–165 s per call**. Wall-clock ≈ tokens-generated ÷ throughput, so it's concurrency-independent on one GPU (8 parallel slots just *divide* the GPU; each call gets ~1/N).
- **Terser prompts help readability, not speed.** Forcing one-sentence problem/fix cut issue length from ~500+ to ~200 chars (and reduced count) — better annotations, and it lets the synthesizer dedup (#88). But it did **not** materially cut wall-clock; the model still "thinks" at length before emitting.
- **A hard output cap is a recall HAZARD, not a free speedup.** `num_predict: 600` truncated the still-verbose JSON mid-object → unparseable → **recall collapsed to zero** on gappy tickets (a 2-round calibration went green→all-fail). So the cap (`settings.llm.maxOutputTokens` / `DETERMINISTIC_MAX_OUTPUT_TOKENS`) is **off by default**; only enable it with headroom above the model's real output, or when you accept the trade.
- **The real per-call lever is a faster/smaller model (#86)**, not output tricks.

## Model tiering (#86)
Route each LLM call to an appropriately-sized model. Per-tier env vars, each
defaulting to the base model (`DETERMINISTIC_OLLAMA_MODEL`, gemma4) — so tiering
is a **no-op until you opt in**:
- `DETERMINISTIC_OLLAMA_MODEL_TINY` — booleans (the panel's applicability gate)
- `DETERMINISTIC_OLLAMA_MODEL_DEEP` — code-grounded judgment (the panel reviewers)
- `DETERMINISTIC_OLLAMA_MODEL_SCOPED` — reserved; scoped single-concern rules aren't routed yet.

**Benchmark — gemma4 8B vs gemma3:1b (warm):**

| call | gemma4 8B | gemma3:1b |
|---|---|---|
| gate (boolean) | 7.6 s / **336 tok** | ~0.5 s / **16 tok** |
| draft | 7.7 s / 345 tok | 0.5 s / 24 tok |

gemma3:1b is **~15× faster per warm call** and far more concise. (Each model pays a ~9 s **cold load** on first use.) Note gemma4 emits **336 tokens for a boolean gate** — it rambles; the gate is a prime candidate for a tiny model (or a capped boolean call — see #89).

⚠️ **Mixing models needs `OLLAMA_MAX_LOADED_MODELS ≥ 2`.** With the default (often 1), each tier switch *reloads* the model (~9 s) and thrashes — far slower than no tiering. Set it ≥ 2 and make sure both models fit in VRAM.

**Recommended opt-in (validate with `npm run calibrate` first):**
```bash
export OLLAMA_MAX_LOADED_MODELS=2
export DETERMINISTIC_OLLAMA_MODEL_TINY=gemma3:1b   # cheap, accurate boolean gate
# keep DEEP on gemma4 for judgment quality; try gemma3:4b for DEEP and re-run calibrate before trusting it
```

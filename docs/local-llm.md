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

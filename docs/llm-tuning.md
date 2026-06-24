# LLM tuning (#64)

Scoring spends almost all its wall-clock inside the LLM. This is the playbook for
making it faster **without losing recall** — and the harness that proves it.

## The two levers (and why only one is safe to assume)

### 1. Server concurrency — `OLLAMA_NUM_PARALLEL` (safe, do this)

Ollama serializes requests unless told otherwise. App-level fan-out (#63,
`DETERMINISTIC_CONCURRENCY`, default 4) gives **no speedup** until the server is
allowed to serve calls in parallel:

```bash
export OLLAMA_NUM_PARALLEL=4        # match DETERMINISTIC_CONCURRENCY
export DETERMINISTIC_CONCURRENCY=4
```

Keep the two numbers equal. On a typical laptop (M-series, ~10GB model) real
parallelism tops out around **4–8** before memory pressure makes it slower, not
faster. Raise both together and re-measure; don't exceed what the box can serve.

This lever changes *throughput*, not *output*, so it can't cost recall — set it.

### 2. Per-call shape — `format:json`, `num_predict` cap, `temperature:0` (measure first)

These cut a single call dramatically (~22s → ~1–6s in the #64 spike) but the same
spike showed them **suppressing real findings** — the model stopped flagging
obvious problems (meaningless names, missing docs). Speed bought with lost recall
is not a win. So this lever is **off by default** (`settings.llm.maxOutputTokens = 0`)
and must be justified per-knob with a measured before/after — never assumed.

Suspects, in order:
- `num_predict` too low → JSON truncates mid-object → unparseable → the issue is
  **lost entirely** (shows up as `parseFail` in the harness).
- `format:json` forcing immediate JSON → less room to "reason" → missed issues.
- `temperature:0` greedy decoding → can collapse to an empty list.

## The harness — `npm run bench:llm`

A fixture corpus of deliberately-**bad** files (cryptic names, no docs) and
**clean** files lives in `tests/perf/fixtures/legibility/`. The harness runs each
tuning variant over the corpus and reports, per variant:

- **recall** — fraction of bad files correctly flagged (the number that must not drop);
- **falsePos** — clean files wrongly flagged;
- **parseFail** — calls whose output didn't parse (the truncation hazard);
- **latency** — ms/call, and the speedup vs baseline.

```bash
# 1. start Ollama with gemma4 (or set DETERMINISTIC_LLM_API_URL + _KEY)
# 2. export OLLAMA_NUM_PARALLEL=4
npm run bench:llm
```

With no model the harness prints how to connect one and exits cleanly — the
measurement is the only piece that waits on Ollama. The logic (recall/latency
accounting) is unit-tested with a stub in `tests/unit/llm-tuning.test.ts`.

## The bar for shipping a tuning change

> Ship a variant **only if** its recall matches baseline (no regression) **and**
> `parseFail` is 0.

Variants are declared in `tests/perf/llm-tuning.ts` (`VARIANTS`) — add `keep_alive`,
content-slice trims, or a smaller tier model there and re-run to compare. The safe
speed lever remains a faster *model* (#86), not a tighter cap.

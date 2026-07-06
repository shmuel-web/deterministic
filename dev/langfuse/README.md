# Local Langfuse (dev tracing)

Self-hosted Langfuse for **development-only** LLM/agent tracing (#90) — watch what
the reviewer panel and the scoped rules do on your machine. Not part of the
shipped tool.

`docker-compose.yml` is Langfuse's official v3 self-host stack (pinned).
`docker-compose.override.yml` is our local layer: it **headless-provisions a
project + fixed dev keys** on first boot (no UI clicking), unpublishes the
backing services' host ports (only the web UI is exposed), and serves on **:7777**
(3000 is often taken by other local stacks).

## Bring it up
```bash
cd dev/langfuse
docker compose -p langfuse up -d        # auto-merges docker-compose.override.yml
```
Wait ~30s, then open **http://127.0.0.1:7777**.

> ⚠️ **Use `127.0.0.1`, not `localhost`.** On some machines an IPv6 loopback
> forwarder sits on `::1:7777` and hijacks `localhost:7777` (you'll get a
> CloudFront/`Unauthorized` 401 from AWS). `127.0.0.1` (IPv4) goes straight to the
> container. This applies to the browser **and** `LANGFUSE_HOST` in `.env`.

## Log in
The override provisions a user — log in with:
- **email:** `dev@deterministic.local`
- **password:** `deterministic-dev`

The project (`Deterministic`) and its API keys are pre-created. They're already in
`.env.example` — copy it to `.env` at the repo root:
```bash
cp ../../.env.example ../../.env     # already points at 127.0.0.1:7777 with the dev keys
```

## Use it
```bash
# from the repo root, with .env in place — every LLM call is traced
deterministic score repo
```
Open Langfuse → **Tracing** → one trace per run, nested `run → reviewer → call`.

## Persistence
Data lives in **named volumes** (`langfuse_postgres_data`, `langfuse_clickhouse_*`,
`langfuse_minio_data`). `docker compose down && up` keeps your traces; only
`docker compose down -v` wipes them.

## Fail-closed
When `DETERMINISTIC_DEV_TRACING` is on and Langfuse is unreachable, Deterministic
**refuses to run** — in dev you observe every LLM call or you don't run. Unset the
var to run normally.

## Note
The compose is Langfuse's official self-host (dev-only secrets, localhost only). If
a service fails to start, cross-check the current upstream:
https://langfuse.com/self-hosting/docker-compose

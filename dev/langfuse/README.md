# Local Langfuse (dev tracing)

Self-hosted Langfuse for **development-only** LLM/agent tracing (#90). It is *not*
part of the shipped tool — it's how you watch what the reviewer panel and the
scoped rules are doing on your machine.

## Bring it up
```bash
docker compose -f dev/langfuse/docker-compose.yml up -d
# wait ~30s, then open http://localhost:3000
```

## First-run setup (once)
1. Open http://localhost:3000 → create an account (local, no email needed).
2. Create a project.
3. **Settings → API Keys → Create** → copy the public + secret keys.
4. Put them in your `.env` (see `.env.example` at the repo root):
   ```
   DETERMINISTIC_DEV_TRACING=1
   LANGFUSE_HOST=http://localhost:3000
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```

## Use it
```bash
# with the panel enabled, score a ticket — every gate/draft/Defender call is traced
deterministic score ticket examples/tickets/panel-schema-no-migration.md
```
Open Langfuse → **Tracing** → you'll see one trace per run, nested `run → reviewer → call`.

## Persistence
Data lives in **named volumes** (`langfuse_postgres`, `langfuse_clickhouse_*`, `langfuse_minio`).
`docker compose down && up` keeps your traces; only `docker compose down -v` wipes them.

## Fail-closed contract
When `DETERMINISTIC_DEV_TRACING` is on and Langfuse is unreachable, Deterministic
**refuses to run** — in dev you observe every LLM call or you don't run. Turn it
off (unset the var) to run normally.

## Note
The compose here mirrors Langfuse's official self-host stack (v3) with dev-only
secrets, pinned for convenience. If a service fails to start, cross-check against
the current official compose: https://langfuse.com/self-hosting/docker-compose

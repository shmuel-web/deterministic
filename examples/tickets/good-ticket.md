# Add a `--json` output flag to `score ticket`

## Context
Editor/CI integrations need machine-readable output. Today `score ticket` prints
only human text, so a wrapper has to scrape stdout.

## Goal
`deterministic score ticket <path> --json` prints a single JSON object to stdout
and nothing else, so a caller can `JSON.parse` it without scraping.

## Definition of Done
- `--json` prints exactly one JSON object: `{ "path", "score", "issues": [{ "ruleId", "problem", "fix", "severity" }] }`.
- With `--json`, no human-formatted lines are written to stdout (the score banner/notes go to stderr or are suppressed).
- Without the flag, current human output is unchanged.
- Exit code stays 0 on a successful scoring run.

## Validation
- New test in `tests/unit/score-ticket.test.ts`: run with `--json`, assert stdout parses as JSON and matches the shape above.
- Existing `score-ticket` tests still pass (`npm test`).
- Manual: `deterministic score ticket examples/tickets/to-the-moon.md --json | jq .score`.

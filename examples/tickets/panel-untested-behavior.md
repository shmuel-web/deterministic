# Add a max-length guard to `safeExec` in `src/core/exec.ts`

## Context
A pathologically long command string can bloat logs and slow the allowlist check.

## Goal
`safeExec` should reject any command longer than 4096 characters before running it.

## Definition of Done
- `safeExec` returns `{ ok: false }` for a command over 4096 chars, without executing it.
- Commands at or under 4096 chars are unaffected.

<!-- Calibration expectation: FLAG by QA. A new behavior (length rejection) in a
     real file with NO test / validation called out — QA should ask for a test
     covering the new guard, citing src/core/exec.ts. -->

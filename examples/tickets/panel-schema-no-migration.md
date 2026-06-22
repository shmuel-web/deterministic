# Add a `lastModel` field to the persisted index in `src/core/index-store.ts`

## Context
We want the cached score index to record which model produced the scores.

## Goal
Add a `lastModel: string` field to the `RepoIndex` written to
`.deterministic/index.json` by `src/core/index-store.ts`.

## Definition of Done
- `RepoIndex` includes `lastModel`; `saveIndex` writes it; `loadIndex` reads it.
- A unit test asserts a save → load round-trip preserves `lastModel`.

## Validation
- `npm test` passes including the new round-trip test.

<!-- Calibration expectation: FLAG (Architect). This changes the on-disk shape of
     index.json, but existing index files predate the field — `loadIndex` needs
     a back-compat default. The Architect should catch the missing migration and
     cite src/core/index-store.ts. (Deliberately NO migration mentioned.) -->

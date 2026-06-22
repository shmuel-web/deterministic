# Add a unit test for the `score` penalty math in `src/core/score.ts`

## Context
`src/core/score.ts` derives a target's score by subtracting severity penalties
from 100. It's covered indirectly, but there's no direct unit test pinning the
penalty arithmetic.

## Goal
Add a focused unit test for `score()` so the penalty math is locked.

## Definition of Done
- A new test in `tests/unit/score.test.ts` asserts: no issues → 100; one `major` → 91; a `critical` floors at 73; the score never goes below 0.
- `npm test` passes.

## Validation
- `npm test` runs the new test green.

<!-- Calibration expectation: SILENT. A purely additive test, touching one
     healthy file with no schema/FF/compat/rollback implications — the panel
     should find nothing material. -->

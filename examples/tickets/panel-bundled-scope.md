# Add git-call retries, redesign the report output, and raise the coverage bar

## Goal
Three improvements in one go:
1. Wrap the git calls in `src/core/git.ts` with a retry.
2. Restyle the dashboard rendered by `src/core/report.ts`.
3. Raise the coverage threshold in `src/rules/static/coverage-threshold.ts`.

## Definition of Done
- git calls retry up to 3×.
- the report has the new layout.
- the coverage threshold is higher.

<!-- Calibration expectation: FLAG by PM. Three unrelated deliverables (resilience,
     UI, CI policy) bundled into one ticket — the PM should say split it. This is a
     scope concern about the TICKET, not a single file, so PM is ticket-grounded. -->

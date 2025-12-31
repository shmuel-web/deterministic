# Agent Feedback Loop

scope: repo

## what is measured

Whether the repository provides:

1. **Canonical check command** - a single command or script (e.g. `check`, `verify`) that validates changes after each iteration (tests, build, lint, etc.)

2. **Timeout enforcement** - logic that enforces a time limit and warns or fails when exceeded (may be in the script, config files, environment variables, or README)

---

## why this matters

AI agents need a deterministic feedback loop to iterate safely and efficiently. Without a single entry point, agents must guess which commands to run, potentially missing validation steps.

Timeout enforcement prevents long-running checks that:
- Increase token cost for AI agents
- Slow down iteration cycles
- Discourage frequent validation
- Signal poor test incrementality

Time-bounded feedback loops enable faster, more reliable iteration for both agents and developers.

---

## how it is measured

- Scan repository for check commands (common names: `check`, `verify`, `agent-check`)
- Look for timeout enforcement in:
  - Script logic
  - Configuration files
  - Environment variables
  - README documentation
- Does not measure actual runtime in v0

---

## scoring system

- Check command **missing**: **−10**
- Check command exists but **no timeout**: **−5**
- Check command exists **with timeout**: **0**


---

## status

v0

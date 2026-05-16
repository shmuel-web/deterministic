# Deterministic

> Deterministic engineering for AI agents.  
> Writing code is now cheap. Shipping bad code is still expensive.

## TL;DR

Deterministic is like a linter for AI coding agents.

It validates:
1. The task
2. The repository
3. The execution

The goal is to make AI-driven software delivery more deterministic, verifiable, and trustworthy.

---

## The Problem

AI agents can generate code extremely fast.

But fast code generation creates new problems:
- vague tasks
- shallow implementations
- missing edge cases
- broken workflows
- architectural drift
- false confidence

Most tools today answer:

> “Did the code compile?”

Deterministic asks:

> “Can this work actually be verified as complete?”

---

## What Deterministic Does

### 1. Validate Tasks

Detects:
- ambiguous requirements
- missing acceptance criteria
- non-measurable goals
- undefined validation paths

Example:

```md
Improve dashboard performance
```

↓

```txt
Missing:
- target latency
- measurement method
- browser/device scope
- regression validation
```

---

### 2. Validate Repositories

Analyzes:
- CI/CD
- test coverage
- architecture boundaries
- reproducibility
- automation maturity

Detects:
- missing E2E coverage
- flaky workflows
- weak validation systems
- unenforced architecture rules

---

### 3. Validate Agent Execution

Runs after an AI agent completes work.

Checks:
- tests
- linting
- type safety
- E2E flows
- architecture constraints
- validation coverage

Example:

```txt
Task incomplete.

Missing:
- mobile validation
- API contract verification
- loading-state coverage
```

---

## Example Workflow

```bash
deterministic analyze-ticket ./ticket.md

deterministic analyze-repo

codex run ./ticket.md

deterministic validate
```

---

## Vision

AI agents make code generation cheap.

Deterministic helps make software delivery trustworthy.

The future of software engineering is not just generating code faster.

It is building deterministic systems that can validate correctness, reliability, and completion automatically.

---

## Planned Features

- Task determinism scoring
- Repository determinism scoring
- AI-agent completion validation
- GitHub Action integration
- PR annotations
- Architecture linting
- Test strategy recommendations
- CI enforcement mode

---

## License

MIT

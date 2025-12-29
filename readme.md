# Deterministic

**Linter for the AI coding agent era**

Deterministic is a semantic linter that helps developers get better results from AI coding agents by making codebases more explicit, predictable, and readable for AI agents.

As AI agents increasingly write and modify code, the limiting factor is no longer the speed you can write code — it is the speed in which a human can validate the AI's work 
code projects are now optimizing for AI first development investing time and effort in
**improving context, reducing token costs, improving code clarity, adding code quality tools**.

Deterministic measures these properties statically and deterministically.

---

## What it does

- Analyzes a repository locally (no AI, no network calls)
- Measures information availability and explicit intent
- Flags hidden behavior, missing context, and ambiguity
- Produces a clear score and actionable findings
- Designed for local use and CI

---

## Scoring

Deterministic computes a single repository score (0-100) that reflects how friendly and predictable your codebase is for AI agents.

The score is based on:
- **File-level quality** (dominant factor)
- **Repo-level penalties** (lightweight adjustments)

See [scoring.md](scoring.md) for the complete algorithm and design rationale.

---

## What it is not

- Not a code formatter
- Not a style linter
- Not an AI code generator
- Not a SaaS (your code never leaves your machine)

---

## Core idea

While “good code” is subjective, there is no debate that AI coding agents need **explicit context**.

Deterministic measures quantities (documentation, structure, guardrails, conventions) to infer how approachable and safe a codebase is for AI-driven development.

our philosophy `quantity effects quality`
---

## Status

🚧 Early development / experimental

APIs, rules, and scoring may change.

---

## License

MIT

# Single Source of Agent Context

scope: repo

## what is measured

The presence of a single, explicit directory or location that serves as the canonical source of truth for all project-level rules, guidelines, and conventions intended for AI coding agents.

This includes optional but recommended structures: a constitution document defining non-negotiable rules, organized subdirectories for different rule types, and agent configuration files that reference (rather than duplicate) this source.

---

## why this matters

AI agents produce inconsistent results when context is scattered across READMEs, comments, and multiple configuration files. Agents receive conflicting guidance, changes require updates in multiple locations, and rule precedence becomes ambiguous.

A single source of agent context creates deterministic behavior by centralizing rules, establishing clear hierarchy, and ensuring all agents see identical guidance. This reduces cognitive load and improves iteration quality.

---

## how it is measured

- Existence of an explicit agent context directory (e.g. `context_modules/`, `ai_context/`, `docs/ai/`, `.ai/`)
- Presence of a constitution document within that directory
- Structured subdirectories containing `.md` files for rules, style guides, or conventions
- Agent-specific config files (`.cursor`, etc.) that reference the context source instead of duplicating rules

---

## scoring system

Base score: **100**

Penalties:
- No explicit single source of agent context: **−5 points**
- No constitution document: **−5 points**
- No structured subdirectories with organized `.md` files: **−5 points**
- Agent configs do not reference the context source: **−5 points**

Score range: 80–100

---

## status

v0


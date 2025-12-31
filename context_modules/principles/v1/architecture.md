# Architecture

## Core Principle

**Rules define "what" and "why" — Implementations define "how"**

- **Rules** (`/rules`) are language-agnostic specifications
- **Implementations** (`/implementations`) are language-specific analyzers
- Each implementation is independently published and versioned

---

## Directory Structure

```
deterministic/
├── rules/                      # Language-agnostic specifications
│   ├── 1-file-length.md
│   ├── 2-optimal-function-size.md
│   └── ...
│
├── spec/                       # Shared specifications
│   ├── output-format.json     # Standard JSON output
│   └── rule-schema.json       # Rule structure
│
├── implementations/            # Language-specific analyzers
│   ├── javascript/
│   ├── python/
│   ├── go/
│   └── rust/
│
└── principles/                 # Design documents
    └── v1/
        └── architecture.md
```

---

## Rules

Rules are specifications that define:
- What to measure
- Why it matters for AI agents
- Scoring thresholds
- High-level detection strategy (language-agnostic)

**Format:**
```markdown
# Rule Name
scope: file | repo

## what is measured
## why this matters
## how it is measured
## scoring system
## status
```

**Properties:**
- Language-agnostic
- Deterministic
- Versioned (v0, v1, etc.)

---

## Implementations

Language-specific analyzers that:
- Read rule specifications
- Parse source code
- Apply rules
- Output standard JSON format

**Independence:**
- Each implementation is a standalone package
- Independently versioned and published
- Example: `@deterministic/javascript`, `deterministic-py`

**Basic structure:**
```
implementations/<language>/
├── package.json | pyproject.toml | go.mod
├── README.md
├── src/
│   ├── analyzer.*
│   └── rules/
└── tests/
```

---

## Why This Architecture?

**Separation of concerns:**
- Rules = specifications (what to measure)
- Implementations = code (how to measure)

**Benefits:**
- Community can add new language implementations
- Rules stay consistent across languages
- Implementations evolve independently
- Users install only what they need

---

## Status

v1


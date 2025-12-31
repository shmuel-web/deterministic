# Type Information Availability

scope: repo

## what is measured

The presence and density of explicit type information in languages where types are optional.

Type information includes:
- Type system configuration files
- Type annotations in source code
- Type checking tool configuration
- Percentage of typed versus untyped code

---

## why this matters

AI coding agents rely heavily on type information to understand data flow, validate changes, and suggest correct code. Explicit types reduce ambiguity and enable agents to catch errors before execution.

In dynamically-typed languages, types serve as machine-readable documentation that improves both agent and developer confidence. Type information acts as guardrails, helping agents understand constraints and contracts without requiring execution or deep code analysis.

Projects with explicit type information see fewer type-related bugs, faster iteration cycles, and more accurate AI-generated code.

---

## how it is measured

Language-specific implementations detect type system adoption through:
- Type system configuration files (e.g., type checker configs)
- Source files with type annotations
- Presence of type-annotated versus plain source files
- Type checking tool installation and configuration

For statically-typed languages where types are mandatory, this rule does not apply.

---

## scoring system

This is a **repo-level penalty** applied only to dynamically-typed language projects.

**For projects in dynamically-typed languages:**
- Full type system adoption: **0 points**
- Partial type annotations or type checking: **−3 points**
- No type information: **−8 points**

**For statically-typed languages:**
- No penalty applied (types are enforced by the language)

```
score = 100 - penalty
```

The specific detection of "full," "partial," or "no" type adoption is language-specific and defined in each implementation.

---

## implementation notes

Language-specific implementations should detect:

**For dynamically-typed languages:**
- Type system configuration (e.g., TypeScript's `tsconfig.json`, Python's `mypy.ini`)
- Presence of type-annotated source files
- Inline type annotations (e.g., JSDoc, type hints)
- Ratio of typed to untyped code

**Categorization:**
- **Full adoption**: Type system configured, majority of code typed, type checker present
- **Partial adoption**: Some type annotations or type checking, but incomplete coverage
- **No type information**: No type system, no annotations, no type checking

**For statically-typed languages** (Go, Rust, Java, C#, C++, Kotlin, Swift):
- Return score of 100 (no penalty)
- Types are mandatory and enforced by the compiler

---

## status

v0


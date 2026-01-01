# Rule Style Guide

Guidelines for writing Deterministic rule specifications.

---

## Core Principle

**Rules must be short and to the point.**

Avoid long explanations, examples, or implementation details. Focus on the essential "what," "why," and "how much."

---

## Template Structure

Every rule follows this exact structure:

```markdown
# Rule Name

scope: file | repo

## what is measured

[Concrete, observable thing being measured]
[Keep factual and objective]
[2-3 sentences max]

---

## why this matters

[Why this affects AI agents and outcomes]
[Focus on: predictability, context, iteration quality]
[Use simple cause-effect statements]
[3-4 sentences max]

---

## how it is measured

[Brief detection strategy]
[Use bullets]
[No implementation details]
[No language-specific examples]

---

## scoring system

[Explicit penalties/bonuses]
[Use clear thresholds]
[Keep format simple]

---

## status

v0
```

---

## Writing Guidelines

### Section 1: what is measured

**Do:**
- State the observable metric
- Be factual and objective
- Keep it brief (2-3 sentences)

**Don't:**
- Explain why it matters (save for next section)
- Include implementation details
- Use subjective language

**Example:**
> Cyclomatic complexity and nesting depth of functions.
> 
> - Cyclomatic complexity: number of control flow paths
> - Nesting depth: maximum levels of nested control structures

---

### Section 2: why this matters

**Do:**
- Use simple cause-effect statements
- Focus on AI agent impact: predictability, context, iteration quality
- Keep it concrete and specific
- Lead with the core insight

**Don't:**
- Write long paragraphs
- List multiple bullet points
- Include research citations
- Over-explain edge cases

**Good example:**
> More structural complexity = more bugs.
> 
> Complex functions are harder to change because AI agents must reason about multiple execution paths simultaneously. Flat, simple functions are predictable and safer to modify.

**Bad example:**
> High structural complexity makes code unpredictable and difficult for AI agents to reason about. Complex functions with many control flow paths increase the cognitive load required to understand behavior, making it harder for agents to predict outcomes, generate modifications, identify edge cases, and refactor safely. Deep nesting compounds this problem...

---

### Section 3: how it is measured

**Do:**
- Use bullets
- Keep high-level
- State the detection strategy

**Don't:**
- Include language-specific details (e.g., "JavaScript uses..." or "Python's...")
- Provide implementation algorithms
- Show code examples
- List exhaustive edge cases

**Example:**
> - Count decision points in each function
> - Track maximum nesting depth
> - Apply penalties above thresholds

---

### Section 4: scoring system

**Do:**
- Use clear numeric thresholds
- Show explicit penalties/bonuses
- Keep format scannable (tables or lists)
- Include the final score calculation

**Don't:**
- Over-explain the math
- Include multiple examples
- Add rationale (that goes in "why this matters")

**Example:**
> **Complexity:**
> - ≤ 10: 0 points
> - 11-15: −2 points
> - > 15: −5 points
> 
> File score: 100 minus sum of penalties.

---

## Common Patterns

### Cause-Effect Statements

Lead with the core insight:
- "More X = more Y"
- "Less X = better Y"
- "Missing X increases Y"

Examples:
- "More structural complexity = more bugs"
- "Large files = higher token costs"
- "Missing tests = unpredictable refactoring"

### Avoiding Over-Explanation

**Bad (too long):**
> AI coding agents rely heavily on type information to understand data flow, validate changes, and suggest correct code. Explicit types reduce ambiguity and enable agents to catch errors before execution. In dynamically-typed languages, types serve as machine-readable documentation that improves both agent and developer confidence.

**Good (concise):**
> Type information reduces ambiguity. AI agents use types to validate changes and catch errors before execution.

---

## Length Targets

- **what is measured**: 2-3 sentences
- **why this matters**: 3-4 sentences
- **how it is measured**: 3-5 bullets
- **scoring system**: Simple list or table
- **Total rule length**: 30-50 lines

---

## Language-Agnostic Rules

Rules should NOT mention specific languages in core sections:

**Bad:**
> For JavaScript projects, check for `tsconfig.json`...

**Good:**
> Check for type system configuration files

Language-specific detection goes in implementations, not rule specs.

---

## Rationale

Short rules are:
- **Faster to read** - developers scan rules quickly
- **Easier to implement** - less ambiguity for implementers
- **More maintainable** - changes are obvious
- **More actionable** - clear what to measure and why

Long explanations, examples, and research citations belong in documentation, not rule specifications.

---

## Examples of Well-Formed Rules

See:
- `/rules/1-file-length.md` - clear thresholds, simple explanation
- `/rules/2-optimal-function-size.md` - concise cause-effect statement
- `/rules/10-structural-complexity.md` - short and to the point

---

## Status

v1




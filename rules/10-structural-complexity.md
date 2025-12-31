# Structural Complexity

scope: file

## what is measured

Cyclomatic complexity and nesting depth of functions.

- Cyclomatic complexity: number of control flow paths (if/else, loops, switches)
- Nesting depth: maximum levels of nested control structures

---

## why this matters

More structural complexity = more bugs.

Complex functions are harder to change because AI agents must reason about multiple execution paths and nested logic simultaneously. Deep nesting obscures logic flow. Flat, simple functions are predictable and safer to modify.

---

## how it is measured

- Count decision points in each function (if, else, loops, switches, logical operators)
- Track maximum nesting depth of control structures
- Apply penalties above thresholds

---

## scoring system

Progressive penalties per function. Higher complexity = steeper penalties.

**Cyclomatic Complexity:**
- ≤ 10: 0 points
- 11-15: −2 points
- 16-20: −5 points
- 21-25: −10 points
- 26-30: −20 points
- > 30: −40 points

**Nesting Depth:**
- ≤ 4: 0 points
- 5: −3 points
- 6: −6 points
- 7: −12 points
- 8: −24 points
- > 8: −50 points

File score: 100 minus sum of all penalties.

---

## status

v0


# File Length

scope: file

## what is measured

The number of non-empty lines in a file.

---

## why this matters

Large files increase cognitive load and token usage for AI coding agents.
Context cost grows non-linearly — above 300 lines, files become expensive for AI agents to reason about safely.
Progressive penalties encourage decomposition and maintainability.

---

## how it is measured

- Count non-empty lines only (lines where `trim(line).length > 0`)
- Generated and vendor files are excluded
- Let L = number of non-empty lines

---

## scoring system

Base score starts at 100 and decreases progressively:

**L ≤ 100 lines**
- score = 100

**101–200 lines**
- −1 point per 10 lines
- penalty = ceil((min(L,200) - 100) / 10)

**201–300 lines**
- −1 point per 5 lines
- penalty = ceil((min(L,300) - 200) / 5)

**301+ lines**
- −1 point per 2 lines
- penalty = ceil((L - 300) / 2)

Penalties are cumulative.

**Examples:**
| Lines | Score |
|------:|------:|
| 100   | 100   |
| 200   | 90    |
| 300   | 70    |
| 350   | 45    |
| 400   | 20    |

---

## status

v0

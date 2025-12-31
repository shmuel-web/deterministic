# Optimal Function Size

scope: file

## what is measured

The number of non-empty lines within each function body.
A function exceeding 20 non-empty lines is considered large.

---

## why this matters

Large functions reduce predictability for AI agents and developers. They typically handle multiple responsibilities, have higher complexity, and require more context to understand. Functions over 20 lines are harder to test, refactor safely, and review within a typical viewport. Keeping functions focused and concise improves iteration quality and reduces cognitive load.

---

## how it is measured

- Count non-empty lines only within each function body
- A line is non-empty if its trimmed length is greater than 0
- Function body starts after the signature/opening brace and ends at closing brace
- Comments within the function body count as lines
- Generated and vendor files are excluded

---

## scoring system

For each function with L non-empty lines:

- L ≤ 20: penalty = 0 points
- L > 20: penalty = 1 point per extra line beyond 20

Examples:
- 20 lines: 0 point penalty
- 30 lines: 10 point penalty
- 40 lines: 20 point penalty

File score calculation:

```
score = 100 - total_penalty
```

Where total_penalty is the sum of all function penalties in the file.

---

## status

v0

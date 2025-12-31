# README Context Penalty

scope: repo

## what is measured

Whether the README contains required sections that describe core lifecycle operations:
- **Install** - how to install dependencies
- **Build** - how to build/compile the project
- **Run** - how to run the application
- **Test** - how to run tests
- **Agent feedback loop** - how to validate changes after each iteration

Each missing section is counted as a penalty.

---

## why this matters

AI coding agents need explicit guidance on how to work with the codebase. The README is the primary entry point for this context.

Missing lifecycle sections increase ambiguity and iteration cost. Without clear instructions, agents must guess or ask, breaking flow and reducing reliability. The agent feedback loop is critical for autonomous validation.

Small, fixed penalties encourage completeness without over-weighting documentation.

---

## how it is measured

- Check for existence of `README.md` at repository root
- Scan content for references to each required section using keyword-based heuristics
- Section format and wording are not enforced
- If README is missing, all sections count as missing

---

## scoring system

Repository score starts at **100 points**.

For each missing section, apply a **−3 point penalty**.

```
score = 100 - (missing_sections × 3)
score = max(0, score)
```

Examples:
- 0 missing sections: 100 points
- 1 missing section: 97 points
- 3 missing sections: 91 points
- 5 missing sections: 85 points
- README missing (all 5 sections): 85 points

---

## status

v0


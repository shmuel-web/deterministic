# Documentation Density Per File

scope: file

## what is measured

The ratio of documentation/comment lines to total non-empty lines in each file.

- `C` = number of comment / documentation lines
- `N` = number of non-empty lines (code + comments)
- `doc_ratio = C / N`

Generated and vendor files are excluded.

---

## why this matters

AI coding agents rely on inline documentation as a primary source of context. Documentation density serves as a quantitative proxy for how much intent and explanation exists in the code.

By measuring per file, simple files can remain simple while complexity naturally encourages more context. This improves predictability for AI agents and reduces iteration caused by missing intent.

---

## how it is measured

- Count per file: comment lines vs total non-empty lines
- A line is non-empty if `trim(line).length > 0`
- Calculate: `doc_ratio = C / N`
- Exclude generated and vendor files

---

## scoring system

Files with **5% or more** documentation receive no penalty.

Files with **less than 5%** documentation receive a penalty:

```
penalty = −(5 − round(doc_ratio × 100))
```

Examples:
- 0% documentation: −5 points
- 1% documentation: −4 points
- 2% documentation: −3 points
- 3% documentation: −2 points
- 4% documentation: −1 point
- 5%+ documentation: 0 points (no penalty)

Rationale: Research shows that below 5% is commonly associated with poorly documented codebases. This threshold ensures sufficient context for AI agents without over-rewarding verbosity.

---

## status

v0
# Roadmap

Planned features for Deterministic beyond v0.

---

## Rules

### Structural Complexity (file-level)

Measure cyclomatic complexity and nesting depth of functions.

- Track control flow paths (if/else, loops, switches)
- Measure maximum nesting depth
- Penalize functions above thresholds (complexity >10, nesting >4)
- High complexity makes code unpredictable for AI agents

### Surface Areas & Hotspots (repo-level)

Analyze git history to identify risky areas.

- **Change frequency**: Files modified most often (top 10%)
- **Temporal coupling**: Files that change together (>50% co-occurrence)
- Surface hotspots without tests or documentation
- Help agents understand high-risk modification zones

### Idiomatic Pattern Recognizer (file-level)

Detect use of language-specific patterns vs. custom implementations.

- Standard library usage vs. reinvention
- Framework conventions (React hooks, Go error handling)
- Language idioms (Python context managers, JS async/await)
- Penalize anti-patterns and non-idiomatic code
- AI agents work better with familiar patterns

---

## Annotations

Optional: Generate metadata comments in each file for AI and human context.

**Behavior**:
- Generated per file, stored directly in the file itself
- Optional (opt-in via flag or config)
- Format: TBD (could be language-specific comments, structured blocks, etc.)

**Purpose**:
- Provide explicit context about file purpose, complexity, cautions
- Help AI agents understand file boundaries and relationships
- Surface warnings about high-risk areas

**Workflow**:
1. Analyze file and generate suggested annotation
2. Insert at top of file (or other conventional location)
3. Human can edit/remove as needed
4. Re-sync on subsequent runs (optional)

---

## Actionable Inputs

Turn scores into specific guidance.

**Philosophy**: `1 + 1 + 1 = meaningful action`

Multiple small violations compound into actionable suggestions.

**Thresholds**:
- `90-100`: ✅ No action needed
- `75-89`: 💡 Consider improvements (add tests, docs)
- `50-74`: ⚠️ High priority (avoid large changes, refactor first)
- `0-49`: 🚨 Critical (requires immediate attention)

**Multi-file patterns**:
- Hotspots without tests → prioritize coverage
- Coupled files with diverging scores → decouple or improve both
- Complex modules without docs → add module-level context

**Output**:
- Rich terminal output with emojis
- JSON for CI/CD integration
- IDE annotations (future)
- PR comments (future)

---

## Implementation Priority

1. Structural complexity rule (highest impact)
4. Surface areas & hotspots (git analysis)
3. File annotations (enables context)
2. Actionable inputs (makes scores useful)
5. Idiomatic patterns (uses light wait ML)




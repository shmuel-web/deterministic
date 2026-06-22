# Deterministic — agent guide

This repository is scored by **Deterministic**, a linter for AI coding agents. The tool only adds value if you actually run it, so make it part of your loop:

- **Before starting a ticket:** run `deterministic score ticket <path>` — only act on a task that's well-specified enough to be verifiable.
- **After making changes, before declaring done:** run `deterministic score repo` — it re-annotates the files you touched and recomputes the repo score, so you can see whether you left the repo better or worse (and fix anything you introduced). Then run `deterministic validate ticket <path>` to run the checks and confirm the work is actually complete — not just "it compiled."

Treat a falling score or a new issue as work to finish before you hand off.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

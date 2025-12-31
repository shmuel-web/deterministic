# Code Formatter Configuration

scope: repo

## what is measured

The presence and enforcement of code formatting tools. This includes formatter configuration files and enforcement mechanisms like pre-commit hooks or continuous integration checks.

---

## why this matters

Inconsistent formatting creates noisy diffs.

Code style variations make reviews harder for humans and produce unnecessary changes in PRs. When AI agents generate or modify code, formatting inconsistencies compound the problem by mixing style changes with logic changes.

---

## how it is measured

- Check for formatter configuration files in repository root
- Check for pre-commit hook configurations
- Check for CI pipeline formatting checks
- Check for format-related package scripts

---

## scoring system

- No formatter config: **−5 points**
- Config exists but no enforcement: **−3 points**
- Config + enforcement: **0 points**

---

## status

v0


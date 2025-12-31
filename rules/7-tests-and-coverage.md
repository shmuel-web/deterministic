# Tests and Coverage

scope: repo

## what is measured

The presence of three types of test infrastructure:
- **Unit tests**: Executable test suite validating individual functions/modules in isolation
- **Code coverage tooling**: Configured tooling that measures what percentage of code is exercised by tests
- **End-to-end tests**: Tests that validate the entire system from a user perspective

---

## why this matters

AI coding agents excel at writing tests—both unit and integration. Test generation is one of their strongest capabilities, often producing comprehensive coverage with minimal effort.

Well-tested code provides executable specifications, catches regressions immediately, and reduces the need for agents to reason about behavior from scratch. Tests make refactoring safer and faster.

Coverage metrics help agents identify untested paths, prioritize test generation, and validate that changes preserve test quality. E2E tests ensure the system works as a whole and that integration points function correctly.

The absence of test infrastructure indicates either agent underutilization or poor project hygiene.

---

## how it is measured

Look for presence of:

**Unit Tests**
- Test files (`*_test.go`, `*.test.js`, `test_*.py`)
- Test directories (`test/`, `tests/`, `__tests__/`)
- Testing framework in dependencies
- Test scripts in build files or package manifests

**Coverage**
- Coverage config files (`.coveragerc`, `jest.config.js`, `.codecov.yml`)
- Coverage commands in scripts or Makefile
- CI integration for coverage reporting
- Coverage tooling references in README

**E2E Tests**
- E2E test directories (`e2e/`, `integration/`)
- E2E frameworks in dependencies (Playwright, Cypress, Selenium)
- E2E test files with distinctive naming patterns
- Scripts that run E2E tests

---

## scoring system

Start at 100. Apply cumulative penalties:

- No unit tests: **−5 points**
- No code coverage tooling: **−3 points**
- No E2E tests: **−1 point**

```
score = 100 - penalties
```

Examples:
- All three present: 100
- Missing only E2E: 99
- Missing coverage and E2E: 96
- Missing all three: 91

---

## status

v0

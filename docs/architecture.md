# Architecture

Deterministic is a local CLI with one rule engine and two kinds of rules.

```text
CLI command
  -> discover all or changed files
  -> run applicable static and focused LLM rules
  -> validate and collect issues
  -> calculate score from fixed severity penalties
  -> update annotations, local index, and repository report
```

## Rule contract

The public extension point lives in `src/core/rule.ts`:

```ts
interface Rule {
  id: string;
  target: "file" | "repo";
  type: "static" | "llm";
  run(context: RuleContext): RuleResult | Promise<RuleResult>;
}
```

A rule returns issues containing `problem`, `fix`, and `severity`. The engine in
`src/core/rule-engine.ts` selects applicable rules, supplies a model only to LLM
rules, validates results, isolates failures, and collects findings. It contains
no agent or workflow orchestration.

## Modules

```text
src/cli.ts             command parsing
src/commands/          full and incremental scoring workflows
src/core/rule.ts       rule and issue contracts
src/core/rule-engine.ts rule execution and validation
src/core/score.ts      pure severity-to-score calculation
src/core/change-detect.ts Git and filesystem change detection
src/core/model.ts      Ollama and API-backed model clients
src/core/llm-rule.ts   bounded single-prompt LLM rule factory
src/core/index-store.ts local problems-only index
src/core/annotation.ts in-file result annotations
src/rules/static/      deterministic checks
src/rules/llm/         focused judgment checks
```

## Scopes

- File rules inspect one file's path and content.
- Repository rules inspect repository configuration or aggregate measurements.
- `init` scans the whole repository.
- `score repo` uses the stored marker to rescore only changed files, then
  refreshes inexpensive repository rules.

The `.deterministic/` directory is a gitignored cache. Clean files are omitted
from the index; absence means a score of 100.

## Design constraints

- Static checks must be deterministic and must not invoke an LLM.
- Each LLM rule asks one bounded question through `llmRule()`.
- Rules report issues, never numeric scores.
- A rule failure cannot abort unrelated checks.
- The CLI never lets a model choose or execute shell commands.

# Deterministic

Deterministic is a CLI linter for codebases changed by humans or AI coding
tools. It combines repeatable static checks with small, focused LLM judgments
and turns every finding into an auditable score.

## How scoring works

Rules report issues; they never choose a score. Every issue contains a problem,
a concrete fix, and a severity. The engine applies one fixed formula:

```text
score = max(0, 100 - sum(penalties))

info: 1   minor: 3   major: 9   critical: 27
```

No findings means 100. Passing rules cannot inflate the result, and every lost
point maps back to something actionable.

## Rules

- **Static rules** perform deterministic checks such as function length,
  complexity, missing types, test and CI configuration, and committed secrets.
- **LLM rules** answer one bounded question that text analysis cannot reliably
  answer, such as whether names communicate intent. They use a local Ollama model
  by default, with an optional OpenAI-compatible API fallback.

Both kinds implement the same rule contract. There are no reviewer agents,
multi-agent workflows, or model-selected command execution paths.

## CLI

```bash
npm install
npm run build

node dist/src/cli.js init
node dist/src/cli.js score repo
```

During development:

```bash
npm run deterministic -- init
npm run deterministic -- score repo
```

- `init` performs the first full scan, writes annotations for flagged files,
  and creates the local `.deterministic/` index.
- `score repo` uses Git-aware change detection to rescore changed files and
  refresh the repository score.

File scoring is the internal atomic operation. The hidden
`deterministic file <path...>` command exists for rule development.

## Model configuration

Start Ollama on `http://localhost:11434` or configure an OpenAI-compatible API:

```bash
DETERMINISTIC_LLM_API_URL=https://example.com/v1/chat/completions
DETERMINISTIC_LLM_API_KEY=...
DETERMINISTIC_LLM_API_MODEL=...
```

See [local model configuration](docs/local-llm.md) and
[writing a rule](docs/writing-a-rule.md).

## Development

```bash
npm test
npm run lint
npm run build
```

The architecture is summarized in [docs/architecture.md](docs/architecture.md).

TypeScript · Node.js 18+ · Zod · Ollama · Git · MIT

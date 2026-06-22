# Deterministic — Architecture (one page)

**A linter for AI coding agents.** It scores the *task*, the *repo*, and the
*execution* so AI-driven delivery is verifiable, not just fast. It runs locally,
and we build it with itself.

## The one idea
**Rules find issues; the engine derives the score.** A rule never returns a
number — it returns the problems it found, each with a `fix` and a `severity`.
The score is then pure arithmetic:

```
score = max(0, 100 − Σ penalty)      penalties: info −1, minor −3, major −9, critical −27
```

No issues → 100. It's *not* an average, so passing rules can't inflate a score and
a serious issue dominates regardless of how many rules ran. Every point lost maps
to a named, fixable problem — the score is fully auditable, and praise is
structurally impossible.

## The contract (frozen keystone)
Everything builds against one interface (`src/core/rule.ts`):
```ts
Rule { id, target: file|repo|ticket, type: static|llm, run(ctx) → { issues: [{ problem, fix, severity }] } }
```
- **Static rules** (AST/regex/counts) are fast, free, repeatable — they carry the weight.
- **LLM rules** handle judgment, and are built with the `llmRule({ topic, lookFor })` scaffold that **scopes each to one concern** so the model can't free-associate. Local model required (Ollama/Gemma, API fallback); output is Zod-validated with retry.

Changing this shape is a MAJOR governance event; *adding rules is not*. Community
rules are the extension point (and the moat).

## Three targets, one engine
- **file** — the atomic unit. The substrate everything composes from.
- **repo** — composed from file results + git, not by re-reading the tree.
- **ticket** — is the task well-specified enough to act on? (static "has a DoD" + LLM "is it any good").

## Pipeline (per file)
```
discover (git ls-files, ignore vendored)
  → strip our own annotation  → run rules: static inline · LLM via scoped agents
  → pool issues (bounded concurrency)  → derive score
  → write annotation INTO the file (issues only) + record in the index
```

## Where results live
- **In-file annotation** = the fix list, in the file's native comment syntax. It appears **only when there's something to fix** (clean files are untouched) — low-noise, and a viral "what is this?" wedge when it does show.
- **Index** (`.deterministic/`, gitignored) = problems-only cache + last-scored commit SHA. **100 is never stored — absence means clean.** This is what makes repo scoring cheap.
- **Incremental:** `score repo` re-scores only files `git diff` reports changed since the last scan. `init` is the one expensive full pass.

## Commands
`init` (full scan) · `score repo` (git-incremental) · `score ticket` · `validate ticket` (run tests/checks + re-score). File scoring is the internal atomic unit (hidden `file` dev command).

## Module map
```
core/   rule (contract) · score (penalty sum) · orchestrator (gather+run)
        annotation (in-file) · index-store (cache) · git (change detection)
        model (Ollama→API) · llm-rule (scoped scaffold) · pool (concurrency) · comment-style
rules/  static/* · llm/*          commands/  init · score-repo · score-ticket · validate-ticket · score-file
```

## Properties that matter
auditable · count-invariant scoring · incremental (git) · language-agnostic contract ·
community-extensible rules · local-first / zero-permission · spec-driven (Spec-Kit).

**Stack:** TypeScript/Node, Zod, Mastra (agent orchestration), Ollama + Gemma 4, git.

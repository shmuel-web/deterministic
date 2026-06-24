#!/usr/bin/env node
// @deterministic score: 87/100
//   [major] static/cognitive-complexity  worst function `main` has cognitive complexity 33 (file avg: 17) — 18 over the 15 cap → reduce nesting depth, extract inner branches into helper functions, or flatten conditional chains
//   [minor] llm/intent-legibility  The file's main exported symbol, the HELP constant, lacks a proper doc comment clarifying its purpose in the code. → Add a clear doc comment above the HELP constant explaining it provides usage instructions for the CLI tool.
//   [info] static/cyclomatic-complexity  worst function `main` has complexity 14 (file avg: 8) — 4 over the 10 cap → extract branches into smaller functions, replace conditionals with polymorphism, or simplify logic
// @deterministic:end
import { init } from "./commands/init.js";
import { scoreRepo } from "./commands/score-repo.js";
import { scoreTicket } from "./ticket/score-ticket.js";
import { validateTicket } from "./commands/validate-ticket.js";
import { scoreFile } from "./commands/score-file.js"; // internal/dev only
import { initTracing } from "./core/tracing.js";

const HELP = `deterministic — a linter for AI coding agents

Usage:
  deterministic init                     first run: score & annotate the whole repo (expensive)
  deterministic score repo [--commit]    recompute the repo score (cheap, incremental)
  deterministic score ticket <path>      score a ticket
  deterministic validate ticket <path>   run tests/checks + re-score touched files → confirm done

File scoring is the internal atomic unit the commands above compose; it is not a
public command. (\`deterministic file <path>\` exists for dev/dogfooding only.)
`;

function unknown(what: string): void {
  console.error(`Unknown command: ${what}\n`);
  console.log(HELP);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  // Load a local .env if present (dev convenience; e.g. the #90 tracing vars).
  try {
    process.loadEnvFile();
  } catch {
    /* no .env — fine */
  }

  // Dev tracing (#90): fail-closed — if DETERMINISTIC_DEV_TRACING is on and the
  // trace backend is unreachable, this throws before any LLM call runs.
  await initTracing();

  const [command, sub, ...rest] = process.argv.slice(2);
  switch (command) {
    case "init":
      await init();
      break;
    case "score":
      if (sub === "repo") await scoreRepo({ commit: rest.includes("--commit") });
      else if (sub === "ticket") await scoreTicket(rest[0]);
      else unknown(`score ${sub ?? ""}`.trim());
      break;
    case "validate":
      if (sub === "ticket") await validateTicket(rest[0]);
      else unknown(`validate ${sub ?? ""}`.trim());
      break;
    case "file": // internal/dev: score one or many files (fanned out, capped)
      await scoreFile([sub, ...rest].filter(Boolean) as string[]);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;
    default:
      unknown(command);
  }
}

main().catch((err) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});

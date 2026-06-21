#!/usr/bin/env node
import { init } from "./commands/init.js";
import { scoreRepo } from "./commands/score-repo.js";
import { scoreTicket } from "./commands/score-ticket.js";
import { validateTicket } from "./commands/validate-ticket.js";
import { scoreFile } from "./commands/score-file.js"; // internal/dev only

const HELP = `deterministic — a linter for AI coding agents

Usage:
  deterministic init                     first run: score & annotate the whole repo (expensive)
  deterministic score repo               recompute the repo score (cheap, incremental)
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
  const [command, sub, ...rest] = process.argv.slice(2);
  switch (command) {
    case "init":
      await init();
      break;
    case "score":
      if (sub === "repo") await scoreRepo();
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

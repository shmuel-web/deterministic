#!/usr/bin/env node
import { scoreFile } from "./commands/score-file.js";
import { analyzeRepo } from "./commands/analyze-repo.js";
import { analyzeTicket } from "./commands/analyze-ticket.js";
import { validate } from "./commands/validate.js";

const HELP = `deterministic — a linter for AI coding agents

Usage:
  deterministic score-file <path>      score a single file (writes an in-file annotation)
  deterministic analyze-repo           compose a repo score          (Lane 1)
  deterministic analyze-ticket <md>    score a ticket / blast radius (Lane 2)
  deterministic validate               re-score a diff after the agent (Lane 3)
`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "score-file": await scoreFile(rest[0]); break;
    case "analyze-repo": await analyzeRepo(); break;
    case "analyze-ticket": await analyzeTicket(rest[0]); break;
    case "validate": await validate(); break;
    case undefined: case "help": case "--help": case "-h": console.log(HELP); break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});

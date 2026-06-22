import type { Rule } from "../../core/rule.js";

/**
 * Static spec-quality rule. The cheap pre-filter: a ticket that's barely more
 * than a title has nothing for an agent (or a human) to act on — there's no
 * problem statement, no outcome, no conditions. Model-free, so it catches the
 * degenerate case before any LLM rule spends a call on it.
 *
 * Distinct from `ticket-has-dod` (which checks for a *done* section) and from
 * the vagueness rules (a thin ticket has too little text to even be vague). We
 * count *meaningful* words (letters-first tokens, so emoji/markdown/punctuation
 * don't pad the count) and keep the threshold low, so a terse-but-real ticket
 * isn't punished — only a near-empty one.
 */
const WORD = /\p{L}[\p{L}\p{N}'-]*/gu; // a word starts with a letter
const THRESHOLD = 10;

function meaningfulWordCount(text: string): number {
  return (text.match(WORD) ?? []).filter((w) => w.length >= 2).length;
}

export const thinTicket: Rule = {
  id: "static/thin-ticket",
  target: "ticket",
  type: "static",
  description: "A ticket must have an actionable body, not just a title.",
  run({ content }) {
    const words = meaningfulWordCount(content ?? "");
    if (words >= THRESHOLD) return { issues: [] };
    return {
      issues: [
        {
          problem: `the ticket has almost no content (${words} meaningful words) — there is nothing actionable to work from`,
          fix: "describe the problem, the desired outcome, and at least one concrete acceptance condition",
          severity: "major",
        },
      ],
    };
  },
};

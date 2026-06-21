// @deterministic score: 85/100  scored: 2026-06-21T08:18:50.546Z
//   static/file-length  100/100  w1  13 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (scoreTicket) is 4 lines — within the 50-line cap.
//   llm/intent-legibility  65/100  w3  File name and docstring indicate a ticket scoring command with deterministic and LLM-based rules, but implementation is stubbed and lacks clear structure for safe changes.
//   > next: File name and docstring indicate a ticket scoring command with deterministic and LLM-based rules, but implementation is stubbed and lacks clear structure for safe changes.
// @deterministic:end
/**
 * `deterministic score ticket <path>` — score a ticket: is it well-specified
 * enough to act on, and how complex (resolve its blast radius, inherit the
 * annotations of the files it touches). Uses both static rules (e.g. has a
 * Definition of Done) and LLM rules (e.g. DoD quality).
 *
 * Lane 2.
 */
export async function scoreTicket(ticketPath?: string): Promise<void> {
  if (!ticketPath) throw new Error("usage: deterministic score ticket <path>");
  throw new Error("score ticket is not implemented yet — Lane 2 (blast-radius resolver).");
}

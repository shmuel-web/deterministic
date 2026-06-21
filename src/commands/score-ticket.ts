// @deterministic score: 98/100  scored: 2026-06-21T11:58:53.378Z
//   llm/intent-legibility  95/100  w3  The descriptive name and extensive JSDoc clearly define the purpose, usage contract, and current development stage of the feature.
//   (3 rules passed)
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

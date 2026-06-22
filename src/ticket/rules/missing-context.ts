import { llmRule } from "../../core/llm-rule.js";

/**
 * Scoped LLM spec-quality rule. A ticket often *refers to* something an
 * implementer needs — a design, a bug report, an API, a prior decision — without
 * actually providing it. The agent (or human) then can't do the work correctly:
 * the canonical case is "implement the new design" with no Figma link. This rule
 * judges ONE concern: a referenced external artifact/source that the ticket
 * doesn't link, attach, or include inline.
 *
 * Scoped tightly: it only fires on a reference that's actually NEEDED, and never
 * when the link/content is already present — so it doesn't overlap the vagueness
 * rules (which judge the goal/DoD text itself, not missing attachments).
 */
export const missingContext = llmRule({
  id: "llm/missing-context",
  target: "ticket",
  description: "A referenced external artifact (design, bug, API, spec, decision, data…) must be linked or included.",
  topic:
    "whether the ticket REFERS TO an external artifact or source needed to do the work but does NOT provide it (no link, no attachment, no inline content)",
  lookFor: `Flag a reference to something an implementer would need, when the ticket gives no link / attachment / inline content for it:
- a DESIGN — "the new design", "the mockup", "per Figma", "match the wireframe" — with no Figma/Sketch/image link
- a BUG / ERROR — "fix the crash", "users hit errors", "it's broken" — with no repro steps, stack trace, logs, or error-tracker link (Sentry/Datadog/Coralogix)
- an API / INTEGRATION — "call the payments service", "the new endpoint" — with no API doc, OpenAPI, or example request/response
- a SPEC / REQUIREMENTS doc — "per the PRD", "see the spec", "follow the RFC" — with no link
- a DECISION / CONVERSATION — "as we discussed", "per the meeting", "the agreed approach" — with no link to a doc / thread / ADR
- a DEPENDENCY on other work — "after the auth refactor lands", "blocked by the migration" — with no ticket / PR link
- SAMPLE DATA / EXAMPLES — "the problematic payloads", "the failing CSV" — with nothing attached
- an EXTERNAL STANDARD — "must be WCAG compliant", "follow the style guide" — with no standard name+version or link
- "see the screenshot / attached log" when the ticket contains no image or link at all
Only flag a reference that is genuinely NEEDED to do the work. If the ticket already provides the link / attachment / inline content, it is NOT an issue. A self-contained ticket that references nothing external has no issue here.`,
  maxSeverity: "major",
});

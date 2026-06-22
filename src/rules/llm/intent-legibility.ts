import { llmRule } from "../../core/llm-rule.js";

/**
 * LLM rule, scoped to ONE thing: can a reader tell what this file is *for* from
 * its names and docs? Nothing about architecture, libraries, or refactors — the
 * scaffold forbids wandering, so this rule only ever speaks about legibility.
 */
export const intentLegibility = llmRule({
  id: "llm/intent-legibility",
  target: "file",
  description: "Flags places where the file's purpose is unclear from its naming and docs.",
  topic:
    "intent legibility — whether a reader can tell what this file is for, judged ONLY from the clarity of its names and its doc comments",
  lookFor: `- an exported symbol whose name actively misleads about what it does
- the file's main exported symbol has a missing or incorrect doc comment
- there is no indication anywhere of what the file is for`,
  maxSeverity: "minor",
});

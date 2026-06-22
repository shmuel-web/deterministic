// @deterministic score: 97/100
//   [minor] llm/intent-legibility  The primary exported function, `llmRule(spec: LlmRuleSpec): Rule`, lacks a doc comment explaining its purpose. A reader cannot immediately tell what this function does or how it constructs the rule object. → Add a JSDoc block above `export function llmRule(spec: LlmRuleSpec): Rule` that explains that this function acts as a factory to create and encapsulate a runnable code review rule tailored specifically for LLM interactions, based on provided specifications.
// @deterministic:end
import { z } from "zod";
import { RuleIssueSchema, type Rule, type RuleTarget, type Severity, type RuleIssue } from "./rule.js";

/**
 * Scaffold for LLM rules. The whole point: an LLM rule must be SCOPED to one
 * concern. "Find issues in this file" is open-ended, so an agreeable model always
 * finds something (architecture, library swaps, refactors) — noise. This builder
 * forces every LLM rule to declare its single `topic` and bakes the guardrails
 * into the prompt, so community-authored rules are scoped by construction.
 */

const IssuesSchema = z.object({ issues: z.array(RuleIssueSchema) });
const SEV_RANK: Record<Severity, number> = { info: 0, minor: 1, major: 2, critical: 3 };

export interface LlmRuleSpec {
  id: string;
  target: RuleTarget;
  description: string;
  /** The ONE concern this rule judges — and nothing else. */
  topic: string;
  /** Concrete examples of what counts as an issue for this topic. */
  lookFor: string;
  /** Severity ceiling (judgment rules rarely warrant major/critical). Default "minor". */
  maxSeverity?: Severity;
  /** Chars of content sent to the model. Default 8000. */
  contentSlice?: number;
}

function buildPrompt(spec: LlmRuleSpec, path: string, content: string): string {
  return `You are reviewing a ${spec.target} for ONE specific concern, and nothing else.

CONCERN: ${spec.topic}

Look for (this, and only this):
${spec.lookFor}

Hard rules:
- Report ONLY issues about the concern above. If you notice anything else — architecture, library or package choices, performance, general refactors, formatting, test coverage, or any other topic — DO NOT report it. Those are other rules' jobs.
- If something is intentional (a documented stub, a TODO, a deliberate design note), it is NOT an issue.
- Every issue must name a concrete, specific fix. Vague advice is not an issue.
- If there are no issues for THIS concern, return {"issues": []}. Never invent issues to seem useful. Never praise.

Return ONLY JSON: {"issues":[{"problem":"<specific>","fix":"<concrete>","severity":"info|minor|major|critical"}]}

${spec.target.toUpperCase()}: ${path}
---
${content.slice(0, spec.contentSlice ?? 8000)}
---`;
}

function parseIssues(raw: string): RuleIssue[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = IssuesSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.issues : null;
  } catch {
    return null;
  }
}

/** Build a scoped, guardrailed LLM rule from a topic declaration. */
export function llmRule(spec: LlmRuleSpec): Rule {
  const cap = spec.maxSeverity ?? "minor";
  return {
    id: spec.id,
    target: spec.target,
    type: "llm",
    description: spec.description,
    async run({ path, content, model }) {
      if (!model) return { issues: [] }; // defensive: Orchestrator should have errored first
      let issues: RuleIssue[] | null = null;
      for (let attempt = 0; attempt <= 1 && !issues; attempt++) {
        issues = parseIssues(await model.complete(buildPrompt(spec, path, content ?? "")));
      }
      if (!issues) return { issues: [] }; // unparseable after retry → don't fabricate (Principle VI)
      // Enforce the severity ceiling in code — the prompt asks, this guarantees.
      const capped = issues.map((i) => (SEV_RANK[i.severity] > SEV_RANK[cap] ? { ...i, severity: cap } : i));
      return { issues: capped };
    },
  };
}

// @deterministic score: 99/100  scored: 2026-06-21T12:01:08.404Z
//   llm/intent-legibility  98/100  w3  The file is exceptionally well-structured, highly modularized with clear helpers for LLM interaction, and includes excellent defensive coding practices.
//   (3 rules passed)
// @deterministic:end
import { z } from "zod";
import type { Rule, ModelClient } from "../../core/rule.js";

/**
 * LLM rule: is this file's *intent* legible to the next reader/agent? A judgment
 * call no AST can make. The Orchestrator only runs LLM rules when a model is
 * resolved (Principle V). Local models emit flaky JSON, so we validate-and-retry
 * with Zod and degrade to a neutral signal on failure (Principle VI).
 */

const WEIGHT = 3;

const VerdictSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

const prompt = (path: string, content: string) =>
  `You are a senior engineer judging INTENT LEGIBILITY of a source file: can a
competent reader (or AI agent) tell what this file is for and how to change it
safely? Consider naming, structure, and whether the purpose is obvious.

Score 0-100 (100 = crystal-clear intent) and give ONE terse sentence of reasoning.
Respond with ONLY JSON, no prose: {"score": <number>, "reasoning": "<text>"}

FILE: ${path}
---
${content.slice(0, 8000)}
---`;

/** Parse the first JSON object out of model output (tolerate surrounding chatter). */
function parseVerdict(raw: string): z.infer<typeof VerdictSchema> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = VerdictSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function ask(model: ModelClient, path: string, content: string, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const verdict = parseVerdict(await model.complete(prompt(path, content)));
    if (verdict) return verdict;
  }
  return null;
}

export const intentLegibility: Rule = {
  id: "llm/intent-legibility",
  target: "file",
  type: "llm",
  description: "Judges whether the file's intent is legible to a reader/agent.",
  async run({ path, content, model }) {
    if (!model) {
      // Defensive: the Orchestrator should have errored before reaching here.
      return { score: 50, weight: WEIGHT, reasoning: "No model available — LLM rule skipped." };
    }
    const verdict = await ask(model, path, content ?? "");
    if (!verdict) {
      return { score: 50, weight: WEIGHT, reasoning: "Model returned unparseable output; neutral signal." };
    }
    return { ...verdict, weight: WEIGHT };
  },
};

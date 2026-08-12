// @deterministic score: 97/100
//   [minor] llm/intent-legibility  The file's primary exported function, `resolveModel`, lacks a comprehensive doc comment explaining its purpose and the fallback logic involved in model resolution (local -> user API -> null). → Add a detailed JSDoc block immediately above `export async function resolveModel(): Promise<ModelClient | null>` describing that this function attempts to resolve an available LLM client, prioritizing local Ollama instances before falling back to environment variable-based external APIs.
// @deterministic:end
import type { ModelClient, CompleteOptions } from "./rule.js";
import type { Limit } from "./pool.js";
import { settings } from "./settings.js";

/**
 * Output-token ceiling (#85): env override, else the configured default. 0 means
 * NO cap — the safe default, because a low cap truncates the JSON response and
 * destroys recall (see settings.llm). Returns null when uncapped so callers omit
 * the option entirely (preserving the pre-#85 request shape).
 */
function maxOutputTokens(): number | null {
  const n = Number(process.env.DETERMINISTIC_MAX_OUTPUT_TOKENS) || settings.llm.maxOutputTokens;
  return n > 0 ? n : null;
}

/**
 * Model resolution (constitution Principle V): local-first, but an LLM is
 * required when judgment rules run.
 *   1. local Ollama (default)  →  2. user-provided API  →  3. null
 * The caller (Orchestrator) turns a null result into a hard error *only* when an
 * applicable rule is LLM-typed — a purely static run needs no model.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.DETERMINISTIC_OLLAMA_MODEL ?? "gemma4";

/**
 * Model tiers (#86) — route a task to an appropriately-sized model:
 *   scoped — single-concern judgment (intent-legibility)
 * Each defaults to the base model, so tiering is a NO-OP until you point a tier at
 * a smaller/faster model via env (e.g. DETERMINISTIC_OLLAMA_MODEL_TINY=gemma3:1b).
 */
export type ModelTier = "scoped";
const TIER_ENV: Record<ModelTier, string> = {
  scoped: "DETERMINISTIC_OLLAMA_MODEL_SCOPED",
};
function ollamaModelForTier(tier?: ModelTier): string {
  return (tier && process.env[TIER_ENV[tier]]) || OLLAMA_MODEL;
}

/** True only if a distinct model is configured for this tier (else it's the base model). */
export function tierConfigured(tier: ModelTier): boolean {
  return Boolean(process.env[TIER_ENV[tier]]);
}

/** Ollama-backed client (local, no keys). */
function ollamaClient(host: string, model: string): ModelClient {
  return {
    async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
      const cap = opts?.maxTokens ?? maxOutputTokens();
      const res = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          ...(opts?.json ? { format: "json" } : {}),
          ...(cap !== null && cap > 0 ? { options: { num_predict: cap } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { response?: string };
      return data.response ?? "";
    },
  };
}

/** OpenAI-compatible chat completions client for a user-provided API. */
function apiClient(url: string, key: string, model: string): ModelClient {
  return {
    async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
      const cap = opts?.maxTokens ?? maxOutputTokens();
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          ...(cap !== null && cap > 0 ? { max_tokens: cap } : {}),
          ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`LLM API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

async function ollamaReachable(host: string): Promise<boolean> {
  try {
    const res = await fetch(`${host}/api/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Wrap a model so every `complete()` call passes through the concurrency limiter. */
export function withConcurrencyLimit(model: ModelClient, limit: Limit): ModelClient {
  return { complete: (prompt, opts) => limit(() => model.complete(prompt, opts)) };
}

/**
 * Resolve a model client for a tier (#86), or null if none is available.
 * Ollama path picks the tier's model (env-overridable, defaults to the base
 * model). The API fallback is single-model for now — API tiering is a follow-up.
 */
export async function resolveModel(tier?: ModelTier): Promise<ModelClient | null> {
  if (await ollamaReachable(OLLAMA_HOST)) {
    return ollamaClient(OLLAMA_HOST, ollamaModelForTier(tier));
  }
  const url = process.env.DETERMINISTIC_LLM_API_URL;
  const key = process.env.DETERMINISTIC_LLM_API_KEY;
  return url && key
    ? apiClient(url, key, process.env.DETERMINISTIC_LLM_API_MODEL ?? "gpt-4o-mini")
    : null;
}

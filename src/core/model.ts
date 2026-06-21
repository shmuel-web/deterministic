import type { ModelClient } from "./rule.js";

/**
 * Model resolution (constitution Principle V): local-first, but an LLM is
 * required when judgment rules run.
 *   1. local Ollama (default)  →  2. user-provided API  →  3. null
 * The caller (Orchestrator) turns a null result into a hard error *only* when an
 * applicable rule is LLM-typed — a purely static run needs no model.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.DETERMINISTIC_OLLAMA_MODEL ?? "gemma4";

/** Ollama-backed client (local, no keys). */
function ollamaClient(host: string, model: string): ModelClient {
  return {
    async complete(prompt: string): Promise<string> {
      const res = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
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
    async complete(prompt: string): Promise<string> {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], stream: false }),
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

/** Resolve a model client, or null if none is available. */
export async function resolveModel(): Promise<ModelClient | null> {
  if (await ollamaReachable(OLLAMA_HOST)) {
    return ollamaClient(OLLAMA_HOST, OLLAMA_MODEL);
  }
  const url = process.env.DETERMINISTIC_LLM_API_URL;
  const key = process.env.DETERMINISTIC_LLM_API_KEY;
  if (url && key) {
    return apiClient(url, key, process.env.DETERMINISTIC_LLM_API_MODEL ?? "gpt-4o-mini");
  }
  return null;
}

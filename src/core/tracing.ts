import { AsyncLocalStorage } from "node:async_hooks";
import type { ModelClient, CompleteOptions } from "./rule.js";

/**
 * Dev-time LLM/agent tracing (#90) — see what the agents are doing on your
 * machine. A thin seam over a pluggable TraceSink (Langfuse is one impl, loaded
 * dynamically only when enabled), so:
 *   - OFF by default → zero footprint, no Langfuse import, no behaviour change.
 *   - ON (DETERMINISTIC_DEV_TRACING) → every model call is recorded, nested under
 *     a per-run trace and per-step spans.
 *   - FAIL-CLOSED in dev: if tracing is on and the sink is unreachable, we refuse
 *     to run un-traced (initTracing throws; a flush failure propagates). In
 *     development you observe every LLM call, or you don't run.
 *
 * The contract lives here; `model.ts` applies `traced()` at the resolution
 * boundary, so core rules stay unaware of Langfuse.
 */

export interface GenerationRecord {
  /** A human label for the call, e.g. "Architect/draft", "gate", "intent-legibility". */
  name: string;
  input: string;
  output: string;
  latencyMs: number;
  error?: string;
}

/** A node in the trace tree. `child` nests (run → reviewer → call). */
export interface TraceSpan {
  child(name: string): TraceSpan;
  generation(g: GenerationRecord): void;
  end(): void;
}

/** Backend that records traces (Langfuse, or a fake in tests). */
export interface TraceSink {
  /** Reachability probe — fail-closed depends on this. */
  healthy(): Promise<boolean>;
  trace(name: string): TraceSpan;
  /** Persist buffered spans; a rejection here MUST surface (fail-closed). */
  flush(): Promise<void>;
}

const als = new AsyncLocalStorage<TraceSpan>();
let sink: TraceSink | null = null; // null ⟺ tracing inactive

const TRUTHY = /^(1|true|on|yes)$/i;
export function devTracingEnabled(): boolean {
  const v = process.env.DETERMINISTIC_DEV_TRACING;
  return Boolean(v) && TRUTHY.test(v!);
}

/** True once tracing is initialized and active. */
export function tracingActive(): boolean {
  return sink !== null;
}

/**
 * Initialize tracing. No-op when disabled. When enabled, resolve the sink
 * (injected for tests, else Langfuse) and **fail-closed** if it's unreachable.
 */
export async function initTracing(opts: { sink?: TraceSink } = {}): Promise<void> {
  if (!devTracingEnabled()) {
    sink = null;
    return;
  }
  const candidate = opts.sink ?? (await loadLangfuseSink());
  if (!(await candidate.healthy())) {
    throw new Error(
      "DETERMINISTIC_DEV_TRACING is on but the trace backend (Langfuse) is unreachable. " +
        "Refusing to run un-traced — start it (see dev/langfuse) or unset DETERMINISTIC_DEV_TRACING.",
    );
  }
  sink = candidate;
}

/** Test/teardown hook. */
export function resetTracing(): void {
  sink = null;
}

/** Run `fn` inside a fresh trace (one scoring run). Flushes after — fail-closed. */
export async function withTrace<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!sink) return fn();
  const active = sink;
  const root = active.trace(name);
  try {
    return await als.run(root, fn);
  } finally {
    root.end();
    await active.flush(); // a flush rejection propagates — no silent loss
  }
}

/** Run `fn` inside a child span (e.g. one reviewer), nested under the current node. */
export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const parent = als.getStore();
  if (!sink || !parent) return fn();
  const span = parent.child(name);
  try {
    return await als.run(span, fn);
  } finally {
    span.end();
  }
}

/** Wrap a model client so each `complete()` is recorded as a generation under the current span. */
export function traced(client: ModelClient): ModelClient {
  if (!sink) return client; // tracing off → identity, zero overhead
  return {
    async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
      const span = als.getStore();
      const start = Date.now();
      let output = "";
      let error: string | undefined;
      try {
        output = await client.complete(prompt, opts);
        return output;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        span?.generation({ name: opts?.label ?? "llm", input: prompt, output, latencyMs: Date.now() - start, error });
      }
    },
  };
}

/** Build the Langfuse-backed sink. Dynamic import — `langfuse` is a devDependency. */
async function loadLangfuseSink(): Promise<TraceSink> {
  const host = process.env.LANGFUSE_HOST ?? "http://localhost:3000";
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    throw new Error("DETERMINISTIC_DEV_TRACING is on but LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are unset (see .env.example).");
  }
  const { Langfuse } = (await import("langfuse")) as typeof import("langfuse");
  const lf = new Langfuse({ publicKey, secretKey, baseUrl: host });

  /** Wrap any Langfuse trace/span object (both expose `.span()` / `.generation()`). */
  const wrap = (node: { span: (a: { name: string }) => unknown; generation: (a: Record<string, unknown>) => unknown; end?: () => void }): TraceSpan => ({
    child: (name) => wrap(node.span({ name }) as never),
    generation: (g) => {
      const end = new Date();
      node.generation({
        name: g.name,
        input: g.input,
        output: g.output,
        startTime: new Date(end.getTime() - g.latencyMs),
        endTime: end,
        level: g.error ? "ERROR" : "DEFAULT",
        statusMessage: g.error,
      });
    },
    end: () => node.end?.(),
  });

  return {
    async healthy() {
      try {
        const res = await fetch(`${host}/api/public/health`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
      } catch {
        return false;
      }
    },
    trace: (name) => wrap(lf.trace({ name }) as never),
    flush: () => lf.flushAsync(),
  };
}

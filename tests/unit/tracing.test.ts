import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ModelClient } from "../../src/core/rule.js";
import { initTracing, resetTracing, traced, withTrace, withSpan, tracingActive, type TraceSink, type TraceSpan, type GenerationRecord } from "../../src/core/tracing.js";

/** In-memory sink that records the trace tree — no Langfuse needed. */
function fakeSink(healthy = true) {
  const gens: { path: string; gen: GenerationRecord }[] = [];
  let flushes = 0;
  const node = (path: string): TraceSpan => ({
    child: (name) => node(`${path}/${name}`),
    generation: (g) => gens.push({ path, gen: g }),
    end: () => {},
  });
  const sink: TraceSink = {
    healthy: async () => healthy,
    trace: (name) => node(name),
    flush: async () => {
      flushes++;
    },
  };
  return { sink, gens, flushes: () => flushes };
}

const ECHO: ModelClient = { complete: async (p) => `echo:${p}` };

afterEach(() => {
  delete process.env.DETERMINISTIC_DEV_TRACING;
  resetTracing();
});

test("disabled by default: traced() is identity, withTrace runs fn, nothing recorded", async () => {
  const f = fakeSink();
  await initTracing({ sink: f.sink }); // env unset → stays inactive
  assert.equal(tracingActive(), false);
  assert.equal(traced(ECHO), ECHO, "no wrapping when off");
  const out = await withTrace("run", async () => traced(ECHO).complete("hi"));
  assert.equal(out, "echo:hi");
  assert.equal(f.gens.length, 0, "nothing recorded when disabled");
});

test("fail-closed: enabled + unreachable sink → initTracing throws", async () => {
  process.env.DETERMINISTIC_DEV_TRACING = "1";
  await assert.rejects(() => initTracing({ sink: fakeSink(false).sink }), /unreachable|Refusing/i);
});

test("enabled: records a generation per call, nested under run → span, then flushes", async () => {
  process.env.DETERMINISTIC_DEV_TRACING = "true";
  const f = fakeSink();
  await initTracing({ sink: f.sink });
  assert.equal(tracingActive(), true);

  await withTrace("score repo: R.md", async () => {
    await withSpan("Architect", async () => {
      await traced(ECHO).complete("gate?", { label: "gate" });
      await traced(ECHO).complete("draft?", { label: "draft" });
    });
  });

  assert.equal(f.gens.length, 2);
  assert.deepEqual(f.gens.map((x) => x.gen.name), ["gate", "draft"]);
  assert.ok(f.gens.every((x) => x.path === "score repo: R.md/Architect"), "calls nest under run → reviewer span");
  assert.equal(f.gens[0]!.gen.input, "gate?");
  assert.equal(f.gens[0]!.gen.output, "echo:gate?");
  assert.equal(f.flushes(), 1, "trace flushed once on completion (fail-closed point)");
});

test("enabled: a failing model call still records the generation with its error", async () => {
  process.env.DETERMINISTIC_DEV_TRACING = "1";
  const f = fakeSink();
  await initTracing({ sink: f.sink });
  const boom: ModelClient = { complete: async () => { throw new Error("kaboom"); } };
  await withTrace("run", async () => {
    await assert.rejects(() => traced(boom).complete("x", { label: "draft" }));
  });
  assert.equal(f.gens.length, 1);
  assert.match(f.gens[0]!.gen.error ?? "", /kaboom/);
});

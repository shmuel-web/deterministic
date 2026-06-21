import { test } from "node:test";
import assert from "node:assert/strict";
import { createLimiter, mapWithConcurrency } from "../../src/core/pool.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("limiter never exceeds the cap and runs everything", async () => {
  const limit = createLimiter(3);
  let active = 0;
  let peak = 0;
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await sleep(5);
        active--;
        return i;
      }),
    ),
  );
  assert.ok(peak <= 3, `peak concurrency ${peak} exceeded cap 3`);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("mapWithConcurrency preserves input order regardless of finish order", async () => {
  const out = await mapWithConcurrency([30, 10, 20, 0], 2, async (ms, i) => {
    await sleep(ms);
    return i;
  });
  assert.deepEqual(out, [0, 1, 2, 3]);
});

test("a cap of 1 serializes", async () => {
  const limit = createLimiter(1);
  let active = 0;
  let peak = 0;
  await Promise.all(
    Array.from({ length: 5 }, () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await sleep(2);
        active--;
      }),
    ),
  );
  assert.equal(peak, 1);
});

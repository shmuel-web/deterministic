/**
 * Bounded concurrency. A single local Ollama serves a model with limited
 * parallelism — firing 100 calls at once just queues them and risks memory
 * pressure. So we fan work out but cap the in-flight calls (see issue #63).
 */

export type Limit = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Create a limiter that runs at most `max` async tasks concurrently. A finishing
 * task hands its slot directly to the next waiter, so the active count never
 * overshoots `max`.
 */
export function createLimiter(max: number): Limit {
  const m = Math.max(1, Math.floor(max));
  let active = 0;
  const waiters: Array<() => void> = [];

  function release(): void {
    const next = waiters.shift();
    if (next) next(); // hand the slot to a waiter (active stays the same)
    else active--; // no waiter — free the slot
  }

  async function acquire(): Promise<void> {
    if (active < m) {
      active++;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve)); // slot handed to us; don't increment
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

/** Map over items with at most `max` running at once. Preserves input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  max: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = createLimiter(max);
  return Promise.all(items.map((item, i) => limit(() => fn(item, i))));
}

/** Resolved concurrency cap: DETERMINISTIC_CONCURRENCY, else a laptop-safe default. */
export function defaultConcurrency(): number {
  const env = Number(process.env.DETERMINISTIC_CONCURRENCY);
  return Number.isFinite(env) && env > 0 ? Math.floor(env) : 4;
}

// pool.js — fixed-size worker pool so disk I/O and libvips decode/encode overlap across cores
/**
 * Run `worker(item, index)` over `items` with at most `limit` concurrent workers.
 * Preserves completion order-independence; calls `onDone(result, index)` as items finish.
 */
export async function runPool(items, limit, worker, onDone) {
  let next = 0;
  const n = Math.max(1, Math.min(limit, items.length || 1));
  const runners = Array.from({ length: n }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const r = await worker(items[i], i);
      onDone?.(r, i);
    }
  });
  await Promise.all(runners);
}

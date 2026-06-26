/**
 * Map over items with a bounded number of in-flight promises, preserving input
 * order in the result. Used to parallelize per-item I/O (LLM drafts, provider
 * reads, row writes) that was previously a sequential await-in-loop — without
 * unleashing unbounded concurrency on a provider API or the DB connection pool.
 *
 * Single-threaded JS means the per-item callback's own state mutations are safe;
 * only the I/O overlaps. The first rejection propagates (like Promise.all).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const worker = async (): Promise<void> => {
    for (let i = cursor++; i < items.length; i = cursor++) {
      results[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

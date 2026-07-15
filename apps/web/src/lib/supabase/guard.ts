/**
 * R1c: empty ≠ error. Load-bearing server reads pass their result through orThrow so a
 * failed query surfaces the route's error boundary (branded retry) instead of rendering
 * as fake-empty data — an outage must never read as "0 leads".
 *
 * Shell/chrome reads (nav badges, banners) deliberately do NOT use this: they degrade to
 * empty rather than crash the frame.
 */
export function orThrow<T>(
  result: { data: T | null; error: { message: string } | null },
  what: string
): T {
  if (result.error) {
    throw new Error(`Failed to load ${what}: ${result.error.message}`);
  }
  // PostgREST returns [] for empty sets; null data without an error only happens on
  // maybeSingle-style reads, where the caller owns the null case — pass it through.
  return result.data as T;
}

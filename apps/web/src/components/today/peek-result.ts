/**
 * Stale-result guard for the draft peek. Regenerate / fix are slow AI calls; the owner can
 * move to another draft (← →, row click) before one resolves. A result is applied only when
 * its draft is still the open one — otherwise it is dropped, so a late rewrite can never land
 * on (or toast over) a different prospect's draft. Pure: the caller passes the live open id.
 */
export function applyIfCurrent<T extends { sendId: string }>(openId: string | null, result: T): T | null {
  return openId !== null && result.sendId === openId ? result : null;
}

export type AfterRemoval = { kind: "open"; id: string } | { kind: "close" };

/**
 * Where the peek goes after a draft leaves the queue (approve / reject / suppress). Measured
 * from the draft that COMPLETED, and only while it is still the open one — if the owner moved
 * on while the call was in flight, the peek stays where they are (null = do nothing).
 */
export function nextAfterRemoval(ids: readonly string[], doneId: string, openId: string | null): AfterRemoval | null {
  if (openId === null || doneId !== openId) return null;
  const i = ids.indexOf(doneId);
  if (i < 0) return { kind: "close" };
  const next = ids[i + 1] ?? ids[i - 1];
  return next ? { kind: "open", id: next } : { kind: "close" };
}

/**
 * Stale-result guard for the draft peek. Regenerate / fix are slow AI calls; the owner can
 * move to another draft (← →, row click) before one resolves. A result is applied only when
 * its draft is still the open one — otherwise it is dropped, so a late rewrite can never land
 * on (or toast over) a different prospect's draft. Pure: the caller passes the live open id.
 */
export function applyIfCurrent<T extends { sendId: string }>(openId: string | null, result: T): T | null {
  return openId !== null && result.sendId === openId ? result : null;
}

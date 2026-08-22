/**
 * Reject reasons for a queued draft (blueprint §6.10): picked in place on the row, never in
 * a modal. Rejections feed the engine's learning loop, so the reason is a closed set.
 */

export type RejectReason = "wrong_person" | "bad_timing" | "weak_message" | "other";

export const REJECT_REASONS: Record<RejectReason, string> = {
  wrong_person: "Wrong person",
  bad_timing: "Bad timing",
  weak_message: "Weak message",
  other: "Other",
};

/** Display order of the reason chips. */
export const REJECT_REASON_ORDER: readonly RejectReason[] = ["wrong_person", "bad_timing", "weak_message", "other"];

/** localStorage key for the one-time "rejections teach the engine" note. */
export const FIRST_REJECT_KEY = "vantera:today:first-reject-seen";

export const FIRST_REJECT_NOTE = "Rejections teach the engine — patterns become Playbook suggestions.";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/**
 * Marks the first-ever rejection as seen. Returns true exactly once per browser — the
 * caller shows the note on that call only. Storage failures (private mode, quota) read
 * as "already seen" so the note can never loop.
 */
export function markFirstRejectSeen(store: KeyValueStore | null | undefined): boolean {
  if (!store) return false;
  try {
    if (store.getItem(FIRST_REJECT_KEY)) return false;
    store.setItem(FIRST_REJECT_KEY, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

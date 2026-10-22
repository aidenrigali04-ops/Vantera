import { trackEvent } from "./clarity";

export const FIRST_DRAFT_APPROVED_KEY = "vantera:first_draft_approved";

/** True only the first time per browser; false if already marked or storage is unavailable. */
export function markFirstDraftApproved(storage: Pick<Storage, "getItem" | "setItem">): boolean {
  try {
    if (storage.getItem(FIRST_DRAFT_APPROVED_KEY)) return false;
    storage.setItem(FIRST_DRAFT_APPROVED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Call after a successful approval; fires `first_draft_approved` once per browser. */
export function trackFirstDraftApproved(): void {
  try {
    if (typeof window !== "undefined" && markFirstDraftApproved(window.localStorage)) {
      trackEvent("first_draft_approved");
    }
  } catch {
    // storage blocked — skip silently
  }
}

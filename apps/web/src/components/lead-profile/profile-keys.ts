import type { PeekNavProps } from "./types";

/** ←/→ walk the list (↑/↓ keep scrolling the peek) — but never while typing in a field. */
export function isEditable(target: EventTarget | null): boolean {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export type ProfileKeyEvent = Pick<KeyboardEvent, "key" | "preventDefault"> & { target: EventTarget | null };

/**
 * The profiler's keyboard: Escape closes (a slide-over is a dialog — keyboard parity with the
 * overlay click); ←/→ step through the caller's list when it provides `nav`, within bounds and
 * never while typing. Pure apart from the callbacks it runs.
 */
export function handleProfileKey(e: ProfileKeyEvent, onClose: () => void, nav: PeekNavProps | undefined): void {
  if (e.key === "Escape") onClose();
  else if (nav && !isEditable(e.target)) {
    if (e.key === "ArrowLeft" && nav.index > 0) {
      e.preventDefault();
      nav.onPrev();
    } else if (e.key === "ArrowRight" && nav.index < nav.total - 1) {
      e.preventDefault();
      nav.onNext();
    }
  }
}

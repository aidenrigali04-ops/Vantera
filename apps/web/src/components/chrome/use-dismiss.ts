import { useEffect, type RefObject } from "react";

export type DismissReason = "escape" | "outside";

/**
 * Close-on-Escape / close-on-outside-click for the chrome's popovers. `onDismiss` receives
 * the reason so callers can return focus to the trigger on Escape but leave it alone on an
 * outside click (the user just focused something else — yanking focus back is hostile).
 */
export function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: DismissReason) => void
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss("escape");
    };
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) onDismiss("outside");
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, rootRef, onDismiss]);
}

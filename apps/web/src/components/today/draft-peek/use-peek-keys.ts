import { useEffect, useRef } from "react";

/**
 * The DraftPeek keyboard model: A approve · E edit · G regenerate (with the steer note) ·
 * R reject · ← → move through the list · Esc leaves a mode / blurs the steer box / closes the
 * overflow / closes the sheet (the cascade lives in the `escape` handler). `?` is the global
 * shortcut sheet — not handled here.
 */
export type PeekKeyAction = "approve" | "edit" | "regenerate" | "reject" | "next" | "prev" | "escape";

/** key (lower-cased `KeyboardEvent.key`) → action. Exported so tests assert the table. */
export const PEEK_KEYS: Readonly<Record<string, PeekKeyAction>> = {
  a: "approve",
  e: "edit",
  g: "regenerate",
  r: "reject",
  arrowright: "next",
  arrowleft: "prev",
  escape: "escape",
};

/** the letter actions claim the key (preventDefault); arrows leave it alone */
const CLAIMS: ReadonlySet<PeekKeyAction> = new Set(["approve", "edit", "regenerate", "reject"]);

export type PeekKeyEvent = Pick<KeyboardEvent, "key" | "defaultPrevented" | "metaKey" | "ctrlKey" | "altKey" | "preventDefault"> & {
  target: EventTarget | null;
};

/**
 * Which action a keydown maps to, or null. Scoping: an already-handled event, a confirmation
 * dialog, a tab, or a select owns its keys; Esc still works while typing, the letters do not;
 * modifier chords are never ours.
 */
export function resolvePeekKey(e: PeekKeyEvent): PeekKeyAction | null {
  if (e.defaultPrevented) return null;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.('[role="alertdialog"], [role="tab"]')) return null;
  if (target?.tagName === "SELECT") return null;
  if (e.key === "Escape") return "escape";
  const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
  if (typing) return null;
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const action = PEEK_KEYS[e.key.toLowerCase()];
  return action && action !== "escape" ? action : null;
}

export type PeekKeyHandlers = Record<Exclude<PeekKeyAction, "escape">, () => void> & {
  /** run the Esc cascade; return true when something handled it (the key is then claimed) */
  escape: (target: EventTarget | null) => boolean;
};

/** Resolve + run one keydown against the handlers. Pure apart from the handlers it calls. */
export function dispatchPeekKey(e: PeekKeyEvent, handlers: PeekKeyHandlers): PeekKeyAction | null {
  const action = resolvePeekKey(e);
  if (!action) return null;
  if (action === "escape") {
    if (handlers.escape(e.target)) e.preventDefault();
    return action;
  }
  if (CLAIMS.has(action)) e.preventDefault();
  handlers[action]();
  return action;
}

/** Document-level keydown listener while `enabled` (a draft is open); always calls the latest handlers. */
export function usePeekKeys(enabled: boolean, handlers: PeekKeyHandlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => void dispatchPeekKey(e, ref.current);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}

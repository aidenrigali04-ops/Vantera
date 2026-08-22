/**
 * Keyboard model for the work card (blueprint §6.9): the table root is focusable, ↑/↓ move
 * a highlighted row, Enter opens it, and the Queue row shortcuts (L · R · A) act on the
 * highlighted row. Pure functions so the reducer is testable without a DOM.
 */

/** The next highlighted row index for a key press, or null when nothing is highlighted. */
export function nextHighlight(current: number | null, key: string, count: number): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const clamped = current === null ? null : Math.min(Math.max(current, 0), last);
  switch (key) {
    case "ArrowDown":
      return clamped === null ? 0 : Math.min(clamped + 1, last);
    case "ArrowUp":
      return clamped === null ? last : Math.max(clamped - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    case "Escape":
      return null;
    default:
      return clamped;
  }
}

/** Keys the highlight reducer consumes (so the table can preventDefault only on those). */
export const HIGHLIGHT_KEYS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Home", "End", "Escape"]);

export type RowCommand = "open" | "later" | "reject" | "approve-hint";

/** The command a single key press maps to on a highlighted Queue row. */
export function rowCommand(key: string): RowCommand | null {
  switch (key) {
    case "Enter":
      return "open";
    case "l":
    case "L":
      return "later";
    case "r":
    case "R":
      return "reject";
    case "a":
    case "A":
      return "approve-hint";
    default:
      return null;
  }
}

/** Roving tabindex for the tab strip: ←/→ wrap, Home/End jump. Null = not a tab key. */
export function nextTab(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

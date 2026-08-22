/**
 * Shared chrome geometry (Dashboard blueprint v1.0 §6.1). Every tile in the top band is the
 * same 40px surface square: --surface fill, --r-tile corners, a 1px --line ring plus the
 * --shadow-tile lift, ring → --line-strong on hover. Kept as plain strings (not components)
 * so each tile file stays a one-concern composition over the same numbers.
 */

/** The only motion in the chrome: background / ring / glyph color, 120ms ease-out. */
export const CHROME_MOTION = "transition-[color,background-color,box-shadow] duration-120 ease-out";

/** Visible focus on every interactive element — the 3px accent halo from --focus-ring. */
export const CHROME_FOCUS = "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

/** 40×40 surface tile (logo, utilities, avatar). */
export const CHROME_TILE = [
  "grid size-10 shrink-0 place-items-center rounded-[var(--r-tile)] bg-[var(--surface)]",
  "shadow-[var(--shadow-tile)] ring-1 ring-[var(--line)] hover:ring-[var(--line-strong)]",
  CHROME_MOTION,
  CHROME_FOCUS,
].join(" ");

/** Height-40 pill container (workspace switcher, primary nav). */
export const CHROME_PILL =
  "flex h-10 items-center rounded-[var(--r-pill)] bg-[var(--surface)] shadow-[var(--shadow-tile)] ring-1 ring-[var(--line)]";

/** Dropdown panel hanging below a tile or pill: --r-square corners, ring + --shadow-card. */
export const CHROME_MENU =
  "absolute top-full z-50 mt-2 w-60 rounded-[var(--r-square)] bg-[var(--surface)] p-1 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]";

/** 36px menu row: 14px ink, --surface-2 on hover. */
export const CHROME_MENU_ITEM = [
  "flex h-9 w-full items-center gap-2.5 rounded-[var(--r-btn)] px-2.5 text-left text-sm text-[var(--ink)]",
  "hover:bg-[var(--surface-2)] disabled:cursor-default disabled:hover:bg-transparent",
  CHROME_MOTION,
  CHROME_FOCUS,
].join(" ");

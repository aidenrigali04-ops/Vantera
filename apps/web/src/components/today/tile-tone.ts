import type { TileTone } from "@/lib/today/tiles";

/**
 * Tone → icon-square classes for an action tile (blueprint §6.6). Color lives on the icon
 * square only — the row, title, meta and chevron stay neutral in every tone.
 */
export const TONE_CLASSES: Record<TileTone, string> = {
  routine: "bg-[var(--surface-2)] text-[var(--ink)]",
  replies: "bg-[var(--acc-tint)] text-[var(--acc-ink)]",
  attention: "bg-[var(--attention-tint)] text-[var(--attention)]",
  billing: "bg-[var(--danger-tint)] text-[var(--danger)]",
};

export function toneClasses(tone: TileTone): string {
  return TONE_CLASSES[tone] ?? TONE_CLASSES.routine;
}

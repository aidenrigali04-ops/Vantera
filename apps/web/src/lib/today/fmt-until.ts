/**
 * Client-safe time formatter (no `@vantera/jobs` import, unlike `metrics.ts`), so client
 * components can re-tick a server-rendered "next run" label after mount.
 */

/** Future-facing counterpart of `fmtRelative`: "in ~12 min" / "in ~3h" / "in ~2d". */
export function fmtUntil(then: string | Date | null, now: Date): string {
  if (then == null) return "within ~15 min";
  const ms = new Date(then).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return "within ~15 min";
  if (ms <= 60_000) return "any moment now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ~${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ~${hrs}h`;
  return `in ~${Math.round(hrs / 24)}d`;
}

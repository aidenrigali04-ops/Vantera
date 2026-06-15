/** Days a lead's AI score/insights stay "fresh" before a delayed email touch re-ranks it. */
export const FRESHNESS_WINDOW_DAYS = 12;

/** True when a lead must be re-ranked before sending (aged past the window, or never scored). */
export function needsRefresh(scoredAt: Date | null, now: Date, windowDays: number): boolean {
  if (!scoredAt) return true;
  const ageDays = (now.getTime() - scoredAt.getTime()) / 86_400_000;
  return ageDays > windowDays;
}

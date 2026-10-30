// Data recency from the last AI-score (report #9: stale data is a top churn driver — outreach off
// months-old intel erodes trust). 30-day window flags aging research; self-contained so the shared
// profiler carries no page-level dependency.
const FRESHNESS_STALE_DAYS = 30;

export function freshness(scoredAt: string | null | undefined): { label: string; stale: boolean } | null {
  if (!scoredAt) return null;
  const t = new Date(scoredAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return { label: "just now", stale: false };
  const label =
    days === 0 ? "today" : days < 14 ? `${days}d ago` : days < 60 ? `${Math.round(days / 7)}w ago` : `${Math.round(days / 30)}mo ago`;
  return { label, stale: days > FRESHNESS_STALE_DAYS };
}

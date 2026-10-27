import { featureLabel } from "@vantera/agent-brains";
import { relativeDays } from "@/app/(app)/prospects/lead-value";

export type SignalIn = {
  kind: string;
  label: string | null;
  detail?: string | null;
  level?: string | null;
  observed_at?: string | null;
};
export type IntentPostIn = {
  post_ref: string;
  headline: string | null;
  detail: string | null;
  observed_at: string;
};
export type WhyNowCell = {
  label: string;
  when: string | null;
  href: string | null;
  kind: string | null;
  level: string | null;
  more: number;
} | null;

const ts = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/** The single "why now" reason for a prospect row: newest signal, else the insight fallback. */
export function whyNowCell(
  signals: SignalIn[],
  posts: IntentPostIn[],
  insights: { triggers?: string[]; pain_points?: string[] } | null,
  now: Date,
): WhyNowCell {
  if (signals.length > 0) {
    // Newest by observed_at; ties/missing dates keep the original (created) order.
    let best = signals[0];
    for (const s of signals) if (ts(s.observed_at) > ts(best.observed_at)) best = s;
    let newestPost: IntentPostIn | null = null;
    for (const p of posts) if (!newestPost || ts(p.observed_at) > ts(newestPost.observed_at)) newestPost = p;
    const href = newestPost && /^https?:\/\//.test(newestPost.post_ref) ? newestPost.post_ref : null;
    return {
      label: best.label?.trim() || featureLabel(`signal:${best.kind}`) || best.kind,
      when: best.observed_at ? relativeDays(best.observed_at, now) : null,
      href,
      kind: best.kind,
      level: best.level ?? null,
      more: Math.max(0, signals.length - 1),
    };
  }
  const fallback = insights?.triggers?.[0] ?? insights?.pain_points?.[0];
  if (fallback) return { label: fallback, when: null, href: null, kind: null, level: null, more: 0 };
  return null;
}

export type SignalGroup = { kind: string; label: string; count: number };

export function signalGroups(rows: { kind: string }[]): SignalGroup[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => {
      const raw = featureLabel(`signal:${kind}`);
      return { kind, label: !raw || raw === `signal:${kind}` ? kind : raw, count };
    })
    .sort((a, b) => b.count - a.count);
}

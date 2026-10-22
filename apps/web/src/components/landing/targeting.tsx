import { ArrowDown, ArrowUp } from "lucide-react";
import { LiveMeta, ScreenCard, ScreenNote, ScreenRow } from "./feature-row";

/**
 * The targeting row's screen — "How does it get better?" The model that learns from
 * every conversation: the profiles and signals it now weights up because they reply and
 * book, and the ones it weights down. Story told in full at /how-it-learns. Sample data.
 */

const LEARNED: { label: string; up: boolean }[] = [
  { label: "VP Sales · 11–50 person SaaS", up: true },
  { label: "Posted about hiring · last 14 days", up: true },
  { label: "Head of Growth · agencies", up: true },
  { label: "Generic “Founder” titles", up: false },
  { label: "Enterprise · 1,000+ people", up: false },
];

function Trend({ up }: { up: boolean }) {
  return up ? (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-[rgba(19,130,74,0.3)] bg-[rgba(19,130,74,0.1)] px-1.5 py-0.5 text-[0.68rem] font-semibold text-[#13824a]">
      <ArrowUp className="size-3" strokeWidth={2.4} />
      More
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-[rgba(12,16,26,0.1)] bg-[rgba(12,16,26,0.04)] px-1.5 py-0.5 text-[0.68rem] font-semibold text-[var(--ink-3)]">
      <ArrowDown className="size-3" strokeWidth={2.4} />
      Less
    </span>
  );
}

export function TargetingScreen() {
  return (
    <ScreenCard title="Targeting model" meta={<LiveMeta>Updated today</LiveMeta>}>
      <div className="space-y-1.5">
        {LEARNED.map((s) => (
          <ScreenRow key={s.label} label={s.label} value={<Trend up={s.up} />} />
        ))}
      </div>
      <ScreenNote>Learned from 214 replies and 38 booked meetings this month.</ScreenNote>
    </ScreenCard>
  );
}

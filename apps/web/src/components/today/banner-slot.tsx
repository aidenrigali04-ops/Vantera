import type { TodayView } from "@/lib/today/rows";
import { cn } from "@/lib/utils";

import { GhostButton } from "./buttons";
import { Glyph } from "./glyphs";

/**
 * Z1 · the banner slot (blueprint §6.2). Null collapses to nothing — no reserved height.
 * Otherwise one 48px row: tone glyph · message · a single ghost CTA. No dismiss: the
 * banner leaves when the condition does.
 */

export type BannerSpec = TodayView["banner"];

const TONE: Record<NonNullable<BannerSpec>["tone"], { box: string; glyph: "unplug" | "credit-card" }> = {
  attention: { box: "bg-[var(--attention-tint)] ring-[var(--attention)]/30 text-[var(--attention)]", glyph: "unplug" },
  danger: { box: "bg-[var(--danger-tint)] ring-[var(--danger)]/30 text-[var(--danger)]", glyph: "credit-card" },
};

export function BannerSlot({ banner, className }: { banner: BannerSpec; className?: string }) {
  if (!banner) return null;
  const tone = TONE[banner.tone];
  return (
    <div
      role="status"
      className={cn("flex h-12 items-center gap-3 rounded-[var(--r-square)] pl-4 pr-1.5 ring-1", tone.box, className)}
    >
      <Glyph name={tone.glyph} size={18} className="shrink-0" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">{banner.message}</p>
      <GhostButton href={banner.cta.href} className="shrink-0">
        {banner.cta.label}
      </GhostButton>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { IntentTone } from "@/lib/inbox-intent";

const TONE: Record<IntentTone, string> = {
  positive: "bg-[var(--positive-tint)] text-[var(--positive)]",
  blue: "bg-[var(--acc-tint)] text-[var(--acc-ink)]",
  amber: "bg-[var(--attention-tint)] text-[var(--attention)]",
  muted: "bg-[var(--surface-2)] text-[var(--ink-mid)]",
};

/** A conversation's intent tag (Interested / Booked / …) — the landing inbox's chip. */
export function IntentChip({ label, tone, className }: { label: string; tone: IntentTone; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold", TONE[tone], className)}>
      {label}
    </span>
  );
}

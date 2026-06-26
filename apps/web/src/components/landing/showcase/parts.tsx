import { cn } from "@/lib/utils";

const AV_COLORS = ["#30cfff", "#7c8cff", "#34d399", "#f0a93c"];

export function Avatar({ initials, i = 0 }: { initials: string; i?: number }) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-[#0a0c12]"
      style={{ backgroundColor: AV_COLORS[i % AV_COLORS.length] }}
    >
      {initials}
    </span>
  );
}

/** Score chip — qualified (≥70) reads cyan; below-bar reads muted grey. On light. */
export function ScorePill({ score }: { score: number }) {
  const qualified = score >= 70;
  return (
    <span
      className={cn(
        "grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border px-2 text-[15px] font-semibold tabular-nums",
        qualified
          ? "border-[rgba(48,207,255,0.32)] bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
          : "border-[var(--hairline)] bg-[#f1f2f4] text-[var(--ink-4)]",
      )}
    >
      {score}
    </span>
  );
}

/** Shared product-mockup shell — clean light panel with a soft cyan glow. */
export function MockChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[28px] blur-2xl"
        style={{ background: "radial-gradient(60% 70% at 60% 25%, rgba(48,207,255,0.16), transparent 70%)" }}
      />
      <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] bg-[#fbfbfc] px-3.5 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-[#e5e6e8]" />
            <span className="size-2 rounded-full bg-[#e5e6e8]" />
            <span className="size-2 rounded-full bg-[#e5e6e8]" />
          </div>
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-4)]">
            {label}
          </span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

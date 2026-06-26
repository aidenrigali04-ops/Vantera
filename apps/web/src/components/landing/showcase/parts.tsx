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

/** Score chip — qualified (≥70) reads cyan; below-bar reads muted. On dark. */
export function ScorePill({ score }: { score: number }) {
  const qualified = score >= 70;
  return (
    <span
      className={cn(
        "grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border px-2 text-[15px] font-semibold tabular-nums",
        qualified
          ? "border-[var(--cyan)]/30 bg-[var(--cyan)]/10 text-[var(--cyan)]"
          : "border-white/10 bg-white/[0.04] text-white/45",
      )}
    >
      {score}
    </span>
  );
}

/** Shared product-mockup shell — sleek dark glass panel with a soft cyan glow. */
export function MockChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--panel-line)] bg-[var(--panel)] text-white shadow-[var(--panel-glow)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 50% at 85% -5%, rgba(48,207,255,0.12), transparent 60%)" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="relative flex items-center gap-2.5 border-b border-white/[0.07] px-3.5 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </div>
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          {label}
        </span>
      </div>
      <div className="relative p-4">{children}</div>
    </div>
  );
}

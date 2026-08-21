
import { FRAME_CAPTION } from "./claims";

/**
 * ProductFrame — the container every below-fold product embed sits in (blueprint §6.5).
 * A quiet header strip naming what the frame shows, the embed at real density, and an
 * honest caption beneath ("Real product layout · Sample data") — no fake window chrome,
 * no traffic-light dots. Embeds are decorative: callers pass aria-hidden content and
 * put the meaning in `label`.
 */
export function ProductFrame({
  label,
  meta,
  caption = FRAME_CAPTION,
  className,
  children,
}: {
  /** Header strip text, e.g. "Approvals · 3 to review". */
  label: string;
  /** Optional right-aligned header note (e.g. a paused indicator slot). */
  meta?: React.ReactNode;
  caption?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div
        className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(12,16,26,.04), 0 18px 40px -20px rgba(12,16,26,.14)",
        }}
      >
        <div className="flex h-9 items-center justify-between border-b border-[var(--hairline)] bg-[#fbfcfe] px-4">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-4)]">
            {label}
          </span>
          {meta}
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
      {caption && (
        <p className="mt-2.5 text-center text-[10.5px] uppercase tracking-[0.1em] text-[var(--ink-4)]">
          {caption}
        </p>
      )}
    </div>
  );
}

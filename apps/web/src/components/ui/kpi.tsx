import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared KPI tile for the Results surface (Overview / Analytics / Pipeline) — a compact, bordered
 * stat on the Geist data layer. Color is placed, not sprinkled: `hero` marks the headline metric
 * with a cyan dot, `actionable` turns the value cyan when a tile needs the user (e.g. drafts
 * waiting). Renders as a link when `href` is given (drill-down), otherwise a static tile.
 */
export function KpiTile({
  label,
  value,
  sub,
  href,
  hero = false,
  actionable = false,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  hero?: boolean;
  actionable?: boolean;
}) {
  const base =
    "block rounded-xl border border-[var(--hairline)] bg-white p-4 shadow-[var(--shadow-sm)] transition-colors";
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {hero && <span className="size-1.5 rounded-full bg-[var(--cyan-strong)]" aria-hidden />}
        {label}
      </span>
      <p
        className={cn(
          "mt-2 font-data text-2xl font-semibold tabular-nums",
          actionable ? "text-[var(--cyan-strong)]" : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </>
  );

  return href ? (
    <Link
      href={href}
      className={cn(
        base,
        "group hover:border-[rgba(12,16,26,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/** Four-across responsive row of KPI tiles (2-up on mobile). */
export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>{children}</div>;
}

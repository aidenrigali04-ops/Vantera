"use client";

import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenuePoint } from "@/lib/revenue";

// Electric-cyan brand: the closed-revenue line is the signature cyan; the projected
// line stays a muted dashed so the real number reads as the hero.
const BRAND = "var(--cyan)"; // closed (solid)
const BRAND_ACCENT = "var(--muted-foreground)"; // projected (dashed)

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type TooltipItem = { dataKey?: string | number; value?: number };

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const closed = payload.find((p) => p.dataKey === "closedCents")?.value ?? 0;
  const projected = payload.find((p) => p.dataKey === "projectedCents")?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="mb-1.5 font-medium">{label ? fmtDate(label) : ""}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: BRAND }} /> Closed
        </span>
        <span className="font-mono tabular-nums">{usdFull.format(closed / 100)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: BRAND_ACCENT }} /> Projected
        </span>
        <span className="font-mono tabular-nums">{usdFull.format(projected / 100)}</span>
      </div>
    </div>
  );
}

/** Interactive closed-vs-projected revenue area chart, in the brand palette. */
export function RevenueChart({
  data,
  goalCents,
}: {
  data: RevenuePoint[];
  goalCents: number | null;
}) {
  if (data.length === 0) return null;

  const peak = data.reduce((m, d) => Math.max(m, d.projectedCents), 0);
  const top = Math.max(peak, goalCents ?? 0);
  const domainMax = Math.ceil((top || 1) * 1.12);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={160} minWidth={0}>
        <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revClosedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis hide domain={[0, domainMax]} />
          <Tooltip
            content={<RevenueTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          {goalCents != null && goalCents > 0 && (
            <ReferenceLine
              y={goalCents}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `Goal ${usdCompact.format(goalCents / 100)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="projectedCents"
            stroke={BRAND_ACCENT}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="none"
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="closedCents"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#revClosedFill)"
            dot={false}
            activeDot={{ r: 3, fill: BRAND, stroke: "var(--background)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

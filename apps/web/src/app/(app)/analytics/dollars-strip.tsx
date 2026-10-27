import Link from "next/link";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { KpiTile, KpiGrid } from "@/components/ui/kpi";
import { cn } from "@/lib/utils";
import type { Roi } from "@/lib/revenue";

// The dollar layer of Results — rendered only when a deal value AND a plan exist (gate.ts).
// Counts never wait on this; when an input is missing, DollarsHint names the one thing to set.

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function DollarsStrip({ roi }: { roi: Roi }) {
  return (
    <div className="space-y-6">
      <KpiGrid>
        <KpiTile hero label="Return on spend" value={`${roi.pipelineToSpend ?? 0}×`} sub="pipeline + closed vs spend" />
        <KpiTile
          label="Cost / meeting"
          value={roi.costPerMeetingCents != null ? usd(roi.costPerMeetingCents) : "—"}
          sub={roi.costPerMeetingCents == null ? "once a meeting books" : "per booked meeting"}
        />
        <KpiTile
          label="Cost / close"
          value={roi.costPerCloseCents != null ? usd(roi.costPerCloseCents) : "—"}
          sub={roi.costPerCloseCents == null ? "once a deal closes" : "per closed deal"}
        />
        <KpiTile label="Annual spend" value={usd(roi.annualSpendCents)} sub="your current plan" />
      </KpiGrid>
      <RenewalBar roi={roi} />
    </div>
  );
}

// Goal-gradient: the 2× pipeline-to-spend bar that keeps a budget funded — the renewal headline.
function RenewalBar({ roi }: { roi: Roi }) {
  const ratio = roi.pipelineToSpend ?? 0;
  const towardBar = Math.min(100, Math.round((ratio / 2) * 100));
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Pipeline-to-spend</Eyebrow>
        <span className="font-data text-[11px] tracking-wide text-muted-foreground">
          {ratio}× / 2× target
        </span>
      </div>
      <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
        <div className="h-full rounded-full bg-[var(--cyan)]" style={{ width: `${towardBar}%` }} />
        <div className="absolute inset-y-0 right-0 w-px bg-foreground/30" aria-hidden />
      </div>
      <p className={cn("mt-2.5 text-sm", roi.meetsThreshold ? "text-foreground/80" : "text-muted-foreground")}>
        {roi.meetsThreshold
          ? "Clears the 2× pipeline-to-spend bar that keeps a budget funded."
          : "Below the 2× bar — that gap is what puts renewal at risk."}
      </p>
    </Panel>
  );
}

const HINTS = {
  value: { text: "Set your average deal size to see pipeline and return in dollars.", href: "/settings" },
  spend: { text: "Choose a plan to see return on spend.", href: "/settings/billing" },
} as const;

/** One inline line naming the single missing dollar input — never a blocking panel. */
export function DollarsHint({ missing }: { missing: "value" | "spend" }) {
  const hint = HINTS[missing];
  return (
    <p className="text-sm text-muted-foreground">
      <Link
        href={hint.href}
        className="text-foreground underline decoration-[var(--hairline)] underline-offset-4 transition-colors hover:decoration-foreground"
      >
        {hint.text}
      </Link>
    </p>
  );
}

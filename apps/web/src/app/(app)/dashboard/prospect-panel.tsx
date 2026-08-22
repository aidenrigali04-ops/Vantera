"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { LeadProfile } from "@/components/lead-profile";
import { ScoreBadge, SourceBadge, WhyNowLine } from "@/components/lead-why-now";
import { cn } from "@/lib/utils";
import { projectedRevenue } from "../prospects/lead-value";

export type Prospect = LeadProfile;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function name(p: Prospect): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

/** The one thing to do with this lead right now — draft waiting beats everything. */
function nextAction(p: Prospect, hasDraft: boolean): { label: string; href: string } {
  if (hasDraft) return { label: "Draft waiting — approve", href: "/approvals" };
  if (p.status === "replied") return { label: "Reply waiting", href: p.id ? `/prospects/${p.id}` : "/prospects" };
  return { label: "View profile", href: p.id ? `/prospects/${p.id}` : "/prospects" };
}

/**
 * Hot leads as spotlight + queue: the #1 prospect gets a featured card that answers
 * who / why now / what it's worth / what to do, the rest read as a compact why-now-led
 * queue. Intent leads carry the shared In-market treatment everywhere.
 */
export function ProspectPanel({
  prospects,
  pendingDraftLeadIds = [],
  avgDealValueCents = null,
  goalCents = null,
}: {
  prospects: Prospect[];
  pendingDraftLeadIds?: string[];
  avgDealValueCents?: number | null;
  goalCents?: number | null;
}) {
  const router = useRouter();

  if (prospects.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Qualified prospects appear here as your pipeline sources and enriches them.
      </p>
    );
  }

  const [top, ...rest] = prospects;
  const open = (p: Prospect) => p.id && router.push(`/prospects/${p.id}`);
  const topProj = projectedRevenue(avgDealValueCents, goalCents, top.ai_score);
  const topAction = nextAction(top, Boolean(top.id && pendingDraftLeadIds.includes(top.id)));

  return (
    <div className="flex flex-col gap-3">
      {/* Spotlight — the strongest lead, framed as work-this-today (HotNowStrip ring idiom). */}
      <div
        role="link"
        tabIndex={0}
        onClick={() => open(top)}
        onKeyDown={(e) => e.key === "Enter" && open(top)}
        className="cursor-pointer rounded-xl p-4 ring-1 ring-inset ring-[var(--positive-line)] transition-colors hover:ring-[var(--positive)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-medium">{name(top)}</p>
              <SourceBadge source={top.source} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[top.title, top.company_name].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <ScoreBadge score={top.ai_score} withVerdict />
        </div>
        <WhyNowLine lead={top} className="mt-2" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] pt-3">
          <p className="text-xs text-muted-foreground">
            {topProj ? (
              <>
                Worth <span className="font-data font-semibold text-foreground">{usd.format(topProj.valueCents / 100)}</span>
                {topProj.dealsToGoal != null && <> · 1 of ~{topProj.dealsToGoal} wins to your goal</>}
              </>
            ) : (
              "Qualified against your ICP"
            )}
          </p>
          <Link
            href={topAction.href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--cyan-strong)] underline-offset-2 hover:underline"
          >
            {topAction.label} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Queue — the rest, why-now-led, one glance per row. */}
      {rest.length > 0 && (
        <div className="divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
          {rest.map((p) => (
            <div
              key={p.id}
              role="link"
              tabIndex={0}
              onClick={() => open(p)}
              onKeyDown={(e) => e.key === "Enter" && open(p)}
              className="flex cursor-pointer items-center justify-between gap-3 px-1 py-2.5 transition-colors hover:bg-[var(--tint)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {name(p)}
                    {p.company_name && <span className="font-normal text-muted-foreground"> · {p.company_name}</span>}
                  </p>
                  <SourceBadge source={p.source} />
                </div>
                <WhyNowLine lead={p} className={cn("max-w-[34rem]")} />
              </div>
              <ScoreBadge score={p.ai_score} withVerdict />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

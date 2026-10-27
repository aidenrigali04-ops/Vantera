"use client";

import { projectedRevenue } from "@/app/(app)/prospects/lead-value";
import type { LeadProfile, LeadProfileInsights } from "../types";
import { Field, InsightList } from "./fields";
import { Section } from "./section";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "Funding signal (2.1× your reply rate)" — one plain line per direction, highest impact first. */
function LearnedReasons({ reasons }: { reasons: { label: string; ratio: number }[] }) {
  const up = reasons.filter((r) => r.ratio > 1);
  const down = reasons.filter((r) => r.ratio < 1);
  const fmt = (r: { label: string; ratio: number }) => `${r.label} (${r.ratio}× your reply rate)`;
  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      {up.length > 0 && <p>Ranked higher: {up.map(fmt).join(" · ")}</p>}
      {down.length > 0 && <p>Ranked lower: {down.map(fmt).join(" · ")}</p>}
    </div>
  );
}

/** Why this rank: the score, its worth toward the goal, the rationale, and the learned reasons. */
export function RankSection({
  lead,
  avgDealValueCents,
  goalCents,
}: {
  lead: Pick<LeadProfile, "ai_score" | "ai_rationale" | "learned_reasons">;
  avgDealValueCents: number | null;
  goalCents: number | null;
}) {
  const proj = projectedRevenue(avgDealValueCents, goalCents, lead.ai_score);
  const learned = lead.learned_reasons && lead.learned_reasons.length > 0 ? lead.learned_reasons : null;
  return (
    <Section
      id="rank"
      title="Why this rank"
      aside={<span className="font-mono text-2xl font-semibold tabular-nums">{lead.ai_score ?? "—"}</span>}
    >
      {/* Value framing — same worth-toward-goal line as the table and Hot strip. */}
      {proj && (
        <p className="text-xs text-muted-foreground">
          Worth <span className="font-data font-semibold text-foreground">{usd.format(proj.valueCents / 100)}</span>
          {proj.dealsToGoal != null && <> · 1 of ~{proj.dealsToGoal} to your goal</>}
        </p>
      )}
      {lead.ai_rationale && <p className="mt-2 text-sm text-muted-foreground">{lead.ai_rationale}</p>}
      {learned && <LearnedReasons reasons={learned} />}
      {!proj && !lead.ai_rationale && !learned && <p className="text-sm text-muted-foreground">Not scored yet.</p>}
    </Section>
  );
}

/** Why this prospect: the rank's structured insights (pain points, triggers, angle). */
export function ProspectSection({ insights }: { insights: LeadProfileInsights | null }) {
  if (!insights) return null;
  return (
    <Section id="prospect" title="Why this prospect">
      <div className="space-y-3">
        {insights.summary && <p className="text-sm">{insights.summary}</p>}
        <InsightList label="Pain points" items={insights.pain_points} />
        <InsightList label="Buying triggers" items={insights.triggers} />
        <InsightList label="Motivations" items={insights.motivations} />
        {insights.value_angle && <Field label="Value angle">{insights.value_angle}</Field>}
        {insights.aha_moment && <Field label="Aha moment">{insights.aha_moment}</Field>}
      </div>
    </Section>
  );
}

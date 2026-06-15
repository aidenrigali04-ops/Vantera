"use client";

import { useState } from "react";
import { Check, ExternalLink, Mail, Phone, Sparkles, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PANEL_SURFACE, Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import {
  humanizeEmailStatus,
  humanizePhoneStatus,
  isVerified,
  projectedRevenue,
  scoreVerdict,
  type ScoreTier,
} from "./lead-value";

export interface LeadInsightsView {
  pain_points?: string[];
  triggers?: string[];
  motivations?: string[];
  value_angle?: string;
  aha_moment?: string;
  summary?: string;
}

export interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  industry: string | null;
  location: string | null;
  status: string;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: LeadInsightsView | null;
  rules_gate_reasons: string[] | null;
  email: string | null;
  email_status: string;
  phone: string | null;
  phone_status: string;
  linkedin_url: string | null;
  created_at: string;
  replies?: ReplyView[] | null;
}

export interface ReplyView {
  classification: string | null;
  classification_rationale: string | null;
  body: string | null;
  received_at: string;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const REPLY_LABELS: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  neutral: "Neutral",
  out_of_office: "Out of office",
  bounce: "Bounced",
  unsubscribe: "Unsubscribed",
  other: "Other",
};

function latestReply(lead: LeadRow): ReplyView | null {
  const replies = lead.replies ?? [];
  if (replies.length === 0) return null;
  return [...replies].sort((a, b) => b.received_at.localeCompare(a.received_at))[0];
}

const STATUS_LABELS: Record<string, string> = {
  sourced: "Sourced",
  rejected: "Filtered out",
  qualified: "Qualified",
  enriched: "Enriched",
  in_campaign: "In outreach",
  replied: "Replied",
  converted: "Converted",
  archived: "Archived",
};

function StatusBadge({ status }: { status: string }) {
  const positive = ["qualified", "enriched", "in_campaign", "replied", "converted"].includes(status);
  return (
    <Badge variant={positive ? "default" : "secondary"}>{STATUS_LABELS[status] ?? status}</Badge>
  );
}

// Monochrome, white-glow tiers (rule 07): a hot lead glows, weaker ones step down
// to a quiet ring — intensity, not hue, carries the verdict.
const VERDICT_CLASS: Record<ScoreTier, string> = {
  hot: "bg-foreground text-background shadow-[0_0_16px_rgba(255,255,255,0.45)]",
  strong: "bg-foreground/10 text-foreground ring-1 ring-inset ring-white/20",
  look: "text-muted-foreground ring-1 ring-inset ring-border",
  unscored: "text-muted-foreground/60 ring-1 ring-inset ring-border",
};

function VerdictChip({ score }: { score: number | null }) {
  const v = scoreVerdict(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        VERDICT_CLASS[v.tier]
      )}
    >
      {v.label}
      {score != null && <span className="font-mono tabular-nums opacity-70">{score}</span>}
    </span>
  );
}

function leadName(lead: LeadRow): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

function RevenuePill({
  avgDealValueCents,
  goalCents,
}: {
  avgDealValueCents: number | null;
  goalCents: number | null;
}) {
  const proj = projectedRevenue(avgDealValueCents, goalCents);
  if (!proj) return null;
  return (
    <div className={cn(PANEL_SURFACE, "mt-5 p-4")}>
      <Eyebrow>Worth to you</Eyebrow>
      <p className="mt-1.5 font-mono text-3xl font-semibold tabular-nums">
        ≈ {usd.format(proj.valueCents / 100)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {proj.dealsToGoal != null
          ? `One of ~${proj.dealsToGoal} closes to your ${usd.format((goalCents as number) / 100)} goal`
          : "what closing this prospect is worth"}
      </p>
    </div>
  );
}

function OpeningCard({ insights }: { insights: LeadInsightsView }) {
  if (!insights.value_angle && !insights.aha_moment) return null;
  return (
    <section className={cn(PANEL_SURFACE, "p-4 ring-1 ring-inset ring-white/10")}>
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-foreground" aria-hidden />
        <Eyebrow>Your opening</Eyebrow>
      </div>
      {insights.value_angle && <p className="mt-2 text-sm font-medium">{insights.value_angle}</p>}
      {insights.aha_moment && (
        <p className="mt-1.5 text-sm text-muted-foreground">{insights.aha_moment}</p>
      )}
    </section>
  );
}

function ChipRow({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs ring-1 ring-inset ring-border"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusTag({ verified, label }: { verified: boolean; label: string }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        verified
          ? "text-foreground ring-1 ring-inset ring-white/20"
          : "text-muted-foreground ring-1 ring-inset ring-border"
      )}
    >
      {verified && <Check className="size-3" aria-hidden />}
      {label}
    </span>
  );
}

export function LeadsTable({
  leads,
  avgDealValueCents,
  goalCents,
}: {
  leads: LeadRow[];
  avgDealValueCents: number | null;
  goalCents: number | null;
}) {
  const [selected, setSelected] = useState<LeadRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border" data-copilot="leads-table">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Prospect</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Channels</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelected(lead)}
                className="cursor-pointer border-t border-border hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{leadName(lead)}</p>
                  {lead.title && <p className="text-xs text-muted-foreground">{lead.title}</p>}
                </td>
                <td className="px-4 py-3">
                  <p>{lead.company_name ?? "—"}</p>
                  {lead.industry && (
                    <p className="text-xs text-muted-foreground">{lead.industry}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3 font-medium tabular-nums">{lead.ai_score ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex gap-1.5">
                    <Mail
                      className={cn(
                        "size-4",
                        lead.email ? "text-foreground" : "text-muted-foreground/30"
                      )}
                    />
                    <UserPlus
                      className={cn(
                        "size-4",
                        lead.linkedin_url ? "text-foreground" : "text-muted-foreground/30"
                      )}
                    />
                    <Phone
                      className={cn(
                        "size-4",
                        lead.phone ? "text-foreground" : "text-muted-foreground/30"
                      )}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelected(null)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
            {/* Hero: who they are + the verdict you feel + ai's reasoning */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{leadName(selected)}</h2>
                <p className="text-sm text-muted-foreground">
                  {[selected.title, selected.company_name].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <VerdictChip score={selected.ai_score} />
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            {selected.ai_rationale && (
              <p className="mt-3 text-sm text-muted-foreground">{selected.ai_rationale}</p>
            )}

            {/* The money on the table — goal-gradient */}
            <RevenuePill avgDealValueCents={avgDealValueCents} goalCents={goalCents} />

            <div className="mt-6 space-y-5">
              {/* Peak moment: the AI's ready-made way in */}
              {selected.ai_insights && <OpeningCard insights={selected.ai_insights} />}

              {(() => {
                const reply = latestReply(selected);
                if (!reply) return null;
                return (
                  <section className={cn(PANEL_SURFACE, "space-y-2 p-4")}>
                    <div className="flex items-center justify-between">
                      <Eyebrow>Replied</Eyebrow>
                      {reply.classification && (
                        <Badge
                          variant={reply.classification === "interested" ? "default" : "secondary"}
                        >
                          {REPLY_LABELS[reply.classification] ?? reply.classification}
                        </Badge>
                      )}
                    </div>
                    {reply.classification_rationale && (
                      <p className="text-xs text-muted-foreground">
                        {reply.classification_rationale}
                      </p>
                    )}
                    {reply.body && (
                      <p className="text-sm text-muted-foreground">
                        “{reply.body.slice(0, 200)}
                        {reply.body.length > 200 ? "…" : ""}”
                      </p>
                    )}
                  </section>
                );
              })()}

              {selected.ai_insights && (
                <section className="space-y-3">
                  <Eyebrow>Why they’re a fit</Eyebrow>
                  {selected.ai_insights.summary && (
                    <p className="text-sm text-muted-foreground">{selected.ai_insights.summary}</p>
                  )}
                  <ChipRow label="Pain points" items={selected.ai_insights.pain_points} />
                  <ChipRow label="Triggers" items={selected.ai_insights.triggers} />
                  <ChipRow label="Motivations" items={selected.ai_insights.motivations} />
                </section>
              )}

              {selected.status === "rejected" &&
                selected.rules_gate_reasons &&
                selected.rules_gate_reasons.length > 0 && (
                  <section>
                    <Eyebrow>Why it was filtered out</Eyebrow>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {selected.rules_gate_reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </section>
                )}

              <section className="space-y-2.5">
                <Eyebrow>Contact</Eyebrow>
                {selected.email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{selected.email}</span>
                    <StatusTag
                      verified={isVerified(selected.email_status)}
                      label={humanizeEmailStatus(selected.email_status)}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No email yet</p>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{selected.phone}</span>
                    <StatusTag
                      verified={isVerified(selected.phone_status)}
                      label={humanizePhoneStatus(selected.phone_status)}
                    />
                  </div>
                )}
                {selected.linkedin_url && (
                  <a
                    href={selected.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm underline underline-offset-2"
                  >
                    <UserPlus className="size-4 text-muted-foreground" aria-hidden /> LinkedIn
                    profile <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </section>

              {selected.location && (
                <section>
                  <Eyebrow>Location</Eyebrow>
                  <p className="mt-1.5 text-sm">{selected.location}</p>
                </section>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

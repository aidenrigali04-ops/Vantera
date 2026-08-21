"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadCrmControls } from "@/components/lead-crm-controls";
import { SourceBadge, WhyNowLine } from "@/components/lead-why-now";
import { projectedRevenue } from "@/app/(app)/leads/lead-value";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Shared "lead profiler" — the full prospect-enrichment slide-over used
// everywhere a lead surfaces (Leads, Dashboard prospects, Warm replies, Review).
// Fields are a superset; any surface can hydrate as much as it has.

export interface LeadProfileInsights {
  pain_points?: string[];
  triggers?: string[];
  motivations?: string[];
  value_angle?: string;
  aha_moment?: string;
  summary?: string;
}

export interface LeadProfile {
  id?: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  tech_stack: string[] | null;
  status: string;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: LeadProfileInsights | null;
  scored_at?: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  phone_status: string | null;
  linkedin_url: string | null;
  /** where the lead entered the funnel — "intent" drives the In-market badge */
  source?: string | null;
  /** real captured buying signals (lead_signals, 0031) — the "why now" line, when present */
  lead_signals?: { kind: string; label: string | null; detail?: string | null; observed_at?: string | null }[] | null;
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

function leadName(lead: LeadProfile): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

// Data recency from the last AI-score (report #9: stale data is a top churn driver — outreach off
// months-old intel erodes trust). 30-day window flags aging research; self-contained so the shared
// profiler carries no page-level dependency.
const FRESHNESS_STALE_DAYS = 30;
function freshness(scoredAt: string | null | undefined): { label: string; stale: boolean } | null {
  if (!scoredAt) return null;
  const t = new Date(scoredAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return { label: "just now", stale: false };
  const label =
    days === 0 ? "today" : days < 14 ? `${days}d ago` : days < 60 ? `${Math.round(days / 7)}w ago` : `${Math.round(days / 30)}mo ago`;
  return { label, stale: days > FRESHNESS_STALE_DAYS };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function InsightList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Controlled slide-over. Render when you own the open/selected state. */
export function LeadProfileSheet({
  lead,
  onClose,
  avgDealValueCents = null,
  goalCents = null,
  fullProfileHref,
}: {
  lead: LeadProfile;
  onClose: () => void;
  /** enables the "Worth" line under the fit score (uses the account's real avg deal value) */
  avgDealValueCents?: number | null;
  goalCents?: number | null;
  /** when set, a pinned footer links through to the full-page brief */
  fullProfileHref?: string;
}) {
  const insights = lead.ai_insights;
  const proj = projectedRevenue(avgDealValueCents, goalCents, lead.ai_score);

  // A slide-over is a dialog: Escape must close it (keyboard parity with the overlay click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={leadName(lead)}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l bg-background shadow-xl"
      >
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{leadName(lead)}</h2>
              <SourceBadge source={lead.source} />
            </div>
            <p className="text-sm text-muted-foreground">
              {[lead.title, lead.company_name].filter(Boolean).join(" · ")}
            </p>
            <WhyNowLine lead={lead} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{STATUS_LABELS[lead.status] ?? lead.status}</Badge>
              {(() => {
                const f = freshness(lead.scored_at);
                if (!f) return null;
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ${
                      f.stale
                        ? "bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300"
                        : "text-muted-foreground ring-1 ring-inset ring-border"
                    }`}
                  >
                    <Clock className="size-3" aria-hidden />
                    {f.stale ? `Researched ${f.label} · may be stale` : `Researched ${f.label}`}
                  </span>
                );
              })()}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fit score</p>
              <p className="font-mono text-3xl font-semibold tabular-nums">{lead.ai_score ?? "—"}</p>
            </div>
            {/* Value framing — same worth-toward-goal line as the table and Hot strip. */}
            {proj && (
              <p className="mt-1 text-right text-xs text-muted-foreground">
                Worth <span className="font-data font-semibold text-foreground">{usd.format(proj.valueCents / 100)}</span>
                {proj.dealsToGoal != null && <> · 1 of ~{proj.dealsToGoal} to your goal</>}
              </p>
            )}
            {lead.ai_rationale && (
              <p className="mt-2 text-sm text-muted-foreground">{lead.ai_rationale}</p>
            )}
          </section>

          {insights && (
            <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Why this prospect</p>
              {insights.summary && <p className="text-sm">{insights.summary}</p>}
              <InsightList label="Pain points" items={insights.pain_points} />
              <InsightList label="Buying triggers" items={insights.triggers} />
              <InsightList label="Motivations" items={insights.motivations} />
              {insights.value_angle && <Field label="Value angle">{insights.value_angle}</Field>}
              {insights.aha_moment && <Field label="Aha moment">{insights.aha_moment}</Field>}
            </section>
          )}

          <section className="grid grid-cols-2 gap-4">
            <Field label="Company">{lead.company_name ?? "—"}</Field>
            <Field label="Headcount">{lead.company_size ?? "—"}</Field>
            <Field label="Industry">{lead.industry ?? "—"}</Field>
            <Field label="Location">{lead.location ?? "—"}</Field>
          </section>

          {lead.tech_stack && lead.tech_stack.length > 0 && (
            <section>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tech stack</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lead.tech_stack.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* LinkedIn-only platform: the prospect's profile link is the contact surface —
              email/phone stay internal (CRM-push dedupe data), never product UI. */}
          {lead.linkedin_url && (
            <section>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">LinkedIn</p>
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-sm underline underline-offset-2"
              >
                LinkedIn profile <ExternalLink className="size-3" />
              </a>
            </section>
          )}

          {lead.id && <LeadCrmControls leadId={lead.id} status={lead.status} />}
        </div>
      </div>

      {/* Pinned footer — the peek is for working the lead in place; the full brief is one click. */}
      {fullProfileHref && (
        <div className="shrink-0 border-t border-[var(--hairline)] bg-background p-4">
          <Link
            href={fullProfileHref}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--cyan-line)] hover:bg-[var(--cyan-tint)]"
          >
            Open full profile <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
      </motion.aside>
    </>
  );
}

/** Self-contained trigger: renders `children` as a button that opens the profiler. */
export function LeadProfileLink({
  lead,
  children,
  className,
}: {
  lead: LeadProfile | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!lead) return <span className={className}>{children}</span>;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      {open && <LeadProfileSheet lead={lead} onClose={() => setOpen(false)} />}
    </>
  );
}

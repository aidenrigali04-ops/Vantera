"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp, Clock, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadCrmControls } from "@/components/lead-crm-controls";
import { LeadFitControls } from "@/components/lead-fit-controls";
import type { FitVerdict } from "@/lib/learning/fit";
import { SourceBadge, WhyNowCellView, WhyNowLine } from "@/components/lead-why-now";
import { projectedRevenue } from "@/app/(app)/prospects/lead-value";
import type { IntentPostIn, WhyNowCell } from "@/lib/prospects/why-now-cell";
import {
  MessageSection,
  Section,
  SignalsTimeline,
  type QueuedDraft,
  type RegenerateDraft,
} from "@/components/lead-profile/sections";

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
  lead_signals?: { kind: string; label: string | null; detail?: string | null; level?: string | null; source?: string | null; observed_at?: string | null }[] | null;
  /** ML-2: what in this prospect matches the people who actually reply (account's own outcomes) */
  learned_reasons?: { label: string; ratio: number }[] | null;
  /** ML-4: the user's own "Good fit" / "Not a fit" verdict */
  fit_verdict?: FitVerdict | null;
  /** UX-2: the saved "why not a fit" note */
  fit_reason?: string | null;
  /** UX-2: the precomputed reason cell (server-side `when`, no clock read in render) */
  why_now?: WhyNowCell;
  /** UX-2: in-market posts behind the intent signal */
  intent_posts?: IntentPostIn[];
  /** UX-2: the prospect's queued draft, if one is waiting */
  queued_draft?: QueuedDraft | null;
}

export type PeekNavProps = { index: number; total: number; onPrev: () => void; onNext: () => void };

/** Arrow keys walk the list — but never while typing in a field. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

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
  nav,
  initialSection,
  onRegenerate,
}: {
  lead: LeadProfile;
  onClose: () => void;
  /** enables the "Worth" line under the fit score (uses the account's real avg deal value) */
  avgDealValueCents?: number | null;
  goalCents?: number | null;
  /** when set, a pinned footer links through to the full-page brief */
  fullProfileHref?: string;
  /** prev/next over the caller's list (Prospects table); omitted elsewhere */
  nav?: PeekNavProps;
  /** open + scroll to this section first (the table's `+N` chip opens Signals) */
  initialSection?: "signals" | "message";
  /** steerable regenerate for the queued draft — the control is hidden until a caller supplies it */
  onRegenerate?: RegenerateDraft;
}) {
  const insights = lead.ai_insights;
  const proj = projectedRevenue(avgDealValueCents, goalCents, lead.ai_score);
  // Footer "Not a fit" → remount the Fit section focused with the reason input open.
  const [fitAsk, setFitAsk] = useState(0);

  // A slide-over is a dialog: Escape must close it (keyboard parity with the overlay click);
  // ↑/↓ step through the list when the caller provides navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (nav && !isEditable(e.target)) {
        if (e.key === "ArrowUp" && nav.index > 0) {
          e.preventDefault();
          nav.onPrev();
        } else if (e.key === "ArrowDown" && nav.index < nav.total - 1) {
          e.preventDefault();
          nav.onNext();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, nav]);

  const signals = lead.lead_signals ?? [];
  const posts = lead.intent_posts ?? [];
  const postTitle = lead.why_now?.href
    ? (posts.find((p) => p.post_ref === lead.why_now?.href)?.headline ?? null)
    : null;

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
            {lead.why_now !== undefined ? (
              <WhyNowCellView cell={lead.why_now} postTitle={postTitle} className="mt-1" />
            ) : (
              <WhyNowLine lead={lead} />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{STATUS_LABELS[lead.status] ?? lead.status}</Badge>
              {(() => {
                const f = freshness(lead.scored_at);
                if (!f) return null;
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ${
                      f.stale
                        ? "bg-[var(--attention-tint)] text-[var(--attention)]"
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
          <div className="flex shrink-0 items-center gap-1">
            {nav && nav.index >= 0 && (
              <>
                <span className="mr-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {nav.index + 1} of {nav.total}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={nav.onPrev}
                  disabled={nav.index <= 0}
                  aria-label="Previous prospect"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={nav.onNext}
                  disabled={nav.index >= nav.total - 1}
                  aria-label="Next prospect"
                >
                  <ChevronDown className="size-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Keyed by lead so prev/next resets every section's local state (draft edits, fit step). */}
        <div key={lead.id ?? leadName(lead)} className="mt-6 space-y-4">
          <Section id="signals" title="Signals" focus={initialSection === "signals"}>
            <SignalsTimeline signals={signals} posts={posts} />
          </Section>

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
            {lead.learned_reasons && lead.learned_reasons.length > 0 && (
              <LearnedReasons reasons={lead.learned_reasons} />
            )}
            {!proj && !lead.ai_rationale && !(lead.learned_reasons && lead.learned_reasons.length > 0) && (
              <p className="text-sm text-muted-foreground">Not scored yet.</p>
            )}
          </Section>

          {insights && (
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
          )}

          <Section id="company" title="Company">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company">{lead.company_name ?? "—"}</Field>
              <Field label="Headcount">{lead.company_size ?? "—"}</Field>
              <Field label="Industry">{lead.industry ?? "—"}</Field>
              <Field label="Location">{lead.location ?? "—"}</Field>
            </div>
            {lead.tech_stack && lead.tech_stack.length > 0 && (
              <div className="mt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tech stack</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lead.tech_stack.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {/* LinkedIn-only platform: the prospect's profile link is the contact surface —
                email/phone stay internal (CRM-push dedupe data), never product UI. */}
            {lead.linkedin_url && (
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-1 text-sm underline underline-offset-2"
              >
                LinkedIn profile <ExternalLink className="size-3" />
              </a>
            )}
          </Section>

          {lead.queued_draft && (
            <Section id="message" title="Message" focus={initialSection === "message"}>
              <MessageSection draft={lead.queued_draft} onRegenerate={onRegenerate} />
            </Section>
          )}

          {lead.id && (
            <Section key={`fit-${fitAsk}`} id="fit" title="Fit" focus={fitAsk > 0}>
              <LeadFitControls
                key={lead.id}
                leadId={lead.id}
                verdict={lead.fit_verdict ?? null}
                reason={lead.fit_reason ?? null}
                askReason={fitAsk > 0}
              />
            </Section>
          )}

          {lead.id && (
            <Section id="crm" title="CRM">
              <LeadCrmControls leadId={lead.id} status={lead.status} />
            </Section>
          )}

          {/* Notes need server data the row doesn't carry — the peek stays fetch-free and links through. */}
          {lead.id && fullProfileHref && (
            <Section id="notes" title="Notes" defaultOpen={false}>
              <Link
                href={`${fullProfileHref}#notes`}
                className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
              >
                Read and add notes in the full brief <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Section>
          )}
        </div>
      </div>

      {/* Pinned footer — the peek is for working the lead in place; the full brief is one click. */}
      {(fullProfileHref || (lead.id && !lead.fit_verdict)) && (
        <div className="flex shrink-0 gap-2 border-t border-[var(--hairline)] bg-background p-4">
          {lead.id && !lead.fit_verdict && (
            <button
              type="button"
              onClick={() => setFitAsk((n) => n + 1)}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--hairline)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            >
              Not a fit
            </button>
          )}
          {fullProfileHref && (
            <Link
              href={fullProfileHref}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--cyan-line)] hover:bg-[var(--cyan-tint)]"
            >
              Open full brief <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
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

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadge, WhyNowCellView, WhyNowLine } from "@/components/lead-why-now";
import { freshness } from "@/components/lead-profile/freshness";
import { handleProfileKey } from "@/components/lead-profile/profile-keys";
import {
  CompanySection,
  CrmSection,
  FitSection,
  MessageSection,
  NotesSection,
  ProspectSection,
  RankSection,
  Section,
  SignalsSection,
} from "@/components/lead-profile/sections";
import type { LeadProfile, PeekNavProps, RegenerateDraft } from "@/components/lead-profile/types";

export type { LeadProfile, LeadProfileInsights, PeekNavProps } from "@/components/lead-profile/types";

// Shared "lead profiler" — the full prospect-enrichment slide-over used
// everywhere a lead surfaces (Leads, Dashboard prospects, Warm replies, Review).
// Fields are a superset; any surface can hydrate as much as it has. This file is the shell
// (header, ←/→ nav, pinned footer); each section lives in `lead-profile/sections/`.

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
  // Footer "Not a fit" → remount the Fit section focused with the reason input open.
  const [fitAsk, setFitAsk] = useState(0);

  // Escape closes; ←/→ step through the list when the caller provides navigation. Callers pass
  // fresh closures each render, so the latest ones ride a ref and the window listener binds once.
  const keys = useRef({ onClose, nav });
  useEffect(() => {
    keys.current = { onClose, nav };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleProfileKey(e, keys.current.onClose, keys.current.nav);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
                  aria-keyshortcuts="ArrowLeft"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={nav.onNext}
                  disabled={nav.index >= nav.total - 1}
                  aria-label="Next prospect"
                  aria-keyshortcuts="ArrowRight"
                >
                  <ChevronRight className="size-4" />
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
          <SignalsSection signals={lead.lead_signals ?? []} posts={posts} focus={initialSection === "signals"} />
          <RankSection lead={lead} avgDealValueCents={avgDealValueCents} goalCents={goalCents} />
          <ProspectSection insights={lead.ai_insights} />
          <CompanySection lead={lead} />
          {lead.queued_draft && (
            <Section id="message" title="Message" focus={initialSection === "message"}>
              <MessageSection draft={lead.queued_draft} onRegenerate={onRegenerate} />
            </Section>
          )}
          {lead.id && <FitSection leadId={lead.id} verdict={lead.fit_verdict ?? null} reason={lead.fit_reason ?? null} ask={fitAsk} />}
          {lead.id && <CrmSection leadId={lead.id} status={lead.status} />}
          {lead.id && fullProfileHref && <NotesSection fullProfileHref={fullProfileHref} />}
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

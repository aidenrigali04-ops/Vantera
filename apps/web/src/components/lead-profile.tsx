"use client";

import { useState } from "react";
import { ExternalLink, Mail, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadCrmControls } from "@/components/lead-crm-controls";

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
  email: string | null;
  email_status: string | null;
  phone: string | null;
  phone_status: string | null;
  linkedin_url: string | null;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function InsightList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Controlled slide-over. Render when you own the open/selected state. */
export function LeadProfileSheet({ lead, onClose }: { lead: LeadProfile; onClose: () => void }) {
  const insights = lead.ai_insights;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l bg-background p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{leadName(lead)}</h2>
            <p className="text-sm text-muted-foreground">
              {[lead.title, lead.company_name].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2">
              <Badge>{STATUS_LABELS[lead.status] ?? lead.status}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium uppercase text-muted-foreground">Fit score</p>
              <p className="font-mono text-3xl font-semibold tabular-nums">{lead.ai_score ?? "—"}</p>
            </div>
            {lead.ai_rationale && (
              <p className="mt-2 text-sm text-muted-foreground">{lead.ai_rationale}</p>
            )}
          </section>

          {insights && (
            <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Why this prospect</p>
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
              <p className="text-xs font-medium uppercase text-muted-foreground">Tech stack</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lead.tech_stack.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Verified contact</p>
            {lead.email ? (
              <p className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <span className="truncate">{lead.email}</span>
                {lead.email_status && (
                  <Badge variant={lead.email_status === "valid" ? "default" : "secondary"}>
                    {lead.email_status}
                  </Badge>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No email yet</p>
            )}
            {lead.phone && (
              <p className="flex items-center gap-2 text-sm">
                <span>{lead.phone}</span>
                {lead.phone_status && (
                  <Badge variant={lead.phone_status === "valid" ? "default" : "secondary"}>
                    {lead.phone_status}
                  </Badge>
                )}
              </p>
            )}
            {lead.linkedin_url && (
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm underline underline-offset-2"
              >
                LinkedIn profile <ExternalLink className="size-3" />
              </a>
            )}
          </section>

          {lead.id && <LeadCrmControls leadId={lead.id} status={lead.status} />}
        </div>
      </aside>
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

"use client";

import { useState } from "react";
import { ExternalLink, Mail, MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function leadName(lead: LeadRow): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
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

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
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
                      className={`size-4 ${lead.email ? "text-foreground" : "text-muted-foreground/30"}`}
                    />
                    <MessageSquare
                      className={`size-4 ${lead.linkedin_url ? "text-foreground" : "text-muted-foreground/30"}`}
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
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{leadName(selected)}</h2>
                <p className="text-sm text-muted-foreground">
                  {[selected.title, selected.company_name].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2">
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-6 space-y-6">
              <section>
                <p className="text-xs font-medium uppercase text-muted-foreground">Score</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {selected.ai_score ?? "—"}
                </p>
                {selected.ai_rationale && (
                  <p className="mt-2 text-sm text-muted-foreground">{selected.ai_rationale}</p>
                )}
              </section>

              {(() => {
                const reply = latestReply(selected);
                if (!reply) return null;
                return (
                  <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Replied</p>
                      {reply.classification && (
                        <Badge
                          variant={reply.classification === "interested" ? "default" : "secondary"}
                        >
                          {REPLY_LABELS[reply.classification] ?? reply.classification}
                        </Badge>
                      )}
                    </div>
                    {reply.classification_rationale && (
                      <p className="text-xs text-muted-foreground">{reply.classification_rationale}</p>
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
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Why this lead
                  </p>
                  {selected.ai_insights.summary && (
                    <p className="text-sm">{selected.ai_insights.summary}</p>
                  )}
                  <InsightList label="Pain points" items={selected.ai_insights.pain_points} />
                  <InsightList label="Triggers" items={selected.ai_insights.triggers} />
                  <InsightList label="Motivations" items={selected.ai_insights.motivations} />
                  {selected.ai_insights.value_angle && (
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Value angle
                      </p>
                      <p className="mt-1 text-sm">{selected.ai_insights.value_angle}</p>
                    </div>
                  )}
                  {selected.ai_insights.aha_moment && (
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Aha moment
                      </p>
                      <p className="mt-1 text-sm">{selected.ai_insights.aha_moment}</p>
                    </div>
                  )}
                </section>
              )}

              {selected.status === "rejected" &&
                selected.rules_gate_reasons &&
                selected.rules_gate_reasons.length > 0 && (
                  <section>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Why it was filtered out
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {selected.rules_gate_reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </section>
                )}

              <section className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Contact</p>
                {selected.email ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="truncate">{selected.email}</span>
                    <Badge variant={selected.email_status === "valid" ? "default" : "secondary"}>
                      {selected.email_status}
                    </Badge>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No email yet</p>
                )}
                {selected.phone && (
                  <p className="text-sm">
                    {selected.phone}{" "}
                    <Badge variant={selected.phone_status === "valid" ? "default" : "secondary"}>
                      {selected.phone_status}
                    </Badge>
                  </p>
                )}
                {selected.linkedin_url && (
                  <a
                    href={selected.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm underline underline-offset-2"
                  >
                    LinkedIn profile <ExternalLink className="size-3" />
                  </a>
                )}
              </section>

              {selected.location && (
                <section>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Location</p>
                  <p className="mt-1 text-sm">{selected.location}</p>
                </section>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

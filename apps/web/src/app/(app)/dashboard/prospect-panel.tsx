"use client";

import { useState } from "react";
import { ExternalLink, Mail, MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ProspectInsights {
  pain_points?: string[];
  triggers?: string[];
  motivations?: string[];
  value_angle?: string;
  aha_moment?: string;
  summary?: string;
}

export interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  company_domain: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  tech_stack: string[] | null;
  status: string;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: ProspectInsights | null;
  email: string | null;
  email_status: string;
  phone: string | null;
  phone_status: string;
  linkedin_url: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  qualified: "Qualified",
  enriched: "Enriched",
  in_campaign: "In outreach",
  replied: "Replied",
  converted: "Converted",
};

function name(p: Prospect): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

function topSignal(p: Prospect): string | null {
  return p.ai_insights?.triggers?.[0] ?? p.ai_insights?.pain_points?.[0] ?? null;
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

export function ProspectPanel({ prospects }: { prospects: Prospect[] }) {
  const [selected, setSelected] = useState<Prospect | null>(null);

  if (prospects.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Qualified prospects appear here as your Prospect Agent sources and enriches them.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Prospect</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Company</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Top signal</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium text-right">Data</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p)}
                className="cursor-pointer border-t transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{name(p)}</p>
                  {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <p>{p.company_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.company_size && `${p.company_size} emp`, p.location].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="hidden max-w-[16rem] px-4 py-3 md:table-cell">
                  <p className="truncate text-xs text-muted-foreground">{topSignal(p) ?? "—"}</p>
                </td>
                <td className="px-4 py-3 font-mono font-medium tabular-nums">{p.ai_score ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1.5">
                    <Mail
                      className={`size-4 ${p.email ? "text-foreground" : "text-muted-foreground/30"}`}
                    />
                    <MessageSquare
                      className={`size-4 ${p.linkedin_url ? "text-foreground" : "text-muted-foreground/30"}`}
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
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l bg-background p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{name(selected)}</h2>
                <p className="text-sm text-muted-foreground">
                  {[selected.title, selected.company_name].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2">
                  <Badge>{STATUS_LABELS[selected.status] ?? selected.status}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-6 space-y-6">
              <section>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Fit score</p>
                  <p className="font-mono text-3xl font-semibold tabular-nums">
                    {selected.ai_score ?? "—"}
                  </p>
                </div>
                {selected.ai_rationale && (
                  <p className="mt-2 text-sm text-muted-foreground">{selected.ai_rationale}</p>
                )}
              </section>

              {selected.ai_insights && (
                <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Why this prospect</p>
                  {selected.ai_insights.summary && (
                    <p className="text-sm">{selected.ai_insights.summary}</p>
                  )}
                  <InsightList label="Pain points" items={selected.ai_insights.pain_points} />
                  <InsightList label="Buying triggers" items={selected.ai_insights.triggers} />
                  <InsightList label="Motivations" items={selected.ai_insights.motivations} />
                  {selected.ai_insights.value_angle && (
                    <Field label="Value angle">{selected.ai_insights.value_angle}</Field>
                  )}
                  {selected.ai_insights.aha_moment && (
                    <Field label="Aha moment">{selected.ai_insights.aha_moment}</Field>
                  )}
                </section>
              )}

              <section className="grid grid-cols-2 gap-4">
                <Field label="Company">{selected.company_name ?? "—"}</Field>
                <Field label="Headcount">{selected.company_size ? `${selected.company_size}` : "—"}</Field>
                <Field label="Industry">{selected.industry ?? "—"}</Field>
                <Field label="Location">{selected.location ?? "—"}</Field>
              </section>

              {selected.tech_stack && selected.tech_stack.length > 0 && (
                <section>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Tech stack</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.tech_stack.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Verified contact</p>
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
                  <p className="flex items-center gap-2 text-sm">
                    <span>{selected.phone}</span>
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
            </div>
          </aside>
        </>
      )}
    </>
  );
}

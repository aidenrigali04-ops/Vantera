import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { Badge } from "@/components/ui/badge";
import { PANEL_SURFACE } from "@/components/ui/panel";
import { LeadCrmControls } from "@/components/lead-crm-controls";
import { ModernTimeline, type TimelineItem } from "@/components/ui/modern-timeline";
import { cn } from "@/lib/utils";
import { projectedRevenue } from "../lead-value";
import { ReplyHandoff } from "../reply-panel";
import { EraseControl } from "./erase-control";

const LEAD_SELECT =
  "id, first_name, last_name, title, company_name, company_size, industry, location, tech_stack, status, source, ai_score, ai_rationale, ai_insights, rules_gate_reasons, scored_at, email, email_status, phone, phone_status, linkedin_url, created_at, replies(channel, classification, classification_rationale, body, received_at), lead_signals(kind, label, detail, observed_at)";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const REPLY_LABELS: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  neutral: "Neutral",
  out_of_office: "Out of office",
  bounce: "Bounced",
  unsubscribe: "Unsubscribed",
  other: "Other",
};

type Insights = {
  pain_points?: string[];
  triggers?: string[];
  motivations?: string[];
  value_angle?: string;
  aha_moment?: string;
  summary?: string;
};
type Reply = {
  channel: string | null;
  classification: string | null;
  classification_rationale: string | null;
  body: string | null;
  received_at: string | null;
};
type Signal = { kind: string; label: string | null; detail: string | null; observed_at: string | null };
type Lead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  tech_stack: string[] | null;
  status: string;
  source: string | null;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: Insights | null;
  rules_gate_reasons: string[] | null;
  scored_at: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  phone_status: string | null;
  linkedin_url: string | null;
  created_at: string | null;
  replies: Reply[] | null;
  lead_signals: Signal[] | null;
};

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

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);
const fmt = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "");

function fullName(l: Lead): string {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown prospect";
}

function freshness(scoredAt: string | null): { label: string; stale: boolean } | null {
  if (!scoredAt) return null;
  const t = new Date(scoredAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return { label: "just now", stale: false };
  const label = days === 0 ? "today" : days < 14 ? `${days}d ago` : days < 60 ? `${Math.round(days / 7)}w ago` : `${Math.round(days / 30)}mo ago`;
  return { label, stale: days > 30 };
}

const CLASS_LABEL: Record<string, string> = {
  positive: "Positive",
  interested: "Interested",
  meeting: "Meeting",
  neutral: "Neutral",
  objection: "Objection",
  not_interested: "Not interested",
  unsubscribe: "Opt-out",
};

/** The prospect's real journey, assembled from captured events — no placeholders. */
function buildTimeline(l: Lead): TimelineItem[] {
  const rows: { t: number; item: TimelineItem }[] = [];

  if (l.created_at)
    rows.push({
      t: ms(l.created_at),
      item: {
        title: l.source === "intent" ? "Surfaced from buying intent" : "Sourced from LinkedIn",
        category: "Pipeline",
        date: fmt(l.created_at),
        description:
          l.source === "intent"
            ? "Spotted showing in-market behavior on LinkedIn and pulled into your pipeline."
            : "Added to your pipeline by prospect sourcing.",
        status: "completed",
      },
    });

  if (l.scored_at)
    rows.push({
      t: ms(l.scored_at),
      item: {
        title: l.ai_score != null ? `Qualified — scored ${l.ai_score}` : "Qualified against your ICP",
        category: "Qualification",
        date: fmt(l.scored_at),
        description: l.ai_rationale ?? "Cleared your qualification bar on fit, seniority, and intent.",
        status: "completed",
      },
    });

  for (const s of l.lead_signals ?? [])
    rows.push({
      t: ms(s.observed_at),
      item: {
        title: s.label ?? "Buying signal detected",
        category: "Buying signal",
        date: fmt(s.observed_at),
        description: s.detail ?? undefined,
        status: "completed",
      },
    });

  for (const r of l.replies ?? [])
    rows.push({
      t: ms(r.received_at),
      item: {
        title: `Reply — ${CLASS_LABEL[r.classification ?? ""] ?? "received"}`,
        category: "Conversation",
        date: fmt(r.received_at),
        description: r.body ?? r.classification_rationale ?? undefined,
        status: "completed",
      },
    });

  rows.sort((a, b) => a.t - b.t);
  const items = rows.map((r) => r.item);
  if (items.length) items[items.length - 1].status = "current";

  // Goal-gradient: always show the next step so the journey points forward.
  const next: TimelineItem | null =
    l.status === "converted"
      ? { title: "Closed — meeting booked", category: "Won", description: "Revenue in your pipeline.", status: "current" }
      : l.status === "replied"
        ? { title: "Book the meeting", category: "Next", description: "A reply landed — take the conversation to a booked call.", status: "upcoming" }
        : l.status === "in_campaign"
          ? { title: "Awaiting reply", category: "Next", description: "Your outreach is out — replies surface here and pause the sequence for you.", status: "upcoming" }
          : l.status === "rejected"
            ? null
            : { title: "Outreach drafted for approval", category: "Next", description: "Your outreach layer writes a personalized message and queues it in Review.", status: "upcoming" };
  if (next) items.push(next);

  return items;
}

function Section({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn(PANEL_SURFACE, "p-5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">{label}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function InsightList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function LeadProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { account }] = await Promise.all([
    supabase.from("leads").select(LEAD_SELECT).eq("id", id).maybeSingle(),
    getGateData(),
  ]);
  const lead = data as unknown as Lead | null;
  if (!lead) notFound();

  const insights = lead.ai_insights;
  const f = freshness(lead.scored_at);
  const timeline = buildTimeline(lead);
  const proj = projectedRevenue(account?.avg_deal_value_cents ?? null, account?.revenue_goal_cents ?? null, lead.ai_score);
  const goalStr = account?.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : "";
  const latestReply =
    [...(lead.replies ?? [])].sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""))[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Leads
      </Link>

      {/* header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName(lead)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[lead.title, lead.company_name].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{STATUS_LABELS[lead.status] ?? lead.status}</Badge>
            {lead.source === "intent" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cyan-tint)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cyan-strong)]">
                <span className="size-1.5 rounded-full bg-[var(--cyan)]" /> In-market
              </span>
            )}
            {f && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]",
                  f.stale
                    ? "bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/30"
                    : "text-muted-foreground ring-1 ring-inset ring-border"
                )}
              >
                <Clock className="size-3" /> {f.stale ? `Researched ${f.label} · may be stale` : `Researched ${f.label}`}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Fit score</p>
          <p className="text-4xl font-semibold tabular-nums text-foreground">{lead.ai_score ?? "—"}</p>
        </div>
      </div>

      {/* body */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          {proj && (
            <section className={cn(PANEL_SURFACE, "p-5 ring-1 ring-inset ring-[var(--cyan-line)]")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">Worth pursuing</p>
              <p className="mt-1.5 text-3xl font-semibold tabular-nums text-foreground">≈ {usd.format(proj.valueCents / 100)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {proj.dealsToGoal != null && goalStr
                  ? `What a client like this is worth — one of ~${proj.dealsToGoal} closes to your ${goalStr} goal`
                  : "What a client like this is worth to you"}
              </p>
            </section>
          )}

          {lead.ai_rationale && (
            <Section label="Why this score">
              <p className="text-sm leading-relaxed text-[var(--ink-2)]">{lead.ai_rationale}</p>
            </Section>
          )}

          {latestReply && (
            <Section label="Latest reply">
              <div className="space-y-2">
                {latestReply.classification && (
                  <Badge variant={latestReply.classification === "interested" ? "default" : "secondary"}>
                    {REPLY_LABELS[latestReply.classification] ?? latestReply.classification}
                  </Badge>
                )}
                {latestReply.body && (
                  <p className="text-sm text-[var(--ink-2)]">
                    “{latestReply.body.slice(0, 240)}
                    {latestReply.body.length > 240 ? "…" : ""}”
                  </p>
                )}
                {lead.status === "replied" && latestReply.channel && (
                  <div className="border-t border-[var(--hairline)] pt-3">
                    <ReplyHandoff leadId={lead.id} channel={latestReply.channel as "email" | "linkedin"} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {lead.status === "rejected" && lead.rules_gate_reasons && lead.rules_gate_reasons.length > 0 && (
            <Section label="Why it was filtered out">
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {lead.rules_gate_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          )}

          {insights && (insights.summary || insights.pain_points?.length || insights.triggers?.length) && (
            <Section label="Why this prospect">
              <div className="space-y-3">
                {insights.summary && <p className="text-sm text-[var(--ink-2)]">{insights.summary}</p>}
                <InsightList label="Pain points" items={insights.pain_points} />
                <InsightList label="Buying triggers" items={insights.triggers} />
                <InsightList label="Motivations" items={insights.motivations} />
                {insights.value_angle && <Field label="Value angle">{insights.value_angle}</Field>}
                {insights.aha_moment && <Field label="Aha moment">{insights.aha_moment}</Field>}
              </div>
            </Section>
          )}

          <Section label="Company & contact">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company">{lead.company_name ?? "—"}</Field>
              <Field label="Headcount">{lead.company_size ?? "—"}</Field>
              <Field label="Industry">{lead.industry ?? "—"}</Field>
              <Field label="Location">{lead.location ?? "—"}</Field>
            </div>
            <div className="mt-4 space-y-2 border-t border-[var(--hairline)] pt-4">
              {lead.email ? (
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="truncate">{lead.email}</span>
                  {lead.email_status && <Badge variant={lead.email_status === "valid" ? "default" : "secondary"}>{lead.email_status}</Badge>}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No email yet</p>
              )}
              {lead.phone && (
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground" />
                  <span>{lead.phone}</span>
                  {lead.phone_status && <Badge variant={lead.phone_status === "valid" ? "default" : "secondary"}>{lead.phone_status}</Badge>}
                </p>
              )}
              {lead.linkedin_url && (
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--cyan-strong)] underline-offset-2 hover:underline"
                >
                  LinkedIn profile <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {lead.tech_stack && lead.tech_stack.length > 0 && (
              <div className="mt-4 border-t border-[var(--hairline)] pt-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tech stack</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lead.tech_stack.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <div className={cn(PANEL_SURFACE, "p-5")}>
            <LeadCrmControls leadId={lead.id} status={lead.status} />
          </div>

          <div className="border-t border-[var(--hairline)] pt-4">
            <EraseControl leadId={lead.id} />
          </div>
        </div>

        {/* activity timeline */}
        <Section label="Activity" className="lg:sticky lg:top-6">
          <ModernTimeline items={timeline} />
        </Section>
      </div>
    </div>
  );
}

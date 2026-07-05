import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { LeadCrmControls } from "@/components/lead-crm-controls";
import { ModernTimeline, type TimelineItem } from "@/components/ui/modern-timeline";
import { cn } from "@/lib/utils";
import {
  coolingState,
  dataFreshness,
  leadSignalLine,
  projectedRevenue,
  scoreVerdict,
} from "../lead-value";
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

const CLASS_LABEL: Record<string, string> = {
  positive: "Positive",
  interested: "Interested",
  meeting: "Meeting",
  neutral: "Neutral",
  objection: "Objection",
  not_interested: "Not interested",
  unsubscribe: "Opt-out",
};

/**
 * The prospect's real journey, newest first — no placeholders, and no re-stating what
 * the other panels already say in full: the Qualified row doesn't repeat the rationale
 * ("Why this score" owns it) and reply rows carry the excerpt the component clamps.
 */
function buildTimeline(l: Lead): TimelineItem[] {
  const rows: { t: number; item: TimelineItem }[] = [];

  if (l.created_at)
    rows.push({
      t: ms(l.created_at),
      item: {
        title: l.source === "intent" ? "Surfaced from buying intent" : "Sourced from LinkedIn",
        date: fmt(l.created_at),
        description:
          l.source === "intent" ? "Spotted showing in-market behavior on LinkedIn." : undefined,
      },
    });

  if (l.scored_at)
    rows.push({
      t: ms(l.scored_at),
      item: {
        title: l.ai_score != null ? `Qualified — scored ${l.ai_score}` : "Qualified against your ICP",
        date: fmt(l.scored_at),
      },
    });

  for (const s of l.lead_signals ?? [])
    rows.push({
      t: ms(s.observed_at),
      item: {
        title: s.label ?? "Buying signal detected",
        date: fmt(s.observed_at),
        description: s.detail ?? undefined,
      },
    });

  for (const r of l.replies ?? [])
    rows.push({
      t: ms(r.received_at),
      item: {
        title: `Reply — ${CLASS_LABEL[r.classification ?? ""] ?? "received"}`,
        date: fmt(r.received_at),
        description: r.body ?? r.classification_rationale ?? undefined,
      },
    });

  rows.sort((a, b) => b.t - a.t);
  const items = rows.map((r) => r.item);
  if (items.length) items[0].current = true;
  return items;
}

/**
 * Goal-gradient: the journey's forward pointer, pinned at the top of the Activity
 * panel so it can never scroll out of view. "Won" is the closed peak state.
 */
function nextStep(l: Lead): { label: "Next" | "Won"; title: string; description: string } | null {
  switch (l.status) {
    case "converted":
      return { label: "Won", title: "Closed — meeting booked", description: "Revenue in your pipeline." };
    case "replied":
      return {
        label: "Next",
        title: "Book the meeting",
        description: "A reply landed — take the conversation to a booked call.",
      };
    case "in_campaign":
      return {
        label: "Next",
        title: "Awaiting reply",
        description: "Your outreach is out — replies surface here and pause the sequence for you.",
      };
    case "rejected":
      return null;
    default:
      return {
        label: "Next",
        title: "Outreach drafted for approval",
        description: "Your outreach layer writes a personalized message and queues it in Review.",
      };
  }
}

function Section({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn(PANEL_SURFACE, "p-5", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

/** One line of the research brief — a fixed label gutter keeps the column scannable. */
function BriefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-t border-[var(--hairline)] py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <p className="w-24 shrink-0 pt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--ink-2)]">{children}</div>
    </div>
  );
}

const TECH_STACK_MAX = 6;

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
  const timeline = buildTimeline(lead);
  const next = nextStep(lead);
  const verdict = scoreVerdict(lead.ai_score);
  const fresh = dataFreshness(lead.scored_at);
  const proj = projectedRevenue(account?.avg_deal_value_cents ?? null, account?.revenue_goal_cents ?? null, lead.ai_score);
  const goalStr = account?.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : "";
  const latestReply =
    [...(lead.replies ?? [])].sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""))[0] ?? null;
  const cooling = coolingState(lead.status, latestReply?.received_at ?? null);
  const whyNow = leadSignalLine(lead.lead_signals, insights);
  const pains = insights?.pain_points?.slice(0, 2) ?? [];
  const techStack = lead.tech_stack ?? [];
  const techOverflow = techStack.length - TECH_STACK_MAX;

  return (
    // One-screen brief: the page itself never scrolls on desktop (viewport minus the
    // shell's py-6); a column scrolls internally only if its real data overflows.
    <div className="mx-auto flex w-full max-w-[1560px] flex-col lg:h-[calc(100dvh-3rem)]">
      <header className="shrink-0">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Leads
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
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
              {cooling && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/30">
                  <span className="size-1.5 rounded-full bg-amber-500" /> {cooling.label} — going cold
                </span>
              )}
              {fresh && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]",
                    fresh.stale
                      ? "bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/30"
                      : "text-muted-foreground ring-1 ring-inset ring-border"
                  )}
                >
                  <Clock className="size-3" /> {fresh.stale ? `Researched ${fresh.label} · may be stale` : `Researched ${fresh.label}`}
                </span>
              )}
            </div>
          </div>

          {/* Value framing, in the dashboard's stat idiom: eyebrow → font-data number → caption. */}
          <div className={cn(PANEL_SURFACE, "flex shrink-0 items-stretch px-5 py-4")}>
            <div className={cn(proj && "pr-6")}>
              <Eyebrow>Fit score</Eyebrow>
              <p className="mt-1 font-data text-3xl font-semibold tabular-nums">{lead.ai_score ?? "—"}</p>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  verdict.tier === "hot" ? "font-medium text-[var(--cyan-strong)]" : "text-muted-foreground"
                )}
              >
                {verdict.label}
              </p>
            </div>
            {proj && (
              <div className="border-l border-[var(--hairline)] pl-6">
                <Eyebrow>Projected value</Eyebrow>
                <p className="mt-1 font-data text-3xl font-semibold tabular-nums">
                  {usd.format(proj.valueCents / 100)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {proj.dealsToGoal != null && goalStr
                    ? `1 of ~${proj.dealsToGoal} wins to your ${goalStr}/mo goal`
                    : "Your average client value"}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mt-5 grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[1.15fr_1fr_1.05fr]">
        {/* Why — the research brief, summarized to what outreach actually uses. */}
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          <Section label="Why this prospect">
            {insights?.summary && (
              <p className="text-sm leading-relaxed text-[var(--ink-2)] lg:line-clamp-4">{insights.summary}</p>
            )}
            {(whyNow || pains.length > 0 || insights?.value_angle) && (
              <div className={cn(insights?.summary && "mt-3 border-t border-[var(--hairline)] pt-3")}>
                {whyNow && <BriefRow label="Why now">{whyNow}</BriefRow>}
                {pains.length > 0 && (
                  <BriefRow label="Pain points">
                    {pains.map((p, i) => (
                      <span key={i} className="block lg:line-clamp-2">
                        {p}
                      </span>
                    ))}
                  </BriefRow>
                )}
                {insights?.value_angle && <BriefRow label="Angle">{insights.value_angle}</BriefRow>}
              </div>
            )}
            {!insights && lead.status !== "rejected" && (
              <p className="text-sm text-muted-foreground">
                Research lands after your Scout&apos;s next pass — pain points, timing, and the angle to
                lead with will show here.
              </p>
            )}
          </Section>

          {lead.status === "rejected" && lead.rules_gate_reasons && lead.rules_gate_reasons.length > 0 ? (
            <Section label="Why it was filtered out">
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {lead.rules_gate_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          ) : (
            lead.ai_rationale && (
              <Section label="Why this score">
                <p className="text-sm leading-relaxed text-[var(--ink-2)] lg:line-clamp-5">{lead.ai_rationale}</p>
              </Section>
            )
          )}
        </div>

        {/* Act — the waiting conversation, the contact card, the deal controls. */}
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {latestReply && (
            <Section label="Latest reply">
              <div className="space-y-2">
                {latestReply.classification && (
                  <Badge variant={latestReply.classification === "interested" ? "default" : "secondary"}>
                    {REPLY_LABELS[latestReply.classification] ?? latestReply.classification}
                  </Badge>
                )}
                {latestReply.body && (
                  <p className="text-sm text-[var(--ink-2)] lg:line-clamp-3">“{latestReply.body}”</p>
                )}
                {lead.status === "replied" && latestReply.channel && (
                  <div className="border-t border-[var(--hairline)] pt-3">
                    <ReplyHandoff leadId={lead.id} channel={latestReply.channel as "email" | "linkedin"} />
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section label="Company & contact">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Company">{lead.company_name ?? "—"}</Field>
              <Field label="Headcount">{lead.company_size ?? "—"}</Field>
              <Field label="Industry">{lead.industry ?? "—"}</Field>
              <Field label="Location">{lead.location ?? "—"}</Field>
            </div>
            {/* LinkedIn-only platform: the profile link is the contact surface — email/phone
                stay internal (CRM-push dedupe data), never product UI. */}
            {lead.linkedin_url && (
              <div className="mt-4 border-t border-[var(--hairline)] pt-3">
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--cyan-strong)] underline-offset-2 hover:underline"
                >
                  LinkedIn profile <ExternalLink className="size-3" />
                </a>
              </div>
            )}
            {techStack.length > 0 && (
              <div className="mt-4 border-t border-[var(--hairline)] pt-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tech stack</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {techStack.slice(0, TECH_STACK_MAX).map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                  {techOverflow > 0 && (
                    <span className="text-xs text-muted-foreground">+{techOverflow} more</span>
                  )}
                </div>
              </div>
            )}
          </Section>

          <div className={cn(PANEL_SURFACE, "p-4")}>
            <LeadCrmControls leadId={lead.id} status={lead.status} />
          </div>

          <div className="flex justify-end">
            <EraseControl leadId={lead.id} />
          </div>
        </div>

        {/* Journey — next step pinned on top, history behind it; only the history scrolls. */}
        <section className={cn(PANEL_SURFACE, "flex min-h-0 flex-col p-5")}>
          <Eyebrow>Activity</Eyebrow>
          {next && (
            <div
              className={cn(
                "mt-3 shrink-0 rounded-xl px-3.5 py-2.5",
                next.label === "Won" ? "bg-[var(--positive-tint)]" : "bg-[var(--cyan-tint)]"
              )}
            >
              <p
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.18em]",
                  next.label === "Won" ? "text-[var(--positive)]" : "text-[var(--cyan-strong)]"
                )}
              >
                {next.label}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{next.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-3)]">{next.description}</p>
            </div>
          )}
          <div className="mt-4 min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
            {timeline.length > 0 ? (
              <ModernTimeline items={timeline} />
            ) : (
              <p className="text-sm text-muted-foreground">No activity captured yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

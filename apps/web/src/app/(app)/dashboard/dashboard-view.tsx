"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Inbox,
  Mail,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { Reveal, RevealItem, Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { ProspectPanel, type Prospect } from "./prospect-panel";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import type { RevenuePoint, RevenueSnapshot } from "@/lib/revenue";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Relative-time strings are formatted on the SERVER (page.tsx) and passed in as
// ready labels — never recomputed here. This is a client component, so calling
// Date.now() during render would diverge between SSR and hydration and trip a
// hydration mismatch (it did, before this split).

export type AgentRow = {
  id: string;
  kind: string;
  name: string;
  status: string;
  nextRunLabel: string;
};

export type ReplyRow = {
  id: string;
  channel: "email" | "linkedin";
  body: string | null;
  receivedLabel: string;
  lead_id: string;
  leads: LeadProfile | null;
};

export interface DashboardViewProps {
  firstName: string;
  icp: string | null;
  industry: string | null;
  goal: string | null;
  goalCents: number | null;
  isNew: boolean;
  scoutDeployed: boolean;
  drafts: number;
  agents: AgentRow[];
  liveAgentsCount: number;
  scoutNextRunLabel: string;
  scoutLastRunLabel: string;
  scoutLive: boolean;
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  series: RevenuePoint[];
  funnel: { label: string; count: number; href: string }[];
  reached: number;
  prospects: Prospect[];
  recentReplies: ReplyRow[];
  interested: number;
  channels: { mbActive: number; mbWarming: number; mbTotal: number; liStatus: string | null };
  week: { sends: number; email: number; li: number; replies: number };
}

export function DashboardView(props: DashboardViewProps) {
  const { firstName, icp, industry, goal, isNew } = props;

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Header — eyebrow + display heading in the landing idiom */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <Eyebrow>Command center</Eyebrow>
          <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Good to see you, {firstName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Targeting <span className="font-medium text-foreground">{icp}</span> in{" "}
            <span className="font-medium text-foreground">{industry}</span>
            {goal && (
              <>
                {" "}
                — goal <span className="font-medium text-foreground">{goal}/mo</span>
              </>
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Edit goal</Link>
        </Button>
      </motion.header>

      {isNew ? (
        <ActivationRamp scoutDeployed={props.scoutDeployed} goal={goal} />
      ) : (
        <WorkingDashboard {...props} />
      )}
    </div>
    </MotionConfig>
  );
}

function WorkingDashboard(props: DashboardViewProps) {
  const {
    drafts,
    liveAgentsCount,
    scoutNextRunLabel,
    revenue,
    convertedClients,
    pipelineLeads,
    goal,
    goalCents,
    series,
    funnel,
    reached,
    prospects,
    agents,
    recentReplies,
    interested,
    channels,
    week,
    scoutLive,
    scoutLastRunLabel,
  } = props;

  return (
    <Reveal className="flex flex-col gap-6">
      {/* Top row: the one primary action (left) + revenue dopamine (right) */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <RevealItem className={cn(PANEL_SURFACE, "p-5", drafts > 0 && "dark:bg-white/[0.06]")}>
          {drafts > 0 ? (
            <div className="flex h-full flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                  <Inbox className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {drafts} {drafts === 1 ? "draft is" : "drafts are"} waiting for your review
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nothing sends until you approve it. A few minutes keeps the pipeline moving.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href="/review">
                  Review now <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                  <p className="text-sm text-muted-foreground">
                    {liveAgentsCount > 0
                      ? `Your agent runs ${scoutNextRunLabel} — new drafts land here as leads qualify.`
                      : "Deploy an Outreach Agent to start drafting personalized outreach."}
                  </p>
                </div>
              </div>
              {liveAgentsCount === 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/agents">View agents</Link>
                </Button>
              )}
            </div>
          )}
        </RevealItem>

        <RevenueCard
          revenue={revenue}
          convertedClients={convertedClients}
          pipelineLeads={pipelineLeads}
          goal={goal}
          goalCents={goalCents}
          series={series}
        />
      </div>

      {/* Pipeline funnel — real counts */}
      <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
        <Eyebrow>Pipeline</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-5">
          {funnel.map((stage) => (
            <Link
              key={stage.label}
              href={stage.href}
              className="group flex flex-col gap-1 bg-background/40 px-4 py-4 transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:bg-background/20"
            >
              <span className="font-mono text-2xl font-semibold tabular-nums">{stage.count}</span>
              <span className="text-xs text-muted-foreground group-hover:text-foreground">
                {stage.label}
              </span>
            </Link>
          ))}
        </div>
        <AnimatedProgress value={(reached / funnel.length) * 100} className="mt-4" />
        <p className="mt-2 text-xs text-muted-foreground">
          {convertedClients > 0
            ? `${convertedClients} ${convertedClients === 1 ? "lead" : "leads"} converted toward your ${goal ?? "revenue"} goal.`
            : "Leads flow left to right as your agents work. Revenue tracking arrives with Analytics."}
        </p>
      </RevealItem>

      {/* Recent prospects */}
      <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Eyebrow>Recent prospects</Eyebrow>
            <p className="mt-2 text-xs text-muted-foreground">
              Sourced, scored, and enriched by your Prospect Agent — click any row for the full profile.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/leads">
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-4">
          <ProspectPanel prospects={prospects} />
        </div>
      </RevealItem>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Agent heartbeat */}
        <RevealItem className={cn(PANEL_SURFACE, "flex flex-col gap-3 p-5")}>
          <Eyebrow>Your agents</Eyebrow>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents deployed yet.</p>
          ) : (
            agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      a.status === "live" ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/40"
                    }`}
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant="secondary" className="capitalize">
                    {a.kind === "scout" ? "Prospect" : a.kind === "caller" ? "Caller" : "Outreach"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {a.status === "live"
                    ? `next run ${a.nextRunLabel}`
                    : a.status === "paused"
                      ? "paused"
                      : "draft"}
                </span>
              </div>
            ))
          )}
          {scoutLive && (
            <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Last sourced {scoutLastRunLabel}. Quiet stretches are normal — your agent only
              keeps high-quality leads.
            </p>
          )}
          <Button asChild variant="ghost" size="sm" className="-mx-2 mt-1 justify-start">
            <Link href="/agents">
              Manage agents <ArrowRight className="size-4" />
            </Link>
          </Button>
        </RevealItem>

        {/* Warm replies */}
        <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Warm replies</Eyebrow>
            {interested > 0 && <Badge variant="secondary">{interested}</Badge>}
          </div>
          <div className="mt-4">
            {!recentReplies || recentReplies.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Sparkles className="size-6 text-muted-foreground" />
                <p className="max-w-xs text-sm text-muted-foreground">
                  Interested replies show up here the moment they land. This is the number that
                  matters most.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {recentReplies.map((r, i) => {
                  const name =
                    [r.leads?.first_name, r.leads?.last_name].filter(Boolean).join(" ") ||
                    "A prospect";
                  const fresh = i === 0;
                  return (
                    <li key={r.id}>
                      <LeadProfileLink
                        lead={r.leads}
                        className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04] ${
                          fresh ? "bg-foreground/[0.04]" : ""
                        }`}
                      >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground">
                          {r.channel === "email" ? (
                            <Mail className="size-3.5" />
                          ) : (
                            <MessageSquare className="size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{name}</span>
                            {fresh && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                New
                              </Badge>
                            )}
                            {r.leads?.company_name && (
                              <span className="truncate text-xs text-muted-foreground">
                                {r.leads.company_name}
                              </span>
                            )}
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                              {r.receivedLabel}
                            </span>
                          </span>
                          {r.body && (
                            <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {r.body}
                            </span>
                          )}
                        </span>
                      </LeadProfileLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </RevealItem>

        {/* Channels readiness */}
        <RevealItem className={cn(PANEL_SURFACE, "flex flex-col gap-3 p-5")}>
          <Eyebrow>Channels</Eyebrow>
          <ChannelRow
            icon={<Mail className="size-4" />}
            label="Email"
            ready={channels.mbActive > 0}
            detail={
              channels.mbTotal === 0
                ? "Not set up"
                : [
                    channels.mbActive ? `${channels.mbActive} active` : null,
                    channels.mbWarming ? `${channels.mbWarming} warming` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <ChannelRow
            icon={<MessageSquare className="size-4" />}
            label="LinkedIn"
            ready={channels.liStatus === "active"}
            detail={
              channels.liStatus === "active"
                ? "Connected"
                : channels.liStatus === "restricted"
                  ? "Restricted"
                  : channels.liStatus
                    ? "Connecting"
                    : "Not connected"
            }
          />
          <Button asChild variant="ghost" size="sm" className="-mx-2 mt-1 justify-start">
            <Link href="/settings/channels">
              Manage channels <ArrowRight className="size-4" />
            </Link>
          </Button>
        </RevealItem>

        {/* This week */}
        <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>This week</Eyebrow>
            <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              <Activity className="size-3.5" /> last 7 days
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <span className="font-mono text-2xl font-semibold tabular-nums">{week.sends}</span>
              <p className="text-xs text-muted-foreground">Messages sent</p>
            </div>
            <div>
              <span className="font-mono text-2xl font-semibold tabular-nums">{week.replies}</span>
              <p className="text-xs text-muted-foreground">Replies in</p>
            </div>
          </div>
          <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {week.sends > 0
              ? `${week.email} email · ${week.li} LinkedIn`
              : "No sends yet this week — drafts you approve are sent here."}
          </p>
        </RevealItem>
      </div>
    </Reveal>
  );
}

function ChannelRow({
  icon,
  label,
  detail,
  ready,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {detail}
        <span
          className={`size-2 rounded-full ${ready ? "bg-emerald-400" : "bg-muted-foreground/40"}`}
          aria-hidden
        />
      </span>
    </div>
  );
}

function RevenueCard({
  revenue,
  convertedClients,
  pipelineLeads,
  goal,
  goalCents,
  series,
}: {
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  goal: string | null;
  goalCents: number | null;
  series: RevenuePoint[];
}) {
  const projectedTotalCents = revenue.closedCents + revenue.expectedCents;
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-revenue">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Revenue</Eyebrow>
        <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="size-3.5" /> {goal ? `goal ${goal}/mo` : "vs goal"}
        </span>
      </div>
      <div className="mt-4">
        {revenue.hasValue ? (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-2">
              <div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-foreground" /> Closed ·{" "}
                  {convertedClients} {convertedClients === 1 ? "client" : "clients"}
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {usd.format(revenue.closedCents / 100)}
                </span>
              </div>
              <div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-foreground/40" /> Projected ·{" "}
                  {pipelineLeads} in pipeline
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground">
                  {usd.format(projectedTotalCents / 100)}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <RevenueChart data={series} goalCents={goalCents} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {revenue.closedPctOfGoal !== null ? (
                <>
                  <span className="font-medium text-foreground">{revenue.closedPctOfGoal}%</span> of
                  your {goal}/mo goal closed
                  {revenue.projectedPctOfGoal !== null &&
                    ` — projected ${revenue.projectedPctOfGoal}% as your pipeline closes`}
                  .
                </>
              ) : (
                "Set a monthly revenue goal in Settings to track progress."
              )}
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {convertedClients}
                </span>
                <p className="text-xs text-muted-foreground">
                  Closed {convertedClients === 1 ? "client" : "clients"}
                </p>
              </div>
              <div>
                <span className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground">
                  {pipelineLeads}
                </span>
                <p className="text-xs text-muted-foreground">In pipeline</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Add your average value per client to turn these into closed and projected MRR against
              your goal.
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/settings">
                Set deal value <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </RevealItem>
  );
}

function ActivationRamp({ scoutDeployed, goal }: { scoutDeployed: boolean; goal: string | null }) {
  const steps = [
    { label: "Create your account", done: true },
    { label: "Set your industry, ICP, and revenue goal", done: true },
    { label: "Deploy your Prospect Agent", done: scoutDeployed, current: !scoutDeployed },
    { label: "Get your first reply", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Reveal className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-checklist">
        <Eyebrow>Get to your first reply</Eyebrow>
        <h2 className="font-heading mt-3 text-xl font-semibold tracking-tight">
          You&apos;re {doneCount}/{steps.length} of the way there
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <AnimatedProgress value={(doneCount / steps.length) * 100} />
          <ul className="flex flex-col gap-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                {s.done ? (
                  <CheckCircle2 className="size-4 text-foreground" />
                ) : (
                  <Circle
                    className={`size-4 ${s.current ? "text-foreground" : "text-muted-foreground/50"}`}
                  />
                )}
                <span className={s.done ? "" : s.current ? "font-medium" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-1 w-fit">
            <Link href="/agents/new/scout">
              Deploy your Prospect Agent <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </RevealItem>

      <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
        <Eyebrow>What happens next</Eyebrow>
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Once live, your Prospect Agent sources companies that fit your ICP, scores them, and
            keeps only the high-quality ones — its first run starts within ~15 minutes.
          </p>
          <p>
            Add an Outreach Agent and qualified leads turn into personalized drafts, waiting in your
            review queue. Nothing sends until you approve it.
          </p>
          {goal && (
            <p className="border-t border-border/60 pt-3 text-foreground">
              Every reply and meeting is measured against your{" "}
              <span className="font-medium">{goal}/mo</span> goal.
            </p>
          )}
        </div>
      </RevealItem>
    </Reveal>
  );
}

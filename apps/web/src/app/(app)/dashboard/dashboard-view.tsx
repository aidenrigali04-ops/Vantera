"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Inbox,
  Mail,
  MessageSquare,
  PartyPopper,
  Phone,
  Sparkles,
  TrendingUp,
  UserPlus,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { markNotificationsRead } from "@/components/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { Reveal, RevealItem, Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { LivePipeline, type LivePipelineData } from "./live-pipeline";
import { ProspectPanel, type Prospect } from "./prospect-panel";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import type { RevenuePoint, RevenueSnapshot } from "@/lib/revenue";
import type { PipelineViewModel, SequenceStage } from "../pipeline/queries";
import type { WarmupStatus } from "@/lib/warmup-status";

const STAGE_ICON: Record<SequenceStage, LucideIcon> = {
  linkedin: UserPlus,
  email: Mail,
  imessage: MessageSquare,
  call: Phone,
};

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
  showCrmNudge: boolean;
  livePipeline: LivePipelineData;
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
  pipeline: PipelineViewModel;
  cold: number;
  today: { sourced: number; sent: number; replied: number };
  fastInbound: {
    deployed: boolean;
    live: boolean;
    handled: number;
    responded: number;
    medianMins: number | null;
    scoutLive: boolean;
  };
  revenuePace: string | null;
  conversionWin: { id: string; leadName: string } | null;
  prospects: Prospect[];
  recentReplies: ReplyRow[];
  interested: number;
  channels: { mbActive: number; mbWarming: number; mbTotal: number; liStatus: string | null };
  week: { sends: number; email: number; li: number; replies: number };
  warmup: WarmupStatus;
}

export function DashboardView(props: DashboardViewProps) {
  const { firstName, icp, industry, goal, isNew, showCrmNudge, convertedClients, conversionWin } =
    props;

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

      {conversionWin && (
        <ConversionCelebration win={conversionWin} convertedClients={convertedClients} goal={goal} />
      )}

      {showCrmNudge && <CrmNudge convertedClients={convertedClients} />}

      {isNew ? (
        <ActivationRamp
          scoutDeployed={props.scoutDeployed}
          goal={goal}
          channels={props.channels}
          warmup={props.warmup}
        />
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
    pipeline,
    cold,
    today,
    fastInbound,
    revenuePace,
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
      {/* Live pipeline — full-width transparency of the autonomous process, top of the page */}
      <LivePipeline {...props.livePipeline} />

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
          paceLabel={revenuePace}
        />
      </div>

      {/* Pipeline motion (left) + warm replies, the variable reward (right) — kept high to anchor the daily habit loop */}
      <div className="grid gap-6 lg:grid-cols-[1.9fr_1.1fr]">
        <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Pipeline</Eyebrow>
          <Link
            href="/dashboard?view=pipeline"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            View all <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-5">
          {pipeline.stages.map((stage) => {
            const Icon = STAGE_ICON[stage.stage];
            return (
              <Link
                key={stage.stage}
                href="/dashboard?view=pipeline"
                className="group flex flex-col gap-1 bg-background/40 px-4 py-4 transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:bg-background/20"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-semibold tabular-nums">{stage.count}</span>
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground">
                  {stage.label}
                </span>
              </Link>
            );
          })}
          <Link
            href="/dashboard?view=pipeline"
            className="group flex flex-col gap-1 bg-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-semibold tabular-nums">{convertedClients}</span>
              <CheckCircle2 className="size-3.5 text-foreground" aria-hidden />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground">Won</span>
          </Link>
        </div>
        <AnimatedProgress value={pipeline.goalProgressPct ?? 0} className="mt-4" />
        <p className="mt-2 text-xs text-muted-foreground">
          {convertedClients > 0
            ? `${convertedClients} ${convertedClients === 1 ? "lead" : "leads"} converted toward your ${goal ?? "revenue"} goal.`
            : "Leads move LinkedIn → Email → iMessage → Caller, and stop the instant someone converts."}
        </p>
        </RevealItem>

        <WarmReplies recentReplies={recentReplies} interested={interested} />
      </div>

      {/* Momentum (variable reward) + risk (loss aversion) — the return-and-act drivers */}
      <div className="grid gap-6 md:grid-cols-2">
        <AtRiskPanel cold={cold} />
        <TodayPanel today={today} />
      </div>

      {/* Fast inbound response — the category's defensible "what works" use case (market report).
          Value-proof when a Responder is live; a loss-aversion nudge when inbound is unanswered. */}
      {(fastInbound.deployed || fastInbound.scoutLive) && <FastInboundPanel fast={fastInbound} />}

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

      {/* Status & reassurance — secondary, kept low */}
      <div className="grid gap-6 md:grid-cols-3">
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
                    {a.kind === "scout"
                      ? "Prospect"
                      : a.kind === "caller"
                        ? "Caller"
                        : a.kind === "responder"
                          ? "Responder"
                          : "Outreach"}
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

/** Warm replies — the variable reward that anchors the daily habit loop. */
function WarmReplies({
  recentReplies,
  interested,
}: {
  recentReplies: ReplyRow[];
  interested: number;
}) {
  return (
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
              Interested replies show up here the moment they land. This is the number that matters
              most.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {recentReplies.map((r, i) => {
              const name =
                [r.leads?.first_name, r.leads?.last_name].filter(Boolean).join(" ") || "A prospect";
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
  );
}

/**
 * Fast inbound response — the market report's most defensible "what works" use case. When a
 * Responder is live, this is value-proof (leads answered + the median response time it's keeping).
 * When a Scout is live but nothing answers inbound, it's a loss-aversion nudge: inbound interest
 * decays within the hour, so an unanswered form is pipeline walking out the door.
 */
function FastInboundPanel({ fast }: { fast: DashboardViewProps["fastInbound"] }) {
  const speedLabel =
    fast.medianMins == null
      ? null
      : fast.medianMins < 1
        ? "under a minute"
        : `~${fast.medianMins} min`;

  if (!fast.deployed) {
    return (
      <RevealItem className={cn(PANEL_SURFACE, "p-5 dark:bg-white/[0.06]")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <Zap className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Answer inbound leads in minutes, not days</p>
              <p className="text-sm text-muted-foreground">
                Inbound interest goes cold within the hour. A Responder qualifies and replies the
                instant a lead fills your form — using the same bar your Prospect Agent sets, so
                fast never means spray.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/agents/new/responder">
              Turn on fast response <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </RevealItem>
    );
  }

  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Fast inbound response</Eyebrow>
        <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <Zap className="size-3.5" /> {fast.live ? "live" : "paused"}
        </span>
      </div>
      {fast.handled > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <span className="font-mono text-2xl font-semibold tabular-nums">{fast.handled}</span>
              <p className="text-xs text-muted-foreground">Inbound handled</p>
            </div>
            <div>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {speedLabel ?? "—"}
              </span>
              <p className="text-xs text-muted-foreground">Median response</p>
            </div>
          </div>
          <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {fast.responded} answered automatically within your SLA — the speed edge that turns
            inbound interest into booked meetings.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Live and watching. The moment a lead fills your form, it&apos;s qualified and answered in
          minutes — point your form at the webhook on the{" "}
          <Link href="/agents/responder" className="underline underline-offset-2">
            Responder&apos;s page
          </Link>
          .
        </p>
      )}
    </RevealItem>
  );
}

/** Going cold — loss aversion. Warm leads that replied but are cooling off. */
function AtRiskPanel({ cold }: { cold: number }) {
  return (
    <RevealItem className={cn(PANEL_SURFACE, "flex flex-col p-5", cold > 0 && "dark:bg-white/[0.06]")}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Going cold</Eyebrow>
        {cold > 0 && <Badge variant="secondary">{cold}</Badge>}
      </div>
      {cold > 0 ? (
        <>
          <div className="mt-4 flex items-end gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums">{cold}</span>
            <span className="pb-1 text-sm text-muted-foreground">
              warm {cold === 1 ? "lead" : "leads"} cooling off
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Replied 3+ days ago and still open — a quick nudge keeps them warm.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3 w-fit">
            <Link href="/leads?tab=replied">
              Re-engage <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing slipping — every warm lead is fresh or already moving.
        </p>
      )}
    </RevealItem>
  );
}

/** Since yesterday — variable reward. Fresh activity that makes returning rewarding. */
function TodayPanel({ today }: { today: { sourced: number; sent: number; replied: number } }) {
  const quiet = today.sourced + today.sent + today.replied === 0;
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Since yesterday</Eyebrow>
        <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <Activity className="size-3.5" /> last 24h
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <span className="font-mono text-2xl font-semibold tabular-nums">{today.sourced}</span>
          <p className="text-xs text-muted-foreground">Sourced</p>
        </div>
        <div>
          <span className="font-mono text-2xl font-semibold tabular-nums">{today.sent}</span>
          <p className="text-xs text-muted-foreground">Sent</p>
        </div>
        <div>
          <span className="font-mono text-2xl font-semibold tabular-nums">{today.replied}</span>
          <p className="text-xs text-muted-foreground">Replied</p>
        </div>
      </div>
      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {quiet
          ? "Quiet so far — your agents work on their own schedule."
          : "Your agents kept working while you were away."}
      </p>
    </RevealItem>
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
  paceLabel,
}: {
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  goal: string | null;
  goalCents: number | null;
  series: RevenuePoint[];
  paceLabel: string | null;
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
            {paceLabel && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <TrendingUp className="size-3.5 text-muted-foreground" aria-hidden />
                {paceLabel}
              </p>
            )}
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

const CRM_NUDGE_KEY = "vantera:crm-nudge-dismissed";
const CRM_NUDGE_EVENT = "vantera:crm-nudge";

// Persisted, SSR-safe dismissal via useSyncExternalStore: server snapshot is always
// "shown", the client reads localStorage, and a same-tab custom event re-renders on
// dismiss. Avoids both the hydration mismatch and setState-in-effect.
function subscribeNudge(cb: () => void) {
  window.addEventListener(CRM_NUDGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CRM_NUDGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function nudgeDismissedSnapshot() {
  try {
    return localStorage.getItem(CRM_NUDGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Peak-end: a booked meeting is a celebration, never a silent row update. Fires
 * once per conversion (dismiss marks the underlying lead_notification read), ties
 * the win to the MRR goal, and ends on a forward nudge to keep the pipeline full.
 */
function ConversionCelebration({
  win,
  convertedClients,
  goal,
}: {
  win: { id: string; leadName: string };
  convertedClients: number;
  goal: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    void markNotificationsRead([win.id]);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(PANEL_SURFACE, "relative p-5 dark:bg-white/[0.07]")}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" />
      </button>
      <div className="flex flex-wrap items-center gap-4 pr-8">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[0_0_20px_rgba(255,255,255,0.55)]">
          <PartyPopper className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{win.leadName} just booked a meeting</p>
          <p className="text-sm text-muted-foreground">
            {convertedClients} {convertedClients === 1 ? "win" : "wins"}
            {goal && ` toward your ${goal}/mo goal`} — keep the pipeline full to stack the next one.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="ml-auto shrink-0">
          <Link href="/dashboard?view=pipeline">
            View pipeline <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// Just-in-time CRM connection prompt — fires only when a deal has closed and no
// destination is connected (peak-end moment). Dismissible so it never nags; the
// connect path lives in Settings, which this deep-links to.
function CrmNudge({ convertedClients }: { convertedClients: number }) {
  const dismissed = useSyncExternalStore(
    subscribeNudge,
    nudgeDismissedSnapshot,
    () => false
  );

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(CRM_NUDGE_KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CRM_NUDGE_EVENT));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(PANEL_SURFACE, "relative p-5 dark:bg-white/[0.06]")}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" />
      </button>
      <div className="flex flex-wrap items-center justify-between gap-4 pr-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <Workflow className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {convertedClients} {convertedClients === 1 ? "deal" : "deals"} closed — send the wins
              to your CRM
            </p>
            <p className="text-sm text-muted-foreground">
              Closed-won deals are tracked here but aren&apos;t reaching your team&apos;s tools yet.
              Connect HubSpot, Salesforce, Slack, and more so every win lands automatically.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/settings/integrations">
            Connect a destination <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// New-user activation hub. Two non-blocking surfaces side by side: the path to
// first reply (agent-centric — agents are the front door, rule 08) and a parallel
// channel-connect panel. No channel gates deploying an agent; the panel just lets
// fast wins (LinkedIn one-click) and the time-gated one (email warmup, ~2 weeks)
// start early. Shown only while isNew — it disappears the moment the Scout goes live.
function ActivationRamp({
  scoutDeployed,
  goal,
  channels,
  warmup,
}: {
  scoutDeployed: boolean;
  goal: string | null;
  channels: DashboardViewProps["channels"];
  warmup: WarmupStatus;
}) {
  const steps = [
    { label: "Create your account", done: true },
    { label: "Set your industry, ICP, and revenue goal", done: true },
    { label: "Deploy your Prospect Agent", done: scoutDeployed, current: !scoutDeployed },
    { label: "Add an Outreach Agent to draft your first messages", done: false },
    { label: "Get your first reply", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Reveal className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
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
            <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Its first run starts within ~15 minutes. Nothing ever sends until you approve it
              {goal && (
                <>
                  {" "}
                  — and every reply is measured against your{" "}
                  <span className="font-medium text-foreground">{goal}/mo</span> goal
                </>
              )}
              .
            </p>
          </div>
        </RevealItem>

        <ChannelSetupPanel channels={channels} scoutDeployed={scoutDeployed} />
      </div>

      {warmup.emailPhase === "warming" && warmup.mailboxesTotal > 0 && (
        <RevealItem>
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">
              Inboxes warming — email outreach begins in{" "}
              {warmup.estReadyInDays !== null
                ? `~${warmup.estReadyInDays} days`
                : "a couple of weeks"}
              .
            </p>
            <p className="mt-1 text-muted-foreground">
              {warmup.mailboxesTotal > 0 && (
                <>{warmup.mailboxesReady}/{warmup.mailboxesTotal} inboxes ready.{" "}</>
              )}
              {warmup.linkedinConnected
                ? "Your agent is reaching out on LinkedIn in the meantime and building your pipeline."
                : null}
            </p>
            {!warmup.linkedinConnected && (
              <a href="/settings/channels" className="mt-2 inline-block underline">
                Connect LinkedIn to start reaching out today
              </a>
            )}
          </div>
        </RevealItem>
      )}
    </Reveal>
  );
}

// Parallel, non-blocking channel setup. Ordered by time-to-value: LinkedIn is a
// one-click connect (the fast first win), email warmup is time-gated (~2 weeks, so
// nudge starting it early — loss aversion against a future bottleneck), the caller
// unlocks once leads exist, and SMS is still on the roadmap (no setup surface yet —
// shown honestly rather than as a dead link).
function ChannelSetupPanel({
  channels,
  scoutDeployed,
}: {
  channels: DashboardViewProps["channels"];
  scoutDeployed: boolean;
}) {
  const liConnected = channels.liStatus === "active";
  const liConnecting = Boolean(channels.liStatus) && !liConnected && channels.liStatus !== "restricted";
  const emailReady = channels.mbActive > 0;
  const emailWarming = channels.mbWarming > 0;

  return (
    <RevealItem className={cn(PANEL_SURFACE, "flex flex-col p-5")}>
      <Eyebrow>Connect your channels</Eyebrow>
      <p className="mt-2 text-xs text-muted-foreground">
        Connect as you go — none of these block you from deploying an agent. Start the quick one now;
        kick off email early so it&apos;s warmed up when you need it.
      </p>
      <div className="mt-4 flex flex-col divide-y divide-border/60">
        <ChannelSetupRow
          icon={<UserPlus className="size-4" />}
          label="LinkedIn"
          done={liConnected}
          detail={
            liConnected
              ? "Connected — ready to send"
              : liConnecting
                ? "Finishing connection…"
                : channels.liStatus === "restricted"
                  ? "Account restricted — reconnect"
                  : "One click — the fastest way to start"
          }
          action={
            liConnected ? undefined : (
              <Button asChild size="sm" variant={liConnecting ? "ghost" : "default"}>
                <Link href="/settings/channels">{liConnecting ? "Resume" : "Connect"}</Link>
              </Button>
            )
          }
        />
        <ChannelSetupRow
          icon={<Mail className="size-4" />}
          label="Email"
          done={emailReady}
          detail={
            emailReady
              ? `${channels.mbActive} ${channels.mbActive === 1 ? "mailbox" : "mailboxes"} ready${emailWarming ? ` · ${channels.mbWarming} warming` : ""}`
              : emailWarming
                ? `${channels.mbWarming} warming up — building sender reputation`
                : "Warmup takes ~2 weeks. Start now so it's ready when you are."
          }
          action={
            emailReady || emailWarming ? undefined : (
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/channels">Set up</Link>
              </Button>
            )
          }
        />
        <ChannelSetupRow
          icon={<Phone className="size-4" />}
          label="AI Caller"
          done={false}
          muted={!scoutDeployed}
          detail={
            scoutDeployed
              ? "Books meetings by phone with your best leads"
              : "Unlocks once your Prospect Agent is live"
          }
          action={
            scoutDeployed ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/agents/new/caller">Set up</Link>
              </Button>
            ) : undefined
          }
        />
        <ChannelSetupRow
          icon={<MessageSquare className="size-4" />}
          label="SMS"
          done={false}
          muted
          detail="Text outreach to opted-in leads"
          action={<Badge variant="secondary">Soon</Badge>}
        />
      </div>
    </RevealItem>
  );
}

function ChannelSetupRow({
  icon,
  label,
  detail,
  done,
  muted = false,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  done: boolean;
  muted?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            done
              ? "bg-foreground text-background"
              : muted
                ? "bg-foreground/5 text-muted-foreground/60"
                : "bg-foreground/10 text-muted-foreground"
          )}
        >
          {done ? <CheckCircle2 className="size-4" /> : icon}
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", muted && !done && "text-muted-foreground")}>
            {label}
          </p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

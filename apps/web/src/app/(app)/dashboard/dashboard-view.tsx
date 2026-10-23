"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Crosshair,
  Inbox,
  MessageSquare,
  Snowflake,
  Star,
  TrendingUp,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import { markNotificationsRead } from "@/components/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal, RevealItem, Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { KpiTile } from "@/components/ui/kpi";
import { cn } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { ProspectPanel, type Prospect } from "./prospect-panel";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import type { RevenuePoint, RevenueSnapshot } from "@/lib/revenue";
import type { SignalAttribution } from "@/lib/analytics";
import type { PipelineViewModel } from "../pipeline/queries";

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
  channel: "linkedin";
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
  showCrmNudge: boolean;
  drafts: number;
  agents: AgentRow[];
  liveAgentsCount: number;
  scoutNextRunLabel: string;
  scoutLastRunLabel: string;
  scoutLive: boolean;
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  avgDealValueCents: number | null;
  pendingDraftLeadIds: string[];
  series: RevenuePoint[];
  pipeline: PipelineViewModel;
  cold: number;
  today: { sourced: number; sent: number; replied: number };
  revenuePace: string | null;
  conversionWin: { id: string; leadName: string } | null;
  replyWin: { id: string; leadName: string } | null;
  prospects: Prospect[];
  /** interested replies still WAITING on the user (answered ones are filtered server-side) */
  recentReplies: ReplyRow[];
  repliesWaiting: number;
  week: { sends: number; li: number; replies: number };
  attribution: SignalAttribution[];
  /** Vera's learning log — the self-optimizing loop's visible heartbeat, all real data */
  learning: LearningProps;
  /** L1: a live Outreach agent has no booking link — interested buyers have nowhere to book */
  needsBookingUrl: boolean;
  /** R2 early-days regime: real firsts, so a $0 chart under a $45k goal never reads as failure */
  milestones: Milestones;
}

export interface Milestones {
  sent: boolean;
  replied: boolean;
  met: boolean;
  closed: boolean;
}

export interface LearningProps {
  playbookVersion: number | null;
  focus: { label: string; deep: number; n: number } | null;
}

export function DashboardView(props: DashboardViewProps) {
  const { firstName, icp, industry, goal, showCrmNudge, convertedClients, conversionWin, replyWin } =
    props;

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      {/* Header — eyebrow + display heading in the landing idiom */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-5"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Good to see you, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
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

      {conversionWin ? (
        <ConversionCelebration win={conversionWin} convertedClients={convertedClients} goal={goal} />
      ) : (
        replyWin && <ReplyCelebration win={replyWin} />
      )}

      {showCrmNudge && <CrmNudge convertedClients={convertedClients} />}

      <WorkingDashboard {...props} />
    </div>
    </MotionConfig>
  );
}

function WorkingDashboard(props: DashboardViewProps) {
  const {
    drafts,
    liveAgentsCount,
    scoutNextRunLabel,
    scoutLastRunLabel,
    scoutLive,
    revenue,
    convertedClients,
    pipelineLeads,
    goal,
    goalCents,
    series,
    cold,
    revenuePace,
    prospects,
    avgDealValueCents,
    pendingDraftLeadIds,
    attribution,
    agents,
    week,
    recentReplies,
    repliesWaiting,
    milestones,
  } = props;

  return (
    <Reveal className="flex flex-col gap-6">
      {/* Scan — the four numbers that answer "are we winning?": closed + pipeline value, weekly
          replies, and what's waiting on you. Each tile drills into the surface that explains it. */}
      <KpiStrip
        revenue={revenue}
        convertedClients={convertedClients}
        pipelineLeads={pipelineLeads}
        repliesThisWeek={week.replies}
        drafts={drafts}
      />

      {/* Act — the single action surface (drafts to review + warm leads cooling). */}
      <NeedsYou
        drafts={drafts}
        cold={cold}
        liveAgentsCount={liveAgentsCount}
        scoutNextRunLabel={scoutNextRunLabel}
      />

      {/* Prove — revenue vs goal, the value proof, at the full width a chart wants. */}
      <RevenueCard
        revenue={revenue}
        convertedClients={convertedClients}
        pipelineLeads={pipelineLeads}
        goal={goal}
        goalCents={goalCents}
        series={series}
        paceLabel={revenuePace}
        attribution={attribution}
        milestones={milestones}
      />

      {/* Explore — hot leads: the top prospect spotlighted with its why-now + next action. */}
      <HotLeads
        prospects={prospects}
        pendingDraftLeadIds={pendingDraftLeadIds}
        avgDealValueCents={avgDealValueCents}
        goalCents={goalCents}
      />

      {/* L1: the conversion-critical config gap — interested buyers with nowhere to book. */}
      {props.needsBookingUrl && (
        <RevealItem className={cn(PANEL_SURFACE, "flex flex-wrap items-center justify-between gap-3 border-[var(--attention)]/30 p-5")}>
          <div className="min-w-0">
            <Eyebrow>Action needed</Eyebrow>
            <p className="mt-2 text-sm text-foreground">
              Interested buyers have nowhere to book you.{" "}
              <span className="text-muted-foreground">
                Add your booking link and Vera offers it the moment a prospect shows interest —
                it&apos;s how conversations become meetings.
              </span>
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            {/* R6: the link now lives in Settings (one source of truth with the agent config). */}
            <Link href="/settings#booking-link">
              Add booking link <ArrowRight className="size-4" />
            </Link>
          </Button>
        </RevealItem>
      )}

      {/* Vera's learning log — the self-optimizing loop's visible heartbeat, one glance. */}
      <LearningLog learning={props.learning} />

      {/* Reassure — the agent heartbeat + the warm replies that reward the daily check-in. Paired
          in a balanced two-up row so neither one's height drags a gap into the primary content. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <AgentsPanel agents={agents} scoutLive={scoutLive} scoutLastRunLabel={scoutLastRunLabel} />
        <WarmReplies recentReplies={recentReplies} repliesWaiting={repliesWaiting} />
      </div>
    </Reveal>
  );
}

/**
 * Vera's learning log — the self-optimizing loop made visible (retention brief: variable
 * reward + goal-gradient against the silent-wait cliff). Every row is a real, timestamped
 * fact: the live test with enrollment progress toward its decision sample, the latest
 * adoption with its real receipts, and the buyer segment being prioritized. Hidden only
 * when the loop has nothing yet (pre-onboarding).
 */
function LearningLog({ learning }: { learning: LearningProps }) {
  const { playbookVersion, focus } = learning;
  if (!focus) return null;
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-whats-working">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Eyebrow>Vera is learning</Eyebrow>
          {playbookVersion !== null && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Playbook v{playbookVersion}
            </Badge>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard?view=analytics">
            See the full loop <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {focus && (
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
              <Crosshair className="size-3.5" />
            </span>
            <p className="min-w-0 flex-1 text-sm text-foreground">
              Prioritizing <span className="font-medium">{focus.label}</span>
              <span className="text-muted-foreground">
                {" "}
                — {focus.deep} of {focus.n} went interested or booked, your strongest segment
              </span>
            </p>
          </li>
        )}
      </ul>
    </RevealItem>
  );
}

/**
 * Top-of-page KPI strip — four mono metrics for an at-a-glance read of the business. Color is
 * placed, not sprinkled: a cyan dot marks the hero (closed) and the value turns cyan only when a
 * tile needs action (drafts waiting); every other number stays neutral ink so color carries meaning.
 */
function KpiStrip({
  revenue,
  convertedClients,
  pipelineLeads,
  repliesThisWeek,
  drafts,
}: {
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  repliesThisWeek: number;
  drafts: number;
}) {
  const closed = revenue.hasValue ? usd.format(revenue.closedCents / 100) : String(convertedClients);
  const closedSub = revenue.hasValue
    ? `${convertedClients} ${convertedClients === 1 ? "client" : "clients"} won`
    : convertedClients === 1
      ? "client won"
      : "clients won";
  const pipeline = revenue.hasValue ? usd.format(revenue.expectedCents / 100) : String(pipelineLeads);
  const pipelineSub = `${pipelineLeads} ${pipelineLeads === 1 ? "lead" : "leads"} in motion`;

  return (
    <RevealItem className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiTile href="/dashboard?view=pipeline" label="Closed" value={closed} sub={closedSub} hero />
      <KpiTile href="/dashboard?view=pipeline" label="In pipeline" value={pipeline} sub={pipelineSub} />
      {/* R4: "Interested replies" — the KPI counts every interested reply in 7 days, which is
          a different number than the needs-you panel's "waiting on you". Same-name tiles with
          different denominators read as the dashboard contradicting itself. */}
      <KpiTile href="/prospects?tab=replied" label="Interested replies" value={String(repliesThisWeek)} sub="this week" />
      <KpiTile
        href="/approvals"
        label="To approve"
        value={String(drafts)}
        sub={drafts > 0 ? "awaiting you" : "all clear"}
        actionable={drafts > 0}
      />
    </RevealItem>
  );
}

/** R2: the early-days revenue framing — the four real firsts on the way to the goal.
 *  Every boolean comes from the account's own activity; nothing is invented. */
function MilestoneLadder({ milestones, goal }: { milestones: Milestones; goal: string | null }) {
  const steps: { label: string; done: boolean }[] = [
    { label: "First message sent", done: milestones.sent },
    { label: "First warm reply", done: milestones.replied },
    { label: "First meeting booked", done: milestones.met },
    { label: "First client closed", done: milestones.closed },
  ];
  const nextIdx = steps.findIndex((s) => !s.done);
  return (
    <div className="mt-3 rounded-lg border border-border/60 p-4">
      <p className="text-xs font-medium text-foreground">
        {goal ? `The path to ${goal}/mo starts with four firsts.` : "Four firsts on the way to revenue."}
      </p>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full",
                s.done
                  ? "bg-[var(--positive)] text-white"
                  : "ring-1 ring-inset ring-border text-transparent"
              )}
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span
              className={cn(
                s.done
                  ? "text-foreground"
                  : i === nextIdx
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
              )}
            >
              {s.label}
              {i === nextIdx && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cyan-strong)]">next</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-xs text-muted-foreground">
        The goal chart takes over as pipeline builds — every step here is your own real activity.
      </p>
    </div>
  );
}

/**
 * Signal→revenue attribution, one line — the dependency proof on the first screen: the captured
 * signals that actually closed deals, so the user sees the signals on Leads literally make the
 * money. Links to the full breakdown on the Analytics tab. Rendered only when wins carry signals.
 */
function WinsAttributionLine({ attribution }: { attribution: SignalAttribution[] }) {
  const top = attribution.slice(0, 3);
  return (
    <Link
      href="/dashboard?view=analytics"
      className="group flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="flex items-center gap-1.5 font-data uppercase tracking-[0.14em] text-foreground/70">
        <TrendingUp className="size-3.5" aria-hidden /> Wins from
      </span>
      {top.map((row, i) => (
        <span key={row.kind}>
          <span className="text-foreground">{row.label}</span>{" "}
          <span className="tabular-nums">({row.wins})</span>
          {i < top.length - 1 && <span className="text-muted-foreground/50"> ·</span>}
        </span>
      ))}
      <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </Link>
  );
}

/** One actionable row inside "Needs you" — icon + what + why + a single CTA. */
function ActionRow({
  icon,
  title,
  detail,
  href,
  label,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            primary ? "bg-foreground text-background" : "bg-foreground/10 text-muted-foreground"
          )}
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button asChild size="sm" variant={primary ? "default" : "outline"}>
        <Link href={href}>
          {label} <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

/**
 * "Needs you" — the single action surface at the top of the page (merges the old review-drafts and
 * going-cold cards). It answers "what needs me?" in one glance: drafts to approve (the gate that
 * keeps sending in your control) and warm leads cooling off (loss aversion). All-clear reads calm.
 */
function NeedsYou({
  drafts,
  cold,
  liveAgentsCount,
  scoutNextRunLabel,
}: {
  drafts: number;
  cold: number;
  liveAgentsCount: number;
  scoutNextRunLabel: string;
}) {
  const hasWork = drafts > 0 || cold > 0;
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5", hasWork && "border-[var(--cyan-line)] bg-[var(--cyan-tint)]/40")}>
      <Eyebrow>Needs you</Eyebrow>
      {hasWork ? (
        <div className="mt-4 flex flex-col gap-4">
          {drafts > 0 && (
            <ActionRow
              primary
              icon={<Inbox className="size-4" />}
              title={`${drafts} ${drafts === 1 ? "draft is" : "drafts are"} waiting for your review`}
              detail="Nothing sends until you approve it — a few minutes keeps the pipeline moving."
              href="/approvals"
              label="Approve"
            />
          )}
          {cold > 0 && (
            <ActionRow
              icon={<Snowflake className="size-4" />}
              title={`${cold} warm ${cold === 1 ? "lead is" : "leads are"} cooling off`}
              detail="Replied 3+ days ago and still open — a quick nudge keeps them warm."
              href="/prospects?tab=replied"
              label="Re-engage"
            />
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {liveAgentsCount > 0
                ? `You're all caught up — your agent runs ${scoutNextRunLabel}, and anything that needs you lands here.`
                : "Deploy an Outreach Agent to start drafting personalized outreach."}
            </p>
          </div>
          {liveAgentsCount === 0 && (
            <Button asChild size="sm" variant="outline">
              <Link href="/playbook">View playbook</Link>
            </Button>
          )}
        </div>
      )}
    </RevealItem>
  );
}

/** Hot leads — the anticipation surface: the top prospect spotlighted with its "why now"
 *  buying signal, value framing, and next action; the rest as a scannable queue. */
function HotLeads({
  prospects,
  pendingDraftLeadIds,
  avgDealValueCents,
  goalCents,
}: {
  prospects: Prospect[];
  pendingDraftLeadIds: string[];
  avgDealValueCents: number | null;
  goalCents: number | null;
}) {
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Hot leads</Eyebrow>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/prospects">
            View all <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="mt-4">
        <ProspectPanel
          prospects={prospects}
          pendingDraftLeadIds={pendingDraftLeadIds}
          avgDealValueCents={avgDealValueCents}
          goalCents={goalCents}
        />
      </div>
    </RevealItem>
  );
}

/** Agent heartbeat — secondary reassurance that the autonomous process is alive. */
function AgentsPanel({
  agents,
  scoutLive,
  scoutLastRunLabel,
}: {
  agents: AgentRow[];
  scoutLive: boolean;
  scoutLastRunLabel: string;
}) {
  return (
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
                  a.status === "live" ? "bg-[var(--fb)]" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <span className="text-sm font-medium">{a.name}</span>
              <Badge variant="secondary" className="capitalize">
                {a.kind === "scout" ? "Prospect" : a.kind === "intent" ? "Intent" : "Outreach"}
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
          Last sourced {scoutLastRunLabel}. Quiet stretches are normal — your agent only keeps
          high-quality leads.
        </p>
      )}
      <Button asChild variant="ghost" size="sm" className="-mx-2 mt-1 justify-start">
        <Link href="/playbook">
          Open playbook <ArrowRight className="size-4" />
        </Link>
      </Button>
    </RevealItem>
  );
}

/** Warm replies — the variable reward that anchors the daily habit loop. */
/** Interested replies WAITING ON YOU — answered ones are filtered server-side, so this list
 *  and its badge always match real activity (a handled reply disappears immediately). */
function WarmReplies({
  recentReplies,
  repliesWaiting,
}: {
  recentReplies: ReplyRow[];
  repliesWaiting: number;
}) {
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eyebrow>Warm replies</Eyebrow>
          {repliesWaiting > 0 && (
            <span className="text-[11px] text-muted-foreground">waiting on you</span>
          )}
        </div>
        {repliesWaiting > 0 && <Badge variant="secondary">{repliesWaiting}</Badge>}
      </div>
      <div className="mt-4">
        {!recentReplies || recentReplies.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MessageSquare className="size-6 text-muted-foreground" />
            <p className="max-w-xs text-sm text-muted-foreground">
              You&apos;re all caught up — interested replies land here the moment they arrive,
              and disappear once you&apos;ve answered.
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
                      <UserPlus className="size-3.5" />
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

function RevenueCard({
  revenue,
  convertedClients,
  pipelineLeads,
  goal,
  goalCents,
  series,
  paceLabel,
  attribution,
  milestones,
}: {
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  goal: string | null;
  goalCents: number | null;
  series: RevenuePoint[];
  paceLabel: string | null;
  attribution: SignalAttribution[];
  milestones: Milestones;
}) {
  const projectedTotalCents = revenue.closedCents + revenue.expectedCents;
  // R2 early-days regime: nothing closed and pipeline under 5% of goal — a flat $0 line
  // under a distant dashed goal reads as failure during exactly the weeks the surface must
  // sustain belief. Same truth, staged as the real firsts instead.
  const earlyDays =
    revenue.closedCents === 0 && goalCents !== null && projectedTotalCents < goalCents * 0.05;
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-revenue">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Revenue</Eyebrow>
        <span className="flex items-center gap-1 font-data text-[11px] uppercase tracking-wide text-muted-foreground">
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
                <span className="font-data text-2xl font-semibold tabular-nums">
                  {usd.format(revenue.closedCents / 100)}
                </span>
              </div>
              <div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {/* T1: closed + today's expected pipeline — "projected" overclaimed. */}
                  <span className="size-2 rounded-full bg-foreground/40" /> With pipeline ·{" "}
                  {pipelineLeads} in motion
                </span>
                <span className="font-data text-2xl font-semibold tabular-nums text-muted-foreground">
                  {usd.format(projectedTotalCents / 100)}
                </span>
              </div>
            </div>
            {earlyDays ? (
              <MilestoneLadder milestones={milestones} goal={goal} />
            ) : (
              <>
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
            )}
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
                <span className="font-data text-2xl font-semibold tabular-nums">
                  {convertedClients}
                </span>
                <p className="text-xs text-muted-foreground">
                  Closed {convertedClients === 1 ? "client" : "clients"}
                </p>
              </div>
              <div>
                <span className="font-data text-2xl font-semibold tabular-nums text-muted-foreground">
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
      {/* Dependency proof, folded in: the signals that actually closed these deals. */}
      {attribution.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <WinsAttributionLine attribution={attribution} />
        </div>
      )}
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
      className={cn(PANEL_SURFACE, "relative p-5 ring-1 ring-[var(--cyan-line)]")}
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--positive-tint)] text-[var(--positive)]">
          <BadgeCheck className="size-5" />
        </span>
        <div className="min-w-0">
          {/* T1: `converted` is closed-won, not a meeting — say what actually happened. */}
          <p className="text-sm font-medium">{win.leadName} just closed — new client</p>
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

// Peak-end for the earlier, more frequent aha: an interested reply. A slim, dismissible win
// (distinct from the conversion party-popper) that turns the unpredictable reply into a reward,
// then points to the thread. Only interested replies reach here (gated in page.tsx).
function ReplyCelebration({ win }: { win: { id: string; leadName: string } }) {
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
      className={cn(PANEL_SURFACE, "relative p-5 ring-1 ring-[var(--cyan-line)]")}
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[var(--shadow-sm)]">
          <Star className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{win.leadName} is interested</p>
          <p className="text-sm text-muted-foreground">
            A reply landed in your favor, from a play Vera is running — keep the thread warm and
            move it toward a meeting.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="ml-auto shrink-0">
          <Link href="/prospects?tab=replied">
            See the reply <ArrowRight className="size-4" />
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
      className={cn(PANEL_SURFACE, "relative p-5")}
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

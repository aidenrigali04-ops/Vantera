"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Crosshair,
  FlaskConical,
  Inbox,
  MessageSquare,
  PartyPopper,
  Snowflake,
  Star,
  TrendingUp,
  UserPlus,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { markNotificationsRead } from "@/components/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
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
  isNew: boolean;
  isWorkingEmpty: boolean;
  showCrmNudge: boolean;
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
  channels: { liStatus: string | null };
  week: { sends: number; li: number; replies: number };
  attribution: SignalAttribution[];
  /** Vera's learning log — the self-optimizing loop's visible heartbeat, all real data */
  learning: LearningProps;
  /** matched starter plays — fill the waiting states with proven competence, honestly labeled */
  plays: { slug: string; name: string; description: string; sourceLabel: string }[];
}

export interface LearningProps {
  playbookVersion: number | null;
  testing: {
    label: string;
    stageLabel: string;
    startedAgo: string;
    enrolled: number;
    targetEnrolled: number;
  } | null;
  adopted: {
    label: string;
    whenAgo: string;
    receipts: { sent: number; interested: number } | null;
  } | null;
  focus: { label: string; deep: number; n: number } | null;
}

export function DashboardView(props: DashboardViewProps) {
  const { firstName, icp, industry, goal, isNew, isWorkingEmpty, showCrmNudge, convertedClients, conversionWin, replyWin } =
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

      {isNew ? (
        <ActivationRamp
          scoutDeployed={props.scoutDeployed}
          goal={goal}
          channels={props.channels}
          plays={props.plays}
          icp={icp}
        />
      ) : isWorkingEmpty ? (
        <FirstRunInProgress
          scoutNextRunLabel={props.scoutNextRunLabel}
          goal={goal}
          channels={props.channels}
          plays={props.plays}
          icp={icp}
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
      />

      {/* Explore — hot leads: the top prospect spotlighted with its why-now + next action. */}
      <HotLeads
        prospects={prospects}
        pendingDraftLeadIds={pendingDraftLeadIds}
        avgDealValueCents={avgDealValueCents}
        goalCents={goalCents}
      />

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
  const { playbookVersion, testing, adopted, focus } = learning;
  if (!testing && !adopted && !focus) return null;
  const pct = testing
    ? Math.min(100, Math.round((testing.enrolled / Math.max(1, testing.targetEnrolled)) * 100))
    : 0;
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
        {testing && (
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
              <FlaskConical className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                Testing <span className="font-medium">{testing.label}</span>
                <span className="text-muted-foreground"> — measured on {testing.stageLabel}</span>
              </p>
              <div className="mt-1.5 flex items-center gap-3">
                <span className="h-1.5 w-40 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <span
                    className="block h-full rounded-full bg-[var(--cyan-strong)] transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {testing.enrolled} of ~{testing.targetEnrolled} prospects enrolled · decides on
                  real outcomes · started {testing.startedAgo}
                </span>
              </div>
            </div>
          </li>
        )}

        {adopted && (
          <li className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--positive)]/12 text-[var(--positive)]">
              <CheckCircle2 className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                Adopted <span className="font-medium">{adopted.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — won its test {adopted.whenAgo}, now your default
                </span>
              </p>
              {adopted.receipts && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Since the change: {adopted.receipts.sent}{" "}
                  {adopted.receipts.sent === 1 ? "message" : "messages"} sent
                  {adopted.receipts.interested > 0 && (
                    <> · {adopted.receipts.interested} interested</>
                  )}
                </p>
              )}
            </div>
          </li>
        )}

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

/** The proven plays Vera runs, shown while the first results are still landing — competence in
 *  the waiting room instead of silence. Honest source labels, never network claims (Stage 0). */
function ProvenPlaysPanel({
  plays,
  icp,
}: {
  plays: DashboardViewProps["plays"];
  icp: string | null;
}) {
  if (plays.length === 0) return null;
  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-proven-plays">
      <Eyebrow>Vera&apos;s plays</Eyebrow>
      <p className="mt-2 text-sm text-muted-foreground">
        While the first results land, here&apos;s what Vera is running
        {icp ? (
          <>
            {" "}
            for <span className="font-medium text-foreground">{icp}</span>
          </>
        ) : null}
        :
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {plays.map((p) => (
          <li key={p.slug} className="rounded-xl border border-[var(--hairline)] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              <span className="text-[11px] text-muted-foreground/80">{p.sourceLabel}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        Vera tests improvements against these on real conversations and keeps what wins — you
        approve every send.
      </p>
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
      <KpiTile href="/leads?tab=replied" label="Warm replies" value={String(repliesThisWeek)} sub="this week" />
      <KpiTile
        href="/review"
        label="To review"
        value={String(drafts)}
        sub={drafts > 0 ? "awaiting you" : "all clear"}
        actionable={drafts > 0}
      />
    </RevealItem>
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
        <Zap className="size-3.5" aria-hidden /> Wins from
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
              href="/review"
              label="Review"
            />
          )}
          {cold > 0 && (
            <ActionRow
              icon={<Snowflake className="size-4" />}
              title={`${cold} warm ${cold === 1 ? "lead is" : "leads are"} cooling off`}
              detail="Replied 3+ days ago and still open — a quick nudge keeps them warm."
              href="/leads?tab=replied"
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
              <Link href="/agents">View agents</Link>
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
          <Link href="/leads">
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
        <Link href="/agents">
          Manage agents <ArrowRight className="size-4" />
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
}: {
  revenue: RevenueSnapshot;
  convertedClients: number;
  pipelineLeads: number;
  goal: string | null;
  goalCents: number | null;
  series: RevenuePoint[];
  paceLabel: string | null;
  attribution: SignalAttribution[];
}) {
  const projectedTotalCents = revenue.closedCents + revenue.expectedCents;
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
                  <span className="size-2 rounded-full bg-foreground/40" /> Projected ·{" "}
                  {pipelineLeads} in pipeline
                </span>
                <span className="font-data text-2xl font-semibold tabular-nums text-muted-foreground">
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[var(--shadow-sm)]">
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
          <Link href="/leads?tab=replied">
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

// New-user activation hub. Two non-blocking surfaces side by side: the path to
// first reply (agent-centric — agents are the front door, rule 08) and a parallel
// LinkedIn-connect panel. Connecting LinkedIn doesn't gate deploying an agent; the
// panel just lets the user connect early (the one activation gate). Shown only while
// isNew — it disappears the moment the Scout goes live.
function ActivationRamp({
  scoutDeployed,
  goal,
  channels,
  plays,
  icp,
}: {
  scoutDeployed: boolean;
  goal: string | null;
  channels: DashboardViewProps["channels"];
  plays: DashboardViewProps["plays"];
  icp: string | null;
}) {
  // Onboarding auto-provisions the whole agent stack, so this ramp only appears for the
  // rare account without a live Scout — and the checklist reflects the real remaining
  // dependency: LinkedIn is what gates sending, not more agent setup.
  const liConnected = channels.liStatus === "active";
  const steps = [
    { label: "Create your account", done: true },
    { label: "Set your targeting and revenue goal", done: true },
    { label: "Deploy your agents", done: scoutDeployed, current: !scoutDeployed },
    { label: "Connect LinkedIn so outreach can send", done: liConnected, current: scoutDeployed && !liConnected },
    { label: "Approve your first outreach — then the replies start", done: false },
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
              {scoutDeployed && !liConnected ? (
                <Link href="/settings/channels">
                  Connect LinkedIn <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link href="/agents/new/scout">
                  Deploy your agents <ArrowRight className="size-4" />
                </Link>
              )}
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

        <ChannelSetupPanel channels={channels} />
      </div>

      {/* Competence in the waiting room (Stage 0): the proven plays Vera starts on. */}
      <ProvenPlaysPanel plays={plays} icp={icp} />
    </Reveal>
  );
}

// Agents are live but the first run hasn't landed leads yet (the post-deploy wait). Show the
// work in progress — a live pulse, the next-run countdown, and the next action — so the silence
// before the first results never reads as a dead, empty dashboard (retention: show activity).
function FirstRunInProgress({
  scoutNextRunLabel,
  goal,
  channels,
  plays,
  icp,
}: {
  scoutNextRunLabel: string;
  goal: string | null;
  channels: DashboardViewProps["channels"];
  plays: DashboardViewProps["plays"];
  icp: string | null;
}) {
  const steps = [
    { label: "Agents deployed — Prospect, Outreach & Intent", done: true, current: false },
    { label: "Sourcing & scoring your first leads", done: false, current: true },
    { label: "Your first qualified leads land here", done: false, current: false },
  ];
  // Onboarding offers a "skip for now" on the LinkedIn connect, so this panel is the
  // skipper's home for the one real dependency: sourcing runs either way, sending doesn't.
  const liConnected = channels.liStatus === "active";
  return (
    <Reveal className="flex flex-col gap-6">
      <div className={cn("grid gap-6", !liConnected && "md:grid-cols-[1.2fr_1fr]")}>
        <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-first-run">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Vera is working</Eyebrow>
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60" />
                <span className="relative inline-flex size-2 rounded-full bg-foreground" />
              </span>
              Live
            </span>
          </div>
          <h2 className="font-heading mt-3 text-xl font-semibold tracking-tight">
            Finding your first prospects
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vera is scanning your market and scoring fits against your ICP. The
            first qualified leads land here{" "}
            {scoutNextRunLabel ? (
              <>
                in about <span className="font-medium text-foreground">{scoutNextRunLabel}</span>
              </>
            ) : (
              "within ~15 minutes"
            )}{" "}
            — quality over volume, and nothing ever sends until you approve it
            {goal && (
              <>
                {" "}
                — measured against your{" "}
                <span className="font-medium text-foreground">{goal}/mo</span> goal
              </>
            )}
            .
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <AnimatedProgress value={40} />
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
                  <span
                    className={s.done ? "" : s.current ? "font-medium" : "text-muted-foreground"}
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {/* Outreach is already provisioned — the only setup left is the send gate. */}
              {!liConnected && (
                <Button asChild size="sm">
                  <Link href="/settings/channels">
                    Connect LinkedIn <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant={liConnected ? "outline" : "ghost"} size="sm">
                <Link href="/leads">Watch leads arrive</Link>
              </Button>
            </div>
          </div>
        </RevealItem>

        {!liConnected && <ChannelSetupPanel channels={channels} />}
      </div>

      {/* Competence in the waiting room (Stage 0): the proven plays Vera is running right now. */}
      <ProvenPlaysPanel plays={plays} icp={icp} />
    </Reveal>
  );
}

// LinkedIn connect — the single activation gate. One-click hosted auth; connecting
// doesn't block deploying an agent, but nothing sends until LinkedIn is connected.
// Shown only while isNew (the new-user activation hub).
function ChannelSetupPanel({ channels }: { channels: DashboardViewProps["channels"] }) {
  const liConnected = channels.liStatus === "active";
  const liConnecting =
    Boolean(channels.liStatus) && !liConnected && channels.liStatus !== "restricted";

  return (
    <RevealItem className={cn(PANEL_SURFACE, "flex flex-col p-5")}>
      <Eyebrow>Connect LinkedIn</Eyebrow>
      <p className="mt-2 text-xs text-muted-foreground">
        One click — sign in on LinkedIn&apos;s own page. Your agents keep sourcing and qualifying
        either way, but no outreach sends until it&apos;s connected.
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
                  : "The one step before your agents can reach out"
          }
          action={
            liConnected ? undefined : (
              <Button asChild size="sm" variant={liConnecting ? "ghost" : "default"}>
                <Link href="/settings/channels">{liConnecting ? "Resume" : "Connect"}</Link>
              </Button>
            )
          }
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

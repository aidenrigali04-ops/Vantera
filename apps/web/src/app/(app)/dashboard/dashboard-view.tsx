"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Inbox,
  PartyPopper,
  Snowflake,
  Sparkles,
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
  series: RevenuePoint[];
  pipeline: PipelineViewModel;
  cold: number;
  today: { sourced: number; sent: number; replied: number };
  revenuePace: string | null;
  conversionWin: { id: string; leadName: string } | null;
  replyWin: { id: string; leadName: string } | null;
  prospects: Prospect[];
  recentReplies: ReplyRow[];
  interested: number;
  channels: { liStatus: string | null };
  week: { sends: number; li: number; replies: number };
  attribution: SignalAttribution[];
}

export function DashboardView(props: DashboardViewProps) {
  const { firstName, icp, industry, goal, isNew, isWorkingEmpty, showCrmNudge, convertedClients, conversionWin, replyWin } =
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
        />
      ) : isWorkingEmpty ? (
        <FirstRunInProgress
          scoutNextRunLabel={props.scoutNextRunLabel}
          goal={goal}
          channels={props.channels}
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
    cold,
    revenuePace,
    prospects,
    attribution,
  } = props;

  return (
    <Reveal className="flex flex-col gap-6">
      {/* 1 — Needs you: the single action surface (drafts to review + warm leads cooling). */}
      <NeedsYou
        drafts={drafts}
        cold={cold}
        liveAgentsCount={liveAgentsCount}
        scoutNextRunLabel={scoutNextRunLabel}
      />

      {/* 2 — Revenue vs goal (the value proof) with the wins→signal attribution folded into it. */}
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

      {/* 3 — Hot leads: the anticipation surface, each row led by its real why-now signal. */}
      <HotLeads prospects={prospects} />
    </Reveal>
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
      <span className="flex items-center gap-1.5 font-mono uppercase tracking-[0.14em] text-foreground/70">
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
    <RevealItem className={cn(PANEL_SURFACE, "p-5", hasWork && "dark:bg-white/[0.06]")}>
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

/** Hot leads — the anticipation surface; each row leads with its real "why now" buying signal. */
function HotLeads({ prospects }: { prospects: Prospect[] }) {
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
        <ProspectPanel prospects={prospects} />
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
                  a.status === "live" ? "animate-pulse bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)]" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <span className="text-sm font-medium">{a.name}</span>
              <Badge variant="secondary" className="capitalize">
                {a.kind === "scout" ? "Prospect" : "Outreach"}
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

/** LinkedIn connect nudge — rendered only while LinkedIn isn't connected (the activation gate). */
function ChannelsPanel({ channels }: { channels: DashboardViewProps["channels"] }) {
  return (
    <RevealItem className={cn(PANEL_SURFACE, "flex flex-col gap-3 p-5")}>
      <Eyebrow>Finish setup</Eyebrow>
      <ChannelRow
        icon={<UserPlus className="size-4" />}
        label="LinkedIn"
        ready={channels.liStatus === "active"}
        detail={
          channels.liStatus === "active"
            ? "Connected"
            : channels.liStatus === "restricted"
              ? "Restricted — reconnect"
              : channels.liStatus
                ? "Connecting"
                : "Not connected"
        }
      />
      <Button asChild variant="ghost" size="sm" className="-mx-2 mt-1 justify-start">
        <Link href="/settings/channels">
          Connect LinkedIn <ArrowRight className="size-4" />
        </Link>
      </Button>
    </RevealItem>
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
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{win.leadName} is interested</p>
          <p className="text-sm text-muted-foreground">
            A reply landed in your favor — keep the thread warm and move it toward a meeting.
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
// LinkedIn-connect panel. Connecting LinkedIn doesn't gate deploying an agent; the
// panel just lets the user connect early (the one activation gate). Shown only while
// isNew — it disappears the moment the Scout goes live.
function ActivationRamp({
  scoutDeployed,
  goal,
  channels,
}: {
  scoutDeployed: boolean;
  goal: string | null;
  channels: DashboardViewProps["channels"];
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

        <ChannelSetupPanel channels={channels} />
      </div>
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
}: {
  scoutNextRunLabel: string;
  goal: string | null;
  channels: DashboardViewProps["channels"];
}) {
  const steps = [
    { label: "Prospect Agent deployed", done: true, current: false },
    { label: "Sourcing & scoring your first leads", done: false, current: true },
    { label: "Your first qualified leads land here", done: false, current: false },
  ];
  return (
    <Reveal className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="dashboard-first-run">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Your agents are working</Eyebrow>
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60" />
                <span className="relative inline-flex size-2 rounded-full bg-foreground" />
              </span>
              Live
            </span>
          </div>
          <h2 className="font-heading mt-3 text-xl font-semibold tracking-tight">
            Sourcing your first leads now
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Prospect Agent is scanning your market and scoring fits against your ICP. The
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
              <Button asChild variant="outline" size="sm">
                <Link href="/agents">
                  Add an Outreach Agent <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/leads">Watch leads arrive</Link>
              </Button>
            </div>
          </div>
        </RevealItem>

        <ChannelSetupPanel channels={channels} />
      </div>
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
        One click — sign in on LinkedIn&apos;s own page and your agents can start reaching out. It
        doesn&apos;t block deploying an agent, but nothing sends until it&apos;s connected.
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

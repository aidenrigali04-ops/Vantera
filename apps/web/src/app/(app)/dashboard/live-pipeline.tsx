"use client";

import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Flame,
  Inbox,
  PencilLine,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow, PANEL_SURFACE, RevealItem } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * Live pipeline — the autonomous outreach process, made visible end to end so the
 * silent post-launch waiting period (the named churn cliff) reads as "working", not
 * "broken". Read top-to-bottom as a funnel: Sourcing → Pulled → Drafting → Review →
 * Sending → Live. The single "Now" stage tells the user exactly where work sits.
 * Real counts from leads + scheduled_sends.
 */
export interface LivePipelineData {
  scoutDeployed: boolean;
  scoutLive: boolean;
  scoutNextRunLabel: string;
  scoutLastRunLabel: string;
  pulled: number;
  disqualified: number;
  drafting: number;
  inReview: number;
  sending: number;
  sent: number;
  active: number;
  replied: number;
  won: number;
  sendMode: "review" | "automatic";
}

type Stage = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: number;
  status?: string; // shown instead of a number (the agent node)
  sub?: string;
  reached: boolean; // work has arrived at (or passed) this stage
  attention?: boolean; // needs the user (drafts in review)
  href?: string;
};

/** The one stage that best represents "where the pipeline is right now". */
function currentStageKey(p: LivePipelineData): string {
  if (p.inReview > 0) return "review";
  if (p.drafting > 0) return "drafting";
  if (p.sending > 0) return "sending";
  if (p.active > 0 || p.sent > 0) return "active";
  if (p.pulled > 0) return "pulled";
  return "agent";
}

export function LivePipeline(p: LivePipelineData) {
  const downstreamFromPulled =
    p.drafting + p.inReview + p.sending + p.sent + p.active > 0;
  const downstreamFromDrafting = p.inReview + p.sending + p.sent + p.active > 0;
  const downstreamFromReview = p.sending + p.sent + p.active > 0;
  const downstreamFromSending = p.sent + p.active > 0;

  const stages: Stage[] = [
    {
      key: "agent",
      icon: Bot,
      label: "Sourcing",
      value: 0,
      status: p.scoutLive ? "Live" : p.scoutDeployed ? "Paused" : "Off",
      sub: p.scoutLive
        ? `Prospect Agent · next run ${p.scoutNextRunLabel}`
        : p.scoutDeployed
          ? "Prospect Agent · paused"
          : "Prospect Agent · not deployed",
      reached: p.scoutDeployed,
    },
    {
      key: "pulled",
      icon: Users,
      label: "Prospects pulled",
      value: p.pulled,
      reached: p.pulled > 0 || downstreamFromPulled,
      sub: p.disqualified > 0 ? `${p.disqualified} filtered out as off-ICP` : undefined,
    },
    {
      key: "drafting",
      icon: PencilLine,
      label: "Drafting outreach",
      value: p.drafting,
      reached: p.drafting > 0 || downstreamFromDrafting,
    },
    {
      key: "review",
      icon: Inbox,
      label: "In review",
      value: p.inReview,
      reached: p.inReview > 0 || downstreamFromReview,
      attention: p.inReview > 0,
      href: "/review",
      sub: p.inReview > 0 ? "awaiting your approval" : "nothing sends without you",
    },
    {
      key: "sending",
      icon: Send,
      label: "Sending",
      value: p.sending,
      reached: p.sending > 0 || downstreamFromSending,
      sub:
        p.sent > 0
          ? `${p.sent} sent · ${p.sendMode === "automatic" ? "auto" : "after approval"}`
          : p.sendMode === "automatic"
            ? "auto"
            : "after approval",
    },
    {
      key: "active",
      icon: p.won > 0 ? CheckCircle2 : Flame,
      label: "Live conversations",
      value: p.active,
      reached: p.active > 0 || p.sent > 0,
      sub: `${p.replied} replied · ${p.won} won`,
    },
  ];

  const currentKey = currentStageKey(p);

  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="live-pipeline">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Live pipeline</Eyebrow>
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              p.scoutLive
                ? "animate-pulse bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)]"
                : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          {p.scoutLive ? "Live" : "Idle"}
        </span>
      </div>

      <ol className="mt-5">
        {stages.map((s, i) => (
          <StageRow
            key={s.key}
            stage={s}
            current={s.key === currentKey}
            last={i === stages.length - 1}
          />
        ))}
      </ol>

      <p className="mt-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {captionFor(p)}
      </p>
    </RevealItem>
  );
}

function StageRow({
  stage,
  current,
  last,
}: {
  stage: Stage;
  current: boolean;
  last: boolean;
}) {
  const { icon: Icon } = stage;

  // Node treatment encodes status at a glance: current = cyan + glow (where we are now),
  // attention = solid cyan (needs you), reached = filled dark (work got here), else light.
  const nodeClass = current
    ? "bg-[var(--cyan)] text-white shadow-[0_0_12px_rgba(48,207,255,0.5)]"
    : stage.attention
      ? "bg-[var(--cyan)] text-white"
      : stage.reached
        ? "bg-foreground text-background"
        : "bg-foreground/[0.05] text-[var(--ink-4)]";

  const body = (
    <div
      className={cn(
        "flex flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors",
        current && "bg-[var(--cyan-tint)]",
        stage.href && "group-hover:bg-[var(--cyan-tint)]/60",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{stage.label}</span>
          {current && (
            <span className="rounded-full bg-[var(--cyan)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
              Now
            </span>
          )}
        </div>
        {stage.sub && (
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
            {stage.sub}
          </p>
        )}
      </div>
      {stage.status ? (
        <span
          className={cn(
            "shrink-0 text-sm font-semibold",
            stage.reached ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {stage.status}
        </span>
      ) : (
        <span
          className={cn(
            "shrink-0 font-mono text-xl font-semibold tabular-nums",
            stage.value > 0 ? "text-foreground" : "text-[var(--ink-4)]",
          )}
        >
          {stage.value}
        </span>
      )}
    </div>
  );

  return (
    <li className="flex gap-3">
      {/* connector rail */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "relative grid size-9 shrink-0 place-items-center rounded-lg",
            nodeClass,
          )}
        >
          <Icon className="size-4" aria-hidden />
          {current && (
            <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)] ring-2 ring-background" />
          )}
        </span>
        {!last && (
          <span
            className={cn(
              "my-1 w-px flex-1",
              stage.reached ? "bg-foreground/25" : "bg-foreground/10",
            )}
            aria-hidden
          />
        )}
      </div>

      {/* body — clickable when the stage routes somewhere (review) */}
      <div className={cn("flex-1", !last && "pb-3")}>
        {stage.href ? (
          <Link
            href={stage.href}
            className="group flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
    </li>
  );
}

/** One honest sentence about the current state — leads with whatever needs the user, else proof of work. */
function captionFor(p: LivePipelineData): string {
  if (!p.scoutDeployed)
    return "Deploy a Prospect Agent to start the pipeline — every stage lights up here as it runs.";
  if (p.inReview > 0)
    return `${p.inReview} draft${p.inReview === 1 ? "" : "s"} waiting for your approval — nothing sends until you sign off.`;
  if (p.drafting > 0)
    return "Your Outreach Agent is drafting personalized messages for qualified leads right now.";
  if (p.sending > 0)
    return "Approved outreach is sending at a human-like pace from your LinkedIn.";
  if (p.pulled > 0)
    return `${p.pulled} prospect${p.pulled === 1 ? "" : "s"} pulled, ${p.disqualified} filtered out — your agent keeps only the high-quality fits.`;
  return p.scoutLive
    ? `Your Prospect Agent is live — first prospects land within ~15 min (next run ${p.scoutNextRunLabel}).`
    : "Your Prospect Agent is paused — resume it to refill the pipeline.";
}

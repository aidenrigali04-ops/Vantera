"use client";

import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Flame,
  Inbox,
  PencilLine,
  Send,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow, PANEL_SURFACE, RevealItem } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * Live pipeline — the autonomous outreach process, made visible end to end so the
 * silent post-launch waiting period (the named churn cliff) reads as "working", not
 * "broken". Funnel: Prospect Agent → pulled → disqualified → drafting → review →
 * sending → sent → active. Real counts from leads + scheduled_sends.
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
  status?: string; // shown instead of a number (agent node)
  sub?: string;
  live?: boolean; // in-progress → pulsing dot on the icon
  attention?: boolean; // needs the user (drafts in review)
  muted?: boolean; // disqualified — the filter working, de-emphasized
  href?: string;
};

export function LivePipeline(p: LivePipelineData) {
  const stages: Stage[] = [
    {
      key: "agent",
      icon: Bot,
      label: "Prospect Agent",
      value: 0,
      status: p.scoutLive ? "Live" : p.scoutDeployed ? "Paused" : "Off",
      sub: p.scoutLive
        ? `next run ${p.scoutNextRunLabel}`
        : p.scoutDeployed
          ? "paused"
          : "not deployed",
      live: p.scoutLive,
    },
    { key: "pulled", icon: Users, label: "Prospects pulled", value: p.pulled },
    {
      key: "disqualified",
      icon: UserX,
      label: "Disqualified",
      value: p.disqualified,
      muted: true,
      sub: "off-ICP, filtered",
    },
    {
      key: "drafting",
      icon: PencilLine,
      label: "Drafting",
      value: p.drafting,
      live: p.drafting > 0,
    },
    {
      key: "review",
      icon: Inbox,
      label: "Drafted",
      value: p.inReview,
      attention: p.inReview > 0,
      href: "/review",
      sub: p.inReview > 0 ? "awaiting approval" : "in review",
    },
    {
      key: "sending",
      icon: Send,
      label: "Sending",
      value: p.sending,
      live: p.sending > 0,
      sub: p.sendMode === "automatic" ? "auto" : "after approval",
    },
    { key: "sent", icon: CheckCircle2, label: "Sent", value: p.sent },
    {
      key: "active",
      icon: Flame,
      label: "Active",
      value: p.active,
      sub: `${p.replied} replied · ${p.won} won`,
    },
  ];

  return (
    <RevealItem className={cn(PANEL_SURFACE, "p-5")} data-copilot="live-pipeline">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Live pipeline</Eyebrow>
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              p.scoutLive ? "animate-pulse bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)]" : "bg-muted-foreground/40"
            )}
            aria-hidden
          />
          {p.scoutLive ? "Live" : "Idle"}
        </span>
      </div>

      <div className="mt-5 flex items-start gap-0.5 overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-start">
            <StageNode stage={s} />
            {i < stages.length - 1 && (
              <ChevronRight
                className="mx-0.5 mt-6 size-4 shrink-0 text-muted-foreground/30"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {captionFor(p)}
      </p>
    </RevealItem>
  );
}

function StageNode({ stage }: { stage: Stage }) {
  const { icon: Icon } = stage;
  const node = (
    <div
      className={cn(
        "flex min-w-[94px] flex-col items-center gap-1.5 rounded-xl px-2.5 py-2.5 text-center transition-colors",
        stage.attention && "bg-foreground/[0.06]",
        stage.href && "hover:bg-foreground/[0.05]"
      )}
    >
      <span
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg",
          stage.muted
            ? "bg-foreground/[0.04] text-muted-foreground/60"
            : stage.attention
              ? "bg-foreground text-background"
              : "bg-foreground/10 text-foreground/80"
        )}
      >
        <Icon className="size-4" aria-hidden />
        {stage.live && (
          <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)] ring-2 ring-background" />
        )}
      </span>
      {stage.status ? (
        <span
          className={cn(
            "text-sm font-semibold",
            stage.live ? "text-[var(--cyan-strong)]" : "text-muted-foreground"
          )}
        >
          {stage.status}
        </span>
      ) : (
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums",
            stage.muted && "text-muted-foreground"
          )}
        >
          {stage.value}
        </span>
      )}
      <span className="text-[11px] font-medium leading-tight text-foreground/80">{stage.label}</span>
      {stage.sub && <span className="text-[10px] leading-tight text-muted-foreground">{stage.sub}</span>}
    </div>
  );

  return stage.href ? (
    <Link href={stage.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {node}
    </Link>
  ) : (
    node
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

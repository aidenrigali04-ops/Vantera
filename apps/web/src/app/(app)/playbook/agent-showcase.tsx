"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Radar, ScanSearch, Send, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { FormError } from "@/components/form-error";
import { cn } from "@/lib/utils";
import { SEGMENT_TRACK, segmentClass } from "@/components/app/surface";
import { setAgentStatus, type AgentActionState } from "./actions";
import { RunNowButton } from "./run-now";
import type { ShowcaseActivity, ShowcaseAgent, ShowcaseKind } from "./agent-showcase-data";
import { MiniFunnel } from "./mini-funnel";
import { ActivityFeedView } from "./activity-feed-view";
import { useUntil } from "@/lib/use-until";

function statusLabel(s: ShowcaseAgent["status"]): string {
  return s === "live" ? "Live" : s === "paused" ? "Paused" : "Draft";
}

/* The same pastel icon tiles as the Playbook cards (agent-card.tsx). */
const KIND_TILE: Record<ShowcaseKind, { icon: typeof Radar; className: string }> = {
  scout: { icon: ScanSearch, className: "bg-[#dbe9fd] text-[#1461d1]" },
  copy: { icon: Send, className: "bg-[#d5efdf] text-[#13824a]" },
  intent: { icon: Radar, className: "bg-[#e2defb] text-[#5b4bd1]" },
};

// ── switcher: the app's segmented filter track ───────────────────────────────
function Switcher({
  agents,
  activeKind,
  onSelect,
}: {
  agents: ShowcaseAgent[];
  activeKind: ShowcaseKind;
  onSelect: (k: ShowcaseKind) => void;
}) {
  return (
    <div role="tablist" aria-label="Agents" className={cn(SEGMENT_TRACK, "mb-8")}>
      {agents.map((a) => (
        <button
          key={a.kind}
          type="button"
          role="tab"
          aria-selected={a.kind === activeKind}
          onClick={() => onSelect(a.kind)}
          className={cn(segmentClass(a.kind === activeKind), "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]")}
        >
          {a.roleLabel}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: ShowcaseAgent["status"] }) {
  const live = status === "live";
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--ink-mid)]">
      <span className={cn("size-1.5 rounded-full", live ? "bg-[var(--positive)]" : "bg-[var(--ink-dim)]/50")} />
      {statusLabel(status)}
    </span>
  );
}

// ── details: copy + run-summary panel + actions ──────────────────────────────
function AgentDetails({ agent }: { agent: ShowcaseAgent }) {
  const [statusState, statusAction] = useActionState<AgentActionState, FormData>(
    setAgentStatus,
    {},
  );

  const live = agent.status === "live";
  const automatic = agent.sendMode === "automatic";
  const nextRun = useUntil(agent.nextRunAt, agent.nextRunLabel);

  const runLine =
    agent.kind === "scout" || agent.kind === "intent"
      ? live
        ? `Next run ${nextRun}${agent.cadence ? ` · every ${agent.cadence === "daily" ? "day" : agent.cadence === "intraday" ? "6 hours" : "week"}` : ""}`
        : agent.lastRanLabel
          ? `Last ran ${agent.lastRanLabel}`
          : "No runs yet"
      : automatic
        ? "Sending automatically — flagged drafts still come to Approvals."
        : "Drafts wait in Approvals until you approve them.";

  return (
    <div className="flex flex-col items-start text-left">
      <div className="mb-4 flex items-center gap-4">
        {(() => {
          const tile = KIND_TILE[agent.kind];
          return (
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-[var(--r-square)]", tile.className)}>
              <tile.icon className="size-[22px]" strokeWidth={2} aria-hidden />
            </span>
          );
        })()}
        <div className="min-w-0">
          <Eyebrow>{agent.roleLabel}</Eyebrow>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.03em] text-[var(--ink)]">{agent.name}</h1>
            <StatusPill status={agent.status} />
          </div>
        </div>
      </div>
      <p className="mb-6 max-w-xl text-[14.5px] leading-relaxed text-[var(--ink-mid)]">{agent.summary}</p>

      {agent.icpNames.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {agent.icpNames.map((name) => (
            <Badge key={name} variant="secondary" className="font-normal">
              {name}
            </Badge>
          ))}
        </div>
      )}

      {/* run-summary panel */}
      <div className={cn(PANEL_SURFACE, "w-full space-y-5 p-6 text-left")}>
        <div className="flex gap-8">
          {agent.stats.map((s) => (
            <div key={s.label}>
              <p className="font-data text-3xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <MiniFunnel stages={agent.funnel} label={`${agent.name} funnel`} empty={agent.funnelEmpty} />

        {agent.progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{agent.progress.label}</span>
              <span className="font-data text-muted-foreground">{agent.progress.value}%</span>
            </div>
            <AnimatedProgress value={agent.progress.value} label={agent.progress.label} />
            <p className="text-xs text-muted-foreground">{agent.progress.caption}</p>
          </div>
        )}

        {agent.kind === "copy" && (
          <div className="flex flex-wrap items-center gap-2">
            <ChannelChip
              on={agent.channels.includes("linkedin")}
              icon={<MessageSquare className="size-3.5" />}
              label="LinkedIn"
            />
          </div>
        )}

        <p
          className="border-t border-[var(--hairline)] pt-4 text-xs text-muted-foreground"
          title={live && agent.nextRunTitle ? `Next run ${agent.nextRunTitle}` : undefined}
        >
          {runLine}
        </p>

        {/* T4 operate path: the agent's actual work, run by run — never config-only again. */}
        {agent.attention && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-btn)] bg-[var(--attention-tint)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--attention)]">
            <p className="min-w-0 flex-1">{agent.attention.reason}</p>
            <Button asChild variant="ghost" size="sm" className="-my-1 shrink-0 text-[var(--attention)]">
            <Link href={agent.attention.cta.href}>{agent.attention.cta.label}</Link>
          </Button>
          </div>
        )}
        {agent.runHistory.length > 0 && (
          <div className="border-t border-[var(--hairline)] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Recent runs
            </p>
            <ul className="mt-2 space-y-1.5">
              {agent.runHistory.map((r, i) => (
                <li key={i} className="flex items-baseline gap-3 text-xs">
                  <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{r.agoLabel}</span>
                  <span className="text-[var(--ink-2)]">{r.line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/playbook/${agent.kind}/edit`}>
            <Settings2 className="size-4" /> Edit settings
          </Link>
        </Button>
        {agent.kind === "scout" && (
          <Button asChild variant="outline" size="sm">
            <Link href="/playbook/scout/targeting">Targeting rules</Link>
          </Button>
        )}
        {live && (agent.kind === "scout" || agent.kind === "intent") && (
          <RunNowButton agentId={agent.id} />
        )}
        <form action={statusAction}>
          <input type="hidden" name="agentId" value={agent.id} />
          <input type="hidden" name="status" value={live ? "paused" : "live"} />
          <Button type="submit" variant="ghost" size="sm">
            {live ? "Pause" : "Resume"}
          </Button>
        </form>
      </div>
      <FormError message={statusState.error} />
    </div>
  );
}

function ChannelChip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        on
          ? "border-transparent bg-[var(--acc-tint)] font-medium text-[var(--acc-ink)]"
          : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-dim)]",
      )}
    >
      {icon}
      {label}
      {!on && <span className="opacity-70">· off</span>}
    </span>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
export function AgentShowcase({
  agents,
  activity,
  initialKind,
}: {
  agents: ShowcaseAgent[];
  /** UX-3: account-wide narrated feed (setup milestones + runs), server-built */
  activity: ShowcaseActivity[];
  initialKind: ShowcaseKind;
}) {
  const has = (k: ShowcaseKind) => agents.some((a) => a.kind === k);
  const [activeKind, setActiveKind] = useState<ShowcaseKind>(
    has(initialKind) ? initialKind : (agents[0]?.kind ?? "scout"),
  );

  const current = agents.find((a) => a.kind === activeKind) ?? agents[0];
  if (!current) return null;

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      {agents.length > 1 && (
        <Switcher agents={agents} activeKind={activeKind} onSelect={setActiveKind} />
      )}

      {/* one calm crossfade on switch — the layout never mirrors, so the eye
          stays anchored and switching feels instant, not disorienting */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.kind}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <AgentDetails agent={current} />
        </motion.div>
      </AnimatePresence>

      {/* outside the crossfade: the feed is account-wide, so it stays put on switch */}
      <div className="mt-8">
        <ActivityFeedView items={activity} />
      </div>
    </div>
  );
}

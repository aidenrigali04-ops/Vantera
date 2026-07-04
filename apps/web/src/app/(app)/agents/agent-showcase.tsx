"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bot, PenLine, MessageSquare, Radar, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { CardGlass } from "@/components/ui/card";
import { Eyebrow, PANEL_SURFACE } from "@/components/ui/panel";
import { FormError } from "@/components/form-error";
import { cn } from "@/lib/utils";
import { setAgentStatus, type AgentActionState } from "./actions";
import type { ShowcaseAgent, ShowcaseKind } from "./agent-showcase-data";

// ── time helpers (shared convention with the dashboard/agent-card) ───────────
function timeUntil(iso: string | null): string {
  if (!iso) return "within ~15 min";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ~${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ~${hrs}h`;
  return `in ~${Math.round(hrs / 24)}d`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "no runs yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function statusLabel(s: ShowcaseAgent["status"]): string {
  return s === "live" ? "Live" : s === "paused" ? "Paused" : "Draft";
}

const ORB_ICON: Record<ShowcaseKind, typeof Bot> = {
  scout: Bot,
  intent: Radar,
  copy: PenLine,
};

// ── segmented switcher: clean top tabs, sliding highlight ────────────────────
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
    <div className="mb-10 flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-white p-1 shadow-[var(--shadow-card)]">
        {agents.map((a) => {
          const active = a.kind === activeKind;
          return (
            <button
              key={a.kind}
              type="button"
              onClick={() => onSelect(a.kind)}
              className="relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {active && (
                <motion.span
                  layoutId="agent-seg"
                  className="absolute inset-0 rounded-full bg-foreground"
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10",
                  active ? "text-background" : "text-[var(--ink-3)] hover:text-foreground",
                )}
              >
                {a.roleLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── orb: the agent, ring rotates only while Live ─────────────────────────────
function AgentOrb({ agent }: { agent: ShowcaseAgent }) {
  const reduce = useReducedMotion();
  const live = agent.status === "live";
  const Icon = ORB_ICON[agent.kind];

  return (
    <div className="relative mx-auto shrink-0">
      {/* dashed orbit ring — spins slowly only while the agent is working */}
      <motion.div
        aria-hidden
        animate={!reduce && live ? { rotate: 360 } : undefined}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-12%] rounded-full border border-dashed border-foreground/12"
      />

      <div className="relative grid size-44 place-items-center rounded-full border border-[var(--hairline)] bg-white shadow-[var(--shadow-card)] md:size-52">
        <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--cyan)] to-[var(--cyan-strong)] text-white md:size-20">
          <Icon className="size-8 md:size-9" />
        </span>
      </div>

      {/* status pill */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className="flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground shadow-sm">
          <span
            className={cn(
              "size-1.5 rounded-full",
              live
                ? "bg-[var(--cyan-strong)] ring-2 ring-[var(--cyan)]/25"
                : "bg-muted-foreground/40",
            )}
          />
          {statusLabel(agent.status)}
        </div>
      </div>
    </div>
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

  const runLine =
    agent.kind === "scout" || agent.kind === "intent"
      ? live
        ? `Next run ${timeUntil(agent.nextRunAt)}${agent.cadence ? ` · every ${agent.cadence === "daily" ? "day" : "week"}` : ""}`
        : `Last ran ${timeAgo(agent.lastRunAt)}`
      : automatic
        ? "Sending automatically — flagged drafts still come to your review queue."
        : "Drafts wait for your approval in the review queue.";

  return (
    <div className="flex flex-col items-start text-left">
      <Eyebrow className="mb-2">{agent.roleLabel}</Eyebrow>
      <h1 className="font-heading mb-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {agent.name}
      </h1>
      <p className="mb-6 max-w-md leading-relaxed text-muted-foreground">{agent.summary}</p>

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
      <div className={cn(PANEL_SURFACE, "relative isolate w-full space-y-5 overflow-hidden p-6 text-left")}>
        <CardGlass />
        <div className="flex gap-8">
          {agent.stats.map((s) => (
            <div key={s.label}>
              <p className="font-data text-3xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

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

        <p className="border-t border-[var(--hairline)] pt-4 text-xs text-muted-foreground">
          {runLine}
        </p>
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {agent.kind !== "intent" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/agents/${agent.kind}/edit`}>
              <Settings2 className="size-4" /> Edit config
            </Link>
          </Button>
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
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border bg-muted text-muted-foreground",
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
  initialKind,
}: {
  agents: ShowcaseAgent[];
  initialKind: ShowcaseKind;
}) {
  const has = (k: ShowcaseKind) => agents.some((a) => a.kind === k);
  const [activeKind, setActiveKind] = useState<ShowcaseKind>(
    has(initialKind) ? initialKind : (agents[0]?.kind ?? "scout"),
  );

  const current = agents.find((a) => a.kind === activeKind) ?? agents[0];
  if (!current) return null;

  return (
    <div className="mx-auto max-w-4xl py-2">
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
          className="grid items-center gap-12 py-6 md:grid-cols-[auto_1fr] md:gap-16"
        >
          <AgentOrb agent={current} />
          <AgentDetails agent={current} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

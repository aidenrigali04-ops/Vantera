"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Bot, PenLine, Phone, Mail, MessageSquare, Settings2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { CardGlass } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { setAgentStatus, updateSendMode, type AgentActionState } from "./actions";
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

// ── motion ───────────────────────────────────────────────────────────────────
const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 110, damping: 20 },
  },
  exit: { opacity: 0, y: -8, filter: "blur(4px)" },
};
function orbVariants(fromLeft: boolean): Variants {
  return {
    initial: { opacity: 0, scale: 0.8, filter: "blur(12px)", x: fromLeft ? -60 : 60 },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      x: 0,
      transition: { type: "spring", stiffness: 220, damping: 22 },
    },
    exit: { opacity: 0, scale: 0.7, filter: "blur(14px)", transition: { duration: 0.22 } },
  };
}

// ── backdrop: faint warm wash that shifts to the active agent's side ─────────
function Backdrop({ side }: { side: "left" | "right" }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        aria-hidden
        animate={{
          background:
            side === "left"
              ? "radial-gradient(60% 60% at 18% 42%, rgba(255,204,26,0.10), transparent 70%)"
              : "radial-gradient(60% 60% at 82% 42%, rgba(255,115,13,0.10), transparent 70%)",
        }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
      />
    </div>
  );
}

// ── orb: the agent, rings rotate only while Live ─────────────────────────────
function AgentOrb({ agent, fromLeft }: { agent: ShowcaseAgent; fromLeft: boolean }) {
  const reduce = useReducedMotion();
  const live = agent.status === "live";
  const Icon = agent.kind === "scout" ? Bot : agent.kind === "caller" ? Phone : PenLine;

  return (
    <motion.div layout="position" className="relative shrink-0">
      {/* dashed orbit ring — spins while the agent is working */}
      <motion.div
        aria-hidden
        animate={!reduce && live ? { rotate: 360 } : undefined}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-14%] rounded-full border border-dashed border-foreground/15"
      />
      {/* soft white glow */}
      <motion.div
        aria-hidden
        animate={!reduce && live ? { scale: [1, 1.06, 1], opacity: [0.5, 0.7, 0.5] } : undefined}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,#ffffff_0%,#d4d4d4_55%,transparent_72%)] opacity-30 blur-2xl"
      />

      <div className="relative flex size-64 items-center justify-center overflow-hidden rounded-full border border-border bg-card shadow-sm md:size-80">
        <AnimatePresence mode="wait">
          <motion.div
            key={agent.kind}
            variants={orbVariants(fromLeft)}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center gap-3"
          >
            <span className="flex size-20 items-center justify-center rounded-2xl bg-foreground text-background md:size-24">
              <Icon className="size-9 md:size-11" />
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* status pill */}
      <motion.div
        layout="position"
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap"
      >
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground shadow-sm">
          <span
            className={`size-1.5 rounded-full ${
              live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40"
            }`}
          />
          {statusLabel(agent.status)}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── details: copy + run-summary panel + actions ──────────────────────────────
function AgentDetails({ agent, alignRight }: { agent: ShowcaseAgent; alignRight: boolean }) {
  const [statusState, statusAction] = useActionState<AgentActionState, FormData>(
    setAgentStatus,
    {}
  );
  const [modeState, switchMode, switchingMode] = useActionState<AgentActionState, FormData>(
    updateSendMode,
    {}
  );

  const live = agent.status === "live";
  const automatic = agent.sendMode === "automatic";

  const runLine =
    agent.kind === "scout"
      ? live
        ? `Next run ${timeUntil(agent.nextRunAt)}${agent.cadence ? ` · every ${agent.cadence === "daily" ? "day" : "week"}` : ""}`
        : `Last ran ${timeAgo(agent.lastRunAt)}`
      : agent.kind === "caller"
        ? "Every call waits in your review queue before it dials out."
        : automatic
          ? "Sending automatically — flagged drafts still come to your review queue."
          : "Drafts wait for your approval in the review queue.";

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`flex flex-col ${alignRight ? "items-end text-right" : "items-start text-left"}`}
    >
      <motion.p
        variants={item}
        className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
      >
        {agent.roleLabel}
      </motion.p>
      <motion.h1
        variants={item}
        className="mb-3 font-heading text-4xl font-semibold tracking-tight md:text-5xl"
      >
        {agent.name}
      </motion.h1>
      <motion.p
        variants={item}
        className={`mb-7 max-w-sm leading-relaxed text-muted-foreground ${alignRight ? "ml-auto" : "mr-auto"}`}
      >
        {agent.summary}
      </motion.p>

      {agent.icpNames.length > 0 && (
        <motion.div
          variants={item}
          className={`mb-6 flex flex-wrap gap-1.5 ${alignRight ? "justify-end" : "justify-start"}`}
        >
          {agent.icpNames.map((name) => (
            <Badge key={name} variant="secondary" className="font-normal">
              {name}
            </Badge>
          ))}
        </motion.div>
      )}

      {/* run-summary panel */}
      <motion.div
        variants={item}
        className="relative isolate w-full space-y-5 overflow-hidden rounded-2xl border border-border p-6 text-left shadow-sm"
      >
        <CardGlass />
        <div className="flex gap-8">
          {agent.stats.map((s) => (
            <div key={s.label}>
              <p className="font-mono text-3xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {agent.progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{agent.progress.label}</span>
              <span className="font-mono text-muted-foreground">{agent.progress.value}%</span>
            </div>
            <AnimatedProgress value={agent.progress.value} label={agent.progress.label} />
            <p className="text-xs text-muted-foreground">{agent.progress.caption}</p>
          </div>
        )}

        {agent.kind === "copy" && (
          <div className="flex flex-wrap items-center gap-2">
            <ChannelChip on={agent.channels.includes("email")} icon={<Mail className="size-3.5" />} label="Email" />
            <ChannelChip
              on={agent.channels.includes("linkedin")}
              icon={<MessageSquare className="size-3.5" />}
              label="LinkedIn"
            />
          </div>
        )}
        {agent.kind === "caller" && (
          <div className="flex flex-wrap items-center gap-2">
            <ChannelChip on={true} icon={<Phone className="size-3.5" />} label="Phone" />
          </div>
        )}

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">{runLine}</p>
      </motion.div>

      {/* actions */}
      <motion.div
        variants={item}
        className={`mt-5 flex flex-wrap items-center gap-2 ${alignRight ? "justify-end" : "justify-start"}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href={`/agents/${agent.kind}/edit`}>
            <Settings2 className="size-4" /> Edit config
          </Link>
        </Button>
        <form action={statusAction}>
          <input type="hidden" name="agentId" value={agent.id} />
          <input type="hidden" name="status" value={live ? "paused" : "live"} />
          <Button type="submit" variant="ghost" size="sm">
            {live ? "Pause" : "Resume"}
          </Button>
        </form>
        {agent.kind === "copy" && agent.campaignId && (
          <form action={switchMode}>
            <input type="hidden" name="campaignId" value={agent.campaignId} />
            <input type="hidden" name="sendMode" value={automatic ? "review" : "automatic"} />
            <Button type="submit" variant="ghost" size="sm" disabled={switchingMode}>
              {automatic ? "Switch to review every draft" : "Switch to automatic sending"}
            </Button>
          </form>
        )}
      </motion.div>
      <FormError message={statusState.error ?? modeState.error} />
    </motion.div>
  );
}

function ChannelChip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        on
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {icon}
      {label}
      {!on && <span className="opacity-70">· off</span>}
    </span>
  );
}

// ── switcher: morphing pill, only when both agents exist ─────────────────────
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
    <div className="pointer-events-none sticky bottom-6 z-20 mt-12 flex justify-center">
      <motion.div
        layout
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/90 p-1.5 shadow-lg backdrop-blur-xl"
      >
        {agents.map((a) => {
          const active = a.kind === activeKind;
          return (
            <motion.button
              key={a.kind}
              type="button"
              onClick={() => onSelect(a.kind)}
              whileTap={{ scale: 0.96 }}
              className="relative flex h-9 items-center justify-center rounded-full px-5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {active && (
                <motion.span
                  layoutId="agent-switch-surface"
                  className="absolute inset-0 rounded-full bg-foreground"
                  transition={{ type: "spring", stiffness: 240, damping: 24 }}
                />
              )}
              <span
                className={`relative z-10 transition-colors ${
                  active ? "text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.roleLabel}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
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
    has(initialKind) ? initialKind : (agents[0]?.kind ?? "scout")
  );

  const current = agents.find((a) => a.kind === activeKind) ?? agents[0];
  if (!current) return null;

  // scout anchors left, outreach mirrors to the right — the signature flip
  const orbLeft = current.kind === "scout";

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-9rem)] max-w-5xl flex-col">
      <Backdrop side={orbLeft ? "left" : "right"} />

      <div className="relative z-10 flex flex-1 items-center">
        <motion.div
          layout
          transition={{ type: "spring", bounce: 0, duration: 0.7 }}
          className={`flex w-full flex-col items-center justify-center gap-14 py-10 md:gap-24 lg:gap-32 ${
            orbLeft ? "md:flex-row" : "md:flex-row-reverse"
          }`}
        >
          <AgentOrb agent={current} fromLeft={orbLeft} />
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              <AgentDetails key={current.kind} agent={current} alignRight={!orbLeft} />
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {agents.length > 1 && (
        <Switcher agents={agents} activeKind={activeKind} onSelect={setActiveKind} />
      )}
    </div>
  );
}

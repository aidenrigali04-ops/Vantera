"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  UserPlus,
  Mail,
  MessageSquare,
  Phone,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Panel, Reveal, RevealItem, Eyebrow } from "@/components/ui/panel";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { cn } from "@/lib/utils";
import type { PipelineViewModel, SequenceStage } from "./queries";

export type ActivityItem = {
  id: string;
  kind: "reply" | "converted" | "exhausted";
  who: string;
  verb: string;
  at: string;
};

const STAGE_ICON: Record<SequenceStage, LucideIcon> = {
  linkedin: UserPlus,
  email: Mail,
  imessage: MessageSquare,
  call: Phone,
};

export function PipelineBoard({
  vm,
  activity,
  goalLabel,
  pipelineValueLabel,
}: {
  vm: PipelineViewModel;
  activity: ActivityItem[];
  goalLabel: string | null;
  pipelineValueLabel: string;
}) {
  const empty = vm.activeTotal === 0 && vm.convertedClients === 0 && vm.pausedTotal === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every validated lead, moving through the sequence — and stopping the instant they convert.
        </p>
      </div>

      {empty ? (
        <EmptyState />
      ) : (
        <Reveal className="space-y-4">
          {/* Goal progress — the gradient everything is climbing toward */}
          <RevealItem>
            <GoalPanel vm={vm} goalLabel={goalLabel} pipelineValueLabel={pipelineValueLabel} />
          </RevealItem>

          {/* The stage rail — leads advancing channel by channel */}
          <RevealItem>
            <StageRail vm={vm} />
          </RevealItem>

          {/* Replies that need a human */}
          {vm.pausedTotal > 0 && (
            <RevealItem>
              <PausedCallout count={vm.pausedTotal} />
            </RevealItem>
          )}

          {/* Live activity — proof the machine is working */}
          <RevealItem>
            <ActivityFeed activity={activity} />
          </RevealItem>
        </Reveal>
      )}
    </div>
  );
}

function GoalPanel({
  vm,
  goalLabel,
  pipelineValueLabel,
}: {
  vm: PipelineViewModel;
  goalLabel: string | null;
  pipelineValueLabel: string;
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Revenue progress</Eyebrow>
        {goalLabel ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {vm.goalProgressPct}% of goal
          </span>
        ) : (
          <Link
            href="/settings"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/80 underline-offset-4 hover:underline"
          >
            Set a revenue goal
          </Link>
        )}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">{pipelineValueLabel}</span>
        {goalLabel && (
          <span className="pb-1 font-mono text-sm text-muted-foreground">/ {goalLabel} mo</span>
        )}
      </div>

      <AnimatedProgress value={vm.goalProgressPct ?? 0} className="mt-4 h-1" label="Revenue toward goal" />

      <p className="mt-3 text-sm text-muted-foreground">
        <span className="text-foreground tabular-nums">{vm.convertedClients}</span> won ·{" "}
        <span className="text-foreground tabular-nums">{vm.activeTotal}</span> in motion
      </p>
    </Panel>
  );
}

function StageRail({ vm }: { vm: PipelineViewModel }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      {vm.stages.map((s) => (
        <div key={s.stage} className="flex items-center gap-3 md:flex-1 md:flex-col">
          <StageTile stage={s.stage} label={s.label} count={s.count} />
          <Connector />
        </div>
      ))}
      <div className="flex md:flex-1">
        <WonTile count={vm.convertedClients} />
      </div>
    </div>
  );
}

function StageTile({
  stage,
  label,
  count,
}: {
  stage: SequenceStage;
  label: string;
  count: number;
}) {
  const Icon = STAGE_ICON[stage];
  return (
    <Panel interactive className="w-full p-4 md:p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums">{count}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {count === 1 ? "lead here" : "leads here"}
      </div>
    </Panel>
  );
}

function WonTile({ count }: { count: number }) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border p-4 md:p-5 shadow-lg",
        "border-white/[0.18] bg-white/[0.06] shadow-black/30"
      )}
    >
      <div className="flex items-center justify-between">
        <Eyebrow>Won</Eyebrow>
        <Check className="size-4 text-foreground" aria-hidden />
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums">{count}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {count === 1 ? "meeting booked" : "meetings booked"}
      </div>
    </div>
  );
}

/** A → connector between stages; rotates on mobile so the column still reads as a flow. */
function Connector() {
  return (
    <ChevronRight
      className="size-4 shrink-0 rotate-90 text-muted-foreground/40 md:rotate-0"
      aria-hidden
    />
  );
}

function PausedCallout({ count }: { count: number }) {
  return (
    <Link href="/leads?tab=replied" className="block">
      <Panel interactive className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          <p className="text-sm">
            <span className="font-mono font-semibold tabular-nums">{count}</span>{" "}
            {count === 1 ? "lead replied" : "leads replied"} — the sequence paused for you
          </p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Panel>
    </Link>
  );
}

function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <Panel className="p-5">
      <Eyebrow>Live activity</Eyebrow>
      {activity.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No replies yet — the first touches are going out. Activity shows up here the moment a lead
          responds.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  a.kind === "converted" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" : "bg-foreground/50"
                )}
              />
              <span className="text-foreground">{a.who}</span>
              <span className="text-muted-foreground">{a.verb}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground/70">{a.at}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Panel className="flex flex-col items-center px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04]">
          <Rocket className="size-5 text-foreground" aria-hidden />
        </div>
        <h2 className="mt-5 font-heading text-lg font-semibold">Your pipeline is ready to run</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Launch a campaign and every qualified lead flows through LinkedIn → Email → iMessage →
          Caller automatically — pausing the instant someone replies.
        </p>
        <Link
          href="/agents"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-white/[0.06] px-5 py-2.5 text-sm font-medium transition-colors hover:border-white/25"
        >
          Launch a campaign
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Panel>
    </motion.div>
  );
}

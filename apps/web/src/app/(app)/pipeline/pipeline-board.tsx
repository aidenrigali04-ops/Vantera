"use client";

import Link from "next/link";
import { ArrowRight, Check, Rocket, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { cn } from "@/lib/utils";
import type { PipelineViewModel } from "./queries";
import { LivePipeline, type LivePipelineData } from "../dashboard/live-pipeline";

export type ActivityItem = {
  id: string;
  kind: "reply" | "converted" | "exhausted";
  who: string;
  verb: string;
  at: string;
};

export function PipelineBoard({
  vm,
  activity,
  goalLabel,
  pipelineValueLabel,
  livePipeline,
}: {
  vm: PipelineViewModel;
  activity: ActivityItem[];
  goalLabel: string | null;
  pipelineValueLabel: string;
  livePipeline: LivePipelineData;
}) {
  const empty = vm.activeTotal === 0 && vm.convertedClients === 0 && vm.pausedTotal === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every validated lead, moving through the sequence — and stopping the instant they convert.
          </p>
        </div>
        <Link
          href="/sequence"
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-4 py-2 text-sm transition-colors hover:border-[var(--cyan-line)]"
        >
          <Settings2 className="size-4" aria-hidden /> Configure sequence
        </Link>
      </div>

      {empty ? (
        <EmptyState />
      ) : (
        // Grounded two-column layout: the live funnel + its activity on the left, the
        // revenue proof + the win count on the right — balanced, complementary panels.
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="flex flex-col gap-6">
            <LivePipeline {...livePipeline} />
            <ActivityFeed activity={activity} />
          </div>
          <div className="flex flex-col gap-6">
            <GoalPanel vm={vm} goalLabel={goalLabel} pipelineValueLabel={pipelineValueLabel} />
            <WonTile count={vm.convertedClients} />
            {vm.pausedTotal > 0 && <PausedCallout count={vm.pausedTotal} />}
          </div>
        </div>
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

function WonTile({ count }: { count: number }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Won</Eyebrow>
        <span className="grid size-6 place-items-center rounded-full bg-[#e9f9f0] text-[#0f9d58]">
          <Check className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{count}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {count === 1 ? "meeting booked" : "meetings booked"}
      </div>
    </Panel>
  );
}

function PausedCallout({ count }: { count: number }) {
  return (
    <Link href="/leads?tab=replied" className="block">
      <Panel interactive className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--cyan)]/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--cyan)]" />
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
                  a.kind === "converted"
                    ? "bg-[#13b07a]"
                    : a.kind === "reply"
                      ? "bg-[var(--cyan)]"
                      : "bg-foreground/40"
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
        <div className="flex size-12 items-center justify-center rounded-full bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
          <Rocket className="size-5" aria-hidden />
        </div>
        <h2 className="mt-5 font-heading text-lg font-semibold">Your pipeline is ready to run</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Launch a campaign and every qualified lead flows through your LinkedIn sequence
          automatically — pausing the instant someone replies.
        </p>
        <Link
          href="/agents"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0a0c12] px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(48,207,255,0.55)]"
        >
          Launch a campaign
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Panel>
    </motion.div>
  );
}

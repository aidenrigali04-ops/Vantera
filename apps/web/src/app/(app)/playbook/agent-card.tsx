"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Radar, ScanSearch, Send, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { FormError } from "@/components/form-error";
import { setAgentStatus, updateSendMode, type AgentActionState } from "./actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RunNowButton } from "./run-now";
import { runLine, type AgentRunRow, type Attention } from "./agent-health";
import { useUntil } from "@/lib/use-until";
import { MiniFunnel } from "./mini-funnel";
import type { MiniStage } from "./card-funnel";

/* Each agent gets the landing's pastel icon tile (components/landing/frame.tsx TONES). */
const KIND_TILE = {
  scout: { icon: ScanSearch, className: "bg-[#dbe9fd] text-[#1461d1]" },
  copy: { icon: Send, className: "bg-[#d5efdf] text-[#13824a]" },
  intent: { icon: Radar, className: "bg-[#e2defb] text-[#5b4bd1]" },
} as const;

export type AgentRow = {
  id: string;
  kind: "scout" | "copy" | "intent";
  name: string;
  status: "draft" | "live" | "paused";
  config: Record<string, unknown> | null;
  run_at_time: string | null;
  cadence: "daily" | "weekly" | "intraday" | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  deployed_at: string | null;
  campaign_id?: string | null;
  campaigns?: { send_mode: "automatic" | "review" | "manual" | null } | null;
  agent_icps?: { position: number; icps: { name: string } | null }[];
};

export function AgentCard({
  agent,
  roleLabel,
  stats,
  index = 0,
  attention = null,
  lastRun = null,
  lastRunAgo = null,
  nextRunLabel,
  nextRunTitle = null,
  lastRanLabel = null,
  funnel = null,
  funnelEmpty,
}: {
  agent: AgentRow;
  roleLabel: string;
  stats: { label: string; value: number }[];
  index?: number;
  /** T4: why a LIVE agent needs the owner (null = healthy) — computed by agent-health.ts */
  attention?: Attention;
  /** T4: the latest recorded run, for the what-happened line */
  lastRun?: AgentRunRow | null;
  lastRunAgo?: string | null;
  /** server-formatted `fmtUntil(next_run_at)`; re-ticked client-side every 60s */
  nextRunLabel: string;
  /** absolute next run ("Thu 10:30am", agent timezone) for the hover title */
  nextRunTitle?: string | null;
  /** server-formatted "5h ago" of last_run_at */
  lastRanLabel?: string | null;
  /** UX-3: this agent's own mini funnel (card-funnel.ts), computed server-side */
  funnel?: MiniStage[] | null;
  /** shown under the funnel when every stage is zero */
  funnelEmpty?: string;
}) {
  const [state, action] = useActionState<AgentActionState, FormData>(setAgentStatus, {});
  const [modeState, switchMode, switchingMode] = useActionState<AgentActionState, FormData>(
    updateSendMode,
    {}
  );
  const modeFormRef = useRef<HTMLFormElement>(null);
  const live = agent.status === "live";
  const sendMode = agent.campaigns?.send_mode ?? "review";
  const automatic = sendMode === "automatic";
  const icpNames = (agent.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));
  const nextRun = useUntil(agent.next_run_at, nextRunLabel);

  return (
    <Panel index={index} interactive className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
        {(() => {
          const tile = KIND_TILE[agent.kind];
          return (
            <span className={`grid size-10 shrink-0 place-items-center rounded-[var(--r-tile)] ${tile.className}`}>
              <tile.icon className="size-[18px]" strokeWidth={2} aria-hidden />
            </span>
          );
        })()}
        <div className="flex flex-col gap-1.5">
          <Eyebrow>{roleLabel}</Eyebrow>
          <h3 className="font-heading flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Link
              href={`/playbook/${agent.kind}`}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {agent.name}
            </Link>
            {/* T4: a live-but-stalled agent shows amber "Needs attention", never a green lie. */}
            <span
              className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tracking-normal ${
                live
                  ? attention
                    ? "border-transparent bg-[var(--attention-tint)] text-[var(--attention)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-mid)]"
                  : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-dim)]"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  live ? (attention ? "bg-[var(--attention)]" : "bg-[#13a05a]") : "bg-[var(--ink-dim)]/50"
                }`}
              />
              {live ? (attention ? "Needs attention" : "Live") : agent.status === "paused" ? "Paused" : "Draft"}
            </span>
          </h3>
        </div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/playbook/${agent.kind}/edit`}>
              <Settings2 className="size-4" /> Edit config
            </Link>
          </Button>
          {agent.kind === "scout" && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/playbook/scout/targeting">Targeting rules</Link>
            </Button>
          )}
          {live && (agent.kind === "scout" || agent.kind === "intent") && (
            <RunNowButton agentId={agent.id} />
          )}
          <form action={action}>
            <input type="hidden" name="agentId" value={agent.id} />
            <input type="hidden" name="status" value={live ? "paused" : "live"} />
            <Button type="submit" variant="ghost" size="sm">
              {live ? "Pause" : "Resume"}
            </Button>
          </form>
        </div>
      </div>

      {attention && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-btn)] bg-[var(--attention-tint)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--attention)]">
          <p className="min-w-0 flex-1">{attention.reason}</p>
          <Button asChild variant="ghost" size="sm" className="-my-1 shrink-0 text-[var(--attention)]">
            <Link href={attention.cta.href}>{attention.cta.label}</Link>
          </Button>
        </div>
      )}

      {icpNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {icpNames.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="max-w-full whitespace-normal break-words font-normal"
            >
              {name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-data text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        {funnel && funnel.length > 0 && (
          <MiniFunnel
            stages={funnel}
            label={`${agent.name} funnel`}
            empty={funnelEmpty}
            className="border-t border-[var(--hairline)] pt-3"
          />
        )}
        {(agent.kind === "scout" || agent.kind === "intent") && (
          <div className="flex flex-col gap-1">
            {/* T4: the work itself — what the last recorded run actually did. */}
            {lastRun && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Last run{lastRunAgo ? ` ${lastRunAgo}` : ""}:</span>{" "}
                {runLine(lastRun)}
              </p>
            )}
            <p className="text-xs text-muted-foreground" title={live && nextRunTitle ? `Next run ${nextRunTitle}` : undefined}>
              {live
                ? agent.next_run_at
                  ? `Next run ${nextRun}`
                  : "First run starts within 15 minutes"
                : lastRanLabel
                  ? `Last ran ${lastRanLabel}`
                  : "Paused before its first run"}
              {agent.cadence ? ` · every ${agent.cadence === "daily" ? "day" : agent.cadence === "intraday" ? "6 hours" : "week"}` : ""}
            </p>
          </div>
        )}
        {agent.kind === "copy" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              {automatic
                ? "Sending automatically — flagged drafts still come to Approvals."
                : "Drafts wait in Approvals until you approve them."}
            </p>
            {agent.campaign_id && (
              <form action={switchMode} ref={modeFormRef}>
                <input type="hidden" name="campaignId" value={agent.campaign_id} />
                <input type="hidden" name="sendMode" value={automatic ? "review" : "automatic"} />
                {automatic ? (
                  <Button type="submit" variant="ghost" size="sm" disabled={switchingMode} className="-mx-2">
                    Switch to review every draft
                  </Button>
                ) : (
                  /* T4: turning on autonomous sending is the most consequential control on
                     this page — it confirms (R2 idiom) instead of firing on one ghost click. */
                  <ConfirmDialog
                    title="Send automatically?"
                    description="Clean drafts go out on their own within your safety limits. Anything the style check flags still waits for you in Approvals. You can switch back anytime."
                    confirmLabel="Turn on automatic sending"
                    onConfirm={() => modeFormRef.current?.requestSubmit()}
                    trigger={(open) => (
                      <Button
                        type="button"
                        onClick={open}
                        variant="ghost"
                        size="sm"
                        disabled={switchingMode}
                        className="-mx-2"
                      >
                        Switch to automatic sending
                      </Button>
                    )}
                  />
                )}
              </form>
            )}
          </div>
        )}
        <FormError message={state.error ?? modeState.error} />
      </div>
    </Panel>
  );
}

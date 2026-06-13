"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { setAgentStatus, updateSendMode, type AgentActionState } from "./actions";

export type AgentRow = {
  id: string;
  kind: "scout" | "copy";
  name: string;
  status: "draft" | "live" | "paused";
  config: Record<string, unknown> | null;
  run_at_time: string | null;
  cadence: "daily" | "weekly" | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  deployed_at: string | null;
  campaign_id?: string | null;
  campaigns?: { send_mode: "automatic" | "review" | "manual" | null } | null;
  agent_icps?: { position: number; icps: { name: string } | null }[];
};

function formatRun(at: string | null, timezone: string): string | null {
  if (!at) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(at));
  } catch {
    return new Date(at).toLocaleString();
  }
}

export function AgentCard({
  agent,
  roleLabel,
  stats,
}: {
  agent: AgentRow;
  roleLabel: string;
  stats: { label: string; value: number }[];
}) {
  const [state, action] = useActionState<AgentActionState, FormData>(setAgentStatus, {});
  const [modeState, switchMode, switchingMode] = useActionState<AgentActionState, FormData>(
    updateSendMode,
    {}
  );
  const live = agent.status === "live";
  const sendMode = agent.campaigns?.send_mode ?? "review";
  const automatic = sendMode === "automatic";
  const icpNames = (agent.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));
  const nextRun = formatRun(agent.next_run_at, agent.timezone);
  const lastRun = formatRun(agent.last_run_at, agent.timezone);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
            <CardTitle className="flex items-center gap-2 text-lg">
              {agent.name}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  live ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40"}`}
                />
                {live ? "Live" : agent.status === "paused" ? "Paused" : "Draft"}
              </span>
            </CardTitle>
          </div>
          <form action={action}>
            <input type="hidden" name="agentId" value={agent.id} />
            <input type="hidden" name="status" value={live ? "paused" : "live"} />
            <Button type="submit" variant="ghost" size="sm">
              {live ? "Pause" : "Resume"}
            </Button>
          </form>
        </div>
        {icpNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {icpNames.map((name) => (
              <Badge key={name} variant="secondary" className="font-normal">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        {agent.kind === "scout" && (
          <p className="text-xs text-muted-foreground">
            {live
              ? nextRun
                ? `Next run ${nextRun}`
                : "First run starts within 15 minutes"
              : lastRun
                ? `Last ran ${lastRun}`
                : "Paused before its first run"}
            {agent.cadence ? ` · every ${agent.cadence === "daily" ? "day" : "week"}` : ""}
          </p>
        )}
        {agent.kind === "copy" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              {automatic
                ? "Sending automatically — flagged drafts still come to your review queue."
                : "Drafts wait for your approval in the review queue."}
            </p>
            {agent.campaign_id && (
              <form action={switchMode}>
                <input type="hidden" name="campaignId" value={agent.campaign_id} />
                <input
                  type="hidden"
                  name="sendMode"
                  value={automatic ? "review" : "automatic"}
                />
                <Button type="submit" variant="ghost" size="sm" disabled={switchingMode}>
                  {automatic ? "Switch to review every draft" : "Switch to automatic sending"}
                </Button>
              </form>
            )}
          </div>
        )}
        <FormError message={state.error ?? modeState.error} />
      </CardContent>
    </Card>
  );
}

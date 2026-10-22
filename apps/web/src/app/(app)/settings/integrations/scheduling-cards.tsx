"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { connectScheduling, disconnectScheduling, type SchedulingState } from "./scheduling-actions";
import { SCHEDULING_TOOLS } from "./scheduling-validation";

export type SchedulingConnectionRow = {
  provider: "calendly" | "calcom";
  status: "active" | "error";
  label: string | null;
  last_event_at: string | null;
  last_error: string | null;
};

function ToolCard({ tool, connection }: { tool: (typeof SCHEDULING_TOOLS)[number]; connection: SchedulingConnectionRow | undefined }) {
  const [connectState, connect, connecting] = useActionState<SchedulingState, FormData>(connectScheduling, {});
  const [disconnectState, disconnect, disconnecting] = useActionState<SchedulingState, FormData>(disconnectScheduling, {});
  const state = connection ? disconnectState : connectState;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{tool.label}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Meetings booked through your {tool.label} link are detected automatically and matched to the prospect.
          </p>
        </div>
        {connection && (
          <Badge variant={connection.status === "active" ? "default" : "destructive"} className="shrink-0">
            {connection.status === "active" ? "Connected" : "Needs attention"}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {connection ? (
          <form action={disconnect} className="space-y-2">
            <input type="hidden" name="provider" value={tool.provider} />
            {connection.label && <p className="text-sm">Connected as {connection.label}</p>}
            {connection.last_event_at && (
              <p className="text-xs text-muted-foreground">Last booking received {new Date(connection.last_event_at).toLocaleString()}</p>
            )}
            {connection.last_error && <p className="text-sm text-destructive">{connection.last_error}</p>}
            <Button type="submit" size="sm" variant="outline" disabled={disconnecting}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </form>
        ) : (
          <form action={connect} className="space-y-2">
            <input type="hidden" name="provider" value={tool.provider} />
            <Input name="apiKey" type="password" autoComplete="off" placeholder="Paste your API key" aria-label={`${tool.label} API key`} />
            <p className="text-xs text-muted-foreground">{tool.howTo}</p>
            <Button type="submit" size="sm" disabled={connecting}>
              {connecting ? "Connecting…" : `Connect ${tool.label}`}
            </Button>
          </form>
        )}
        {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="mt-2 text-sm text-muted-foreground">{state.success}</p>}
      </CardContent>
    </Card>
  );
}

/** ML-6: connect the scheduling tool behind your booking link. Plain functional UI. */
export function SchedulingCards({ connections }: { connections: SchedulingConnectionRow[] }) {
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Scheduling</h2>
        <p className="text-sm text-muted-foreground">
          Connect the tool behind your booking link so booked meetings are counted for real — no marking them by hand.
        </p>
      </div>
      {SCHEDULING_TOOLS.map((tool) => (
        <ToolCard key={tool.provider} tool={tool} connection={byProvider.get(tool.provider)} />
      ))}
    </section>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listConnectors } from "@vantera/crm-infra";
import {
  ConnectButton,
  ConnectionManager,
  type CrmConnectionRow,
} from "./integrations-forms";

export const metadata = { title: "Integrations" };

type Status = CrmConnectionRow["status"];

const STATUS_LABELS: Record<Status, string> = {
  connecting: "Connecting",
  active: "Connected",
  error: "Needs attention",
  disconnected: "Disconnected",
};

const STATUS_VARIANTS: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  connecting: "secondary",
  active: "default",
  error: "destructive",
  disconnected: "outline",
};

function lastChecked(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function IntegrationsPage() {
  const supabase = await createClient();

  // RLS scopes this to the session's account (rule 02) — no account id passed.
  const { data: rows } = await supabase
    .from("crm_connections")
    .select("id, provider, kind, status, config, last_error, last_sync_at")
    .order("created_at", { ascending: true })
    .returns<CrmConnectionRow[]>();

  const connections = new Map((rows ?? []).map((r) => [r.provider, r]));
  const connectors = listConnectors();
  const connectedCount = (rows ?? []).filter((r) => r.status === "active").length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">CRM &amp; integrations</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Send closed-won deals straight into the tools your team already uses. Connect once and
          every win flows through automatically.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>

      {connectedCount === 0 && (
        <Card className="border-foreground/15 bg-muted/40">
          <CardContent className="py-4">
            <p className="text-sm font-medium">No destination connected yet</p>
            <p className="text-sm text-muted-foreground">
              Closed deals are tracked in Vantera, but they&apos;ll stay here until you connect a
              CRM or notification tool below — connect one so your wins land where your team works.
            </p>
          </CardContent>
        </Card>
      )}

      {connectors.map((meta) => {
        const connection = connections.get(meta.provider);
        const status = connection?.status;
        const checked = connection ? lastChecked(connection.last_sync_at) : null;

        return (
          <Card key={meta.provider}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  {meta.label}
                  <Badge variant="secondary" className="font-normal capitalize">
                    {meta.kind === "crm" ? "CRM" : "Notify"}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{meta.blurb}</p>
              </div>
              {status && (
                <Badge variant={STATUS_VARIANTS[status]} className="shrink-0">
                  {STATUS_LABELS[status]}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {connection && (status === "active" || status === "error") ? (
                <div className="space-y-3">
                  {status === "error" && connection.last_error && (
                    <p className="text-sm text-destructive">{connection.last_error}</p>
                  )}
                  {checked && (
                    <p className="text-xs text-muted-foreground">Last checked {checked}</p>
                  )}
                  <ConnectionManager connection={connection} meta={meta} />
                </div>
              ) : status === "connecting" ? (
                <p className="text-sm text-muted-foreground">
                  Finish authorizing {meta.label} in the window that opened. This card updates once
                  it&apos;s connected.
                </p>
              ) : (
                <ConnectButton provider={meta.provider} label={meta.label} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

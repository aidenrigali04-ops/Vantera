"use client";

import { useActionState, useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import {
  connectDestination,
  disconnectDestination,
  saveActivitySync,
  saveConnectionConfig,
  toggleAutoPush,
  testConnection,
  type IntegrationActionState,
} from "./actions";
import type { ConnectorMeta } from "@vantera/crm-infra";

export interface CrmConnectionRow {
  id: string;
  provider: string;
  kind: "crm" | "notify";
  status: "connecting" | "active" | "error" | "disconnected";
  config: {
    autoPush?: boolean;
    target?: Record<string, string>;
    mapping?: Record<string, string>;
    activity?: {
      enabled?: boolean;
      events?: { outreach?: boolean; replies?: boolean; meetings?: boolean };
      watermark?: string;
    };
  };
  last_error: string | null;
  last_sync_at: string | null;
}

// ── Connect button (no connection yet) ─────────────────────────────────────────
export function ConnectButton({ provider, label }: { provider: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConnect() {
    startTransition(async () => {
      setError(null);
      const result = await connectDestination(provider);
      if (result.error) setError(result.error);
      else if (result.url) window.location.href = result.url;
      // stub success: server revalidates the path — the card re-renders as connected
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={isPending} size="sm">
        {isPending ? "Connecting…" : `Connect ${label}`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ── Auto-push toggle ────────────────────────────────────────────────────────────
function AutoPushToggle({ connection }: { connection: CrmConnectionRow }) {
  const [state, action, pending] = useActionState<IntegrationActionState, FormData>(
    toggleAutoPush,
    {}
  );
  const on = connection.config.autoPush ?? false;
  return (
    <form action={action} className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Push automatically on close</p>
        <p className="text-sm text-muted-foreground">
          When a deal is marked closed-won, send it here without a manual step.
        </p>
        {state.success && <p className="mt-1 text-xs text-muted-foreground">{state.success}</p>}
      </div>
      <input type="hidden" name="connectionId" value={connection.id} />
      <input type="hidden" name="autoPush" value={on ? "false" : "true"} />
      <Button type="submit" variant={on ? "default" : "outline"} size="sm" disabled={pending}>
        {pending ? "Saving…" : on ? "On" : "Off"}
      </Button>
    </form>
  );
}

// ── Target + field-mapping editor ────────────────────────────────────────────────
function ConfigForm({ connection, meta }: { connection: CrmConnectionRow; meta: ConnectorMeta }) {
  const [state, action, pending] = useActionState<IntegrationActionState, FormData>(
    saveConnectionConfig,
    {}
  );
  const target = connection.config.target ?? {};
  const mapping = connection.config.mapping ?? meta.defaultMapping;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="connectionId" value={connection.id} />
      <input type="hidden" name="provider" value={connection.provider} />
      <input type="hidden" name="autoPush" value={connection.config.autoPush ? "true" : "false"} />

      {/* Destination target (Slack channel / Monday board / CRM pipeline+stage) */}
      <div className="space-y-3">
        {meta.targets.map((t) => (
          <div key={t.key} className="space-y-1.5">
            <Label htmlFor={`${connection.id}-${t.key}`}>
              {t.label}
              {t.required && <span className="text-muted-foreground"> *</span>}
            </Label>
            <Input
              id={`${connection.id}-${t.key}`}
              name={`target.${t.key}`}
              defaultValue={target[t.key] ?? ""}
              placeholder={t.label}
            />
          </div>
        ))}
      </div>

      {/* Field mapping (CRM shape only) — smart defaults, light overrides */}
      {meta.fields.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Field mapping
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {meta.fields.map((f) => (
              <div key={f.source} className="space-y-1.5">
                <Label htmlFor={`${connection.id}-${f.source}`}>{f.label}</Label>
                <Input
                  id={`${connection.id}-${f.source}`}
                  name={`mapping.${f.source}`}
                  defaultValue={mapping[f.source] ?? f.defaultTarget}
                  disabled={f.locked}
                />
                {f.locked && (
                  <p className="text-xs text-muted-foreground">Used to match contacts — fixed.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state.success && <p className="text-sm text-muted-foreground">{state.success}</p>}
      </div>
      <FormError message={state.error} />
    </form>
  );
}

// ── Activity sync (timeline notes) ─────────────────────────────────────────────────
// Only rendered for destinations that support it (meta.supportsActivitySync — HubSpot
// today). Opt-in: touches sync from the moment it's enabled, never historically.
const ACTIVITY_EVENTS = [
  { key: "outreach", label: "Outreach sent" },
  { key: "replies", label: "Replies received" },
  { key: "meetings", label: "Meetings booked" },
] as const;

function ActivitySyncPanel({
  connection,
  meta,
}: {
  connection: CrmConnectionRow;
  meta: ConnectorMeta;
}) {
  const [state, action, pending] = useActionState<IntegrationActionState, FormData>(
    saveActivitySync,
    {}
  );
  const activity = connection.config.activity ?? {};
  const events = activity.events ?? {};

  return (
    <form action={action} className="space-y-4 border-t border-border pt-4">
      <input type="hidden" name="connectionId" value={connection.id} />
      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={activity.enabled === true}
            className="mt-0.5 size-4 accent-[var(--cyan)]"
          />
          <span>
            <span className="block text-sm font-medium">
              Log LinkedIn activity to the contact timeline
            </span>
            <span className="block text-sm text-muted-foreground">
              Touches appear as notes on the {meta.label} contact as they happen — the contact is
              created at the first synced touch, before the deal closes. Sync starts the moment you
              turn this on; history is never imported.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 pl-7">
        {ACTIVITY_EVENTS.map((e) => (
          <label key={e.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={`events.${e.key}`}
              defaultChecked={events[e.key] !== false}
              className="size-4 accent-[var(--cyan)]"
            />
            {e.label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 pl-7">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save activity sync"}
        </Button>
        {state.success && <p className="text-sm text-muted-foreground">{state.success}</p>}
      </div>
      <FormError message={state.error} />
      {activity.enabled && (
        <p className="pl-7 text-xs text-muted-foreground">
          Connected {meta.label} before activity sync existed? Reconnect once to grant the note
          permission if syncing reports an authorization error.
        </p>
      )}
    </form>
  );
}

// ── Test + Disconnect row ─────────────────────────────────────────────────────────
function ConnectionActions({ connection }: { connection: CrmConnectionRow }) {
  const [testState, testAction, testing] = useActionState<IntegrationActionState, FormData>(
    testConnection,
    {}
  );
  const [discState, discAction, disconnecting] = useActionState<IntegrationActionState, FormData>(
    disconnectDestination,
    {}
  );
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <form action={testAction}>
        <input type="hidden" name="connectionId" value={connection.id} />
        <Button type="submit" variant="outline" size="sm" disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
      </form>
      <form action={discAction}>
        <input type="hidden" name="connectionId" value={connection.id} />
        <Button type="submit" variant="ghost" size="sm" disabled={disconnecting}>
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </Button>
      </form>
      {testState.success && <p className="text-sm text-muted-foreground">{testState.success}</p>}
      {(testState.error || discState.error) && (
        <p className="text-sm text-destructive">{testState.error ?? discState.error}</p>
      )}
    </div>
  );
}

// ── The connected-destination manager (composed) ──────────────────────────────────
export function ConnectionManager({
  connection,
  meta,
}: {
  connection: CrmConnectionRow;
  meta: ConnectorMeta;
}) {
  return (
    <div className="space-y-5">
      <AutoPushToggle connection={connection} />
      <div className="border-t border-border pt-4">
        <ConfigForm connection={connection} meta={meta} />
      </div>
      {meta.supportsActivitySync && <ActivitySyncPanel connection={connection} meta={meta} />}
      <ConnectionActions connection={connection} />
    </div>
  );
}

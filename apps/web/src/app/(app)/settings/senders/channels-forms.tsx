"use client";

import { useActionState, useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/form-error";
import {
  toggleSendingPause,
  createLinkedInConnectLink,
  createLinkedInReconnectLink,
  removeLinkedInAccount,
  refreshLinkedInAccounts,
  type ChannelActionState,
} from "./actions";

// ── Pause all sending toggle ──────────────────────────────────────────────────

interface PauseSendingFormProps {
  outreachPaused: boolean;
}

export function PauseSendingForm({ outreachPaused }: PauseSendingFormProps) {
  const [state, action, pending] = useActionState<ChannelActionState, FormData>(
    toggleSendingPause,
    {}
  );

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Stops every outbound LinkedIn action for this workspace until resumed.
      </p>
      <p className="text-sm">
        Status:{" "}
        <span className={outreachPaused ? "font-medium text-amber-600" : "font-medium text-[var(--positive)]"}>
          {outreachPaused ? "Paused" : "Active"}
        </span>
      </p>
      <input type="hidden" name="paused" value={outreachPaused ? "false" : "true"} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant={outreachPaused ? "default" : "outline"} disabled={pending}>
          {pending
            ? "Updating…"
            : outreachPaused
            ? "Resume all sending"
            : "Pause all sending"}
        </Button>
        {state.success && (
          <p className="text-sm text-muted-foreground">{state.success}</p>
        )}
      </div>
      <FormError message={state.error} />
    </form>
  );
}

// ── LinkedIn connect button ───────────────────────────────────────────────────

export function LinkedInConnectButton({
  label = "Connect your LinkedIn account",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const [isPending, startTransition] = useTransition();
  const [connectError, setConnectError] = useState<string | null>(null);

  function handleConnect() {
    startTransition(async () => {
      setConnectError(null);
      const result = await createLinkedInConnectLink();
      if (result.error) {
        setConnectError(result.error);
      } else if (result.url) {
        // Same-tab redirect: the user signs in on LinkedIn's hosted page and is
        // returned to /settings/senders?connected=… (no stale second tab).
        window.location.assign(result.url);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={isPending} variant={variant}>
        {isPending ? "Preparing…" : label}
      </Button>
      {connectError && <p className="text-sm text-destructive">{connectError}</p>}
    </div>
  );
}

// ── LinkedIn refresh / sync status ────────────────────────────────────────────

/**
 * Re-syncs connected LinkedIn accounts from the provider into the workspace.
 * A backstop for a missed connection webhook — reloads the page on success so a
 * newly-recorded account renders. `inline` renders a link-style button for use
 * inside a sentence; otherwise a ghost button to sit beside the connect action.
 */
export function RefreshLinkedInButton({ inline = false }: { inline?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleRefresh() {
    startTransition(async () => {
      setMessage(null);
      const result = await refreshLinkedInAccounts();
      if (result.error) {
        setMessage(result.error);
      } else if (result.synced && result.synced > 0) {
        window.location.reload();
      } else {
        setMessage("No connected account found yet — finish signing in on LinkedIn, then refresh.");
      }
    });
  }

  if (inline) {
    return (
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="underline underline-offset-2 disabled:opacity-60"
      >
        {isPending ? "Refreshing…" : "Refresh status"}
        {message && <span className="ml-2 not-italic text-destructive">{message}</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleRefresh} disabled={isPending} variant="ghost">
        {isPending ? "Refreshing…" : "Refresh status"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

// ── LinkedIn reconnect (same seat) ────────────────────────────────────────────

/**
 * Re-authenticates an EXISTING connection in place — same provider seat, same row,
 * lead assignments survive. Never use the plain connect button for an expired
 * session: that mints a duplicate billable seat for the same person.
 */
export function LinkedInReconnectButton({ rowId }: { rowId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleReconnect() {
    startTransition(async () => {
      setError(null);
      const result = await createLinkedInReconnectLink(rowId);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        window.location.assign(result.url);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button onClick={handleReconnect} disabled={isPending} variant="outline" size="sm">
        {isPending ? "Preparing…" : "Reconnect"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}

// ── LinkedIn remove ───────────────────────────────────────────────────────────

/** Fully removes a connected account: provider seat released + row deleted.
 *  R2: the shared ConfirmDialog replaces the native window.confirm — one confirmation idiom. */
export function RemoveLinkedInButton({ rowId, name }: { rowId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    startTransition(async () => {
      setError(null);
      const result = await removeLinkedInAccount(rowId);
      if (result.error) {
        setError(result.error);
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <ConfirmDialog
        title={`Remove ${name}?`}
        description="Outreach from this account stops immediately and its seat is freed. Prospect history is kept; prospects it was messaging will pause until another account is connected."
        confirmLabel="Remove account"
        destructive
        onConfirm={handleRemove}
        trigger={(open) => (
          <Button onClick={open} disabled={isPending} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            {isPending ? "Removing…" : "Remove"}
          </Button>
        )}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setLeadEventEmails, setLifecycleEmails, setWeeklySummary, type SettingsState } from "./actions";

/**
 * The Monday recap toggle — same one-boolean form idiom as the integrations
 * auto-push toggle: hidden inverse value, the button flips it.
 */
export function WeeklySummaryToggle({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setWeeklySummary, {});
  return (
    <form action={action} className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Weekly summary email</p>
        <p className="text-sm text-muted-foreground">
          Every Monday: what your agents did — outreach, replies, meetings booked, and pipeline
          value — sent to workspace owners and admins. Quiet weeks send a short note; dead weeks
          send nothing.
        </p>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Button type="submit" variant={enabled ? "default" : "outline"} size="sm" disabled={pending}>
        {pending ? "Saving…" : enabled ? "On" : "Off"}
      </Button>
    </form>
  );
}

/** R5: account-lifecycle emails — the trial-ending heads-up and payment-failure notices. */
export function LifecycleEmailsToggle({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setLifecycleEmails, {});
  return (
    <form action={action} className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Account lifecycle emails</p>
        <p className="text-sm text-muted-foreground">
          A heads-up two days before your trial ends, and a notice if a payment fails and
          outreach pauses. Sent to workspace owners and admins — one email per event, never a drip.
        </p>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Button type="submit" variant={enabled ? "default" : "outline"} size="sm" disabled={pending}>
        {pending ? "Saving…" : enabled ? "On" : "Off"}
      </Button>
    </form>
  );
}

/** L3: the moment-of-value emails — a warm reply, a booked meeting, a thread that needs you. */
export function LeadEventEmailsToggle({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setLeadEventEmails, {});
  return (
    <form action={action} className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Prospect event emails</p>
        <p className="text-sm text-muted-foreground">
          The moments worth interrupting you for: an interested reply, a booked meeting, or a
          thread Vera hands over. Sent to workspace owners and admins as they happen.
        </p>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Button type="submit" variant={enabled ? "default" : "outline"} size="sm" disabled={pending}>
        {pending ? "Saving…" : enabled ? "On" : "Off"}
      </Button>
    </form>
  );
}

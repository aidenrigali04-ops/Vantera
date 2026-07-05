"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setWeeklySummary, type SettingsState } from "./actions";

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

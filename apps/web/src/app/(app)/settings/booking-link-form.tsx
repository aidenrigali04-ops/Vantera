"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateBookingLink, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

/**
 * R6: the booking link, in Settings where people look for it. One source of truth —
 * the Outreach agent's config — so the wizard, drafts, and this card can never disagree.
 */
export function BookingLinkForm({
  bookingUrl,
  hasAgent,
}: {
  bookingUrl: string;
  hasAgent: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateBookingLink, {});

  if (!hasAgent) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          The booking link rides with your Outreach agent — deploy it first, then set the link
          Vera offers the moment a prospect wants to talk.
        </p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/playbook">Go to Playbook</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="bookingUrl">Booking link</Label>
        <Input
          id="bookingUrl"
          name="bookingUrl"
          type="url"
          inputMode="url"
          defaultValue={bookingUrl}
          placeholder="https://cal.com/you/intro"
        />
        <p className="text-xs text-muted-foreground">
          Offered only once a prospect shows interest in talking — it&apos;s how conversations
          become meetings. Saved straight into your Outreach agent.
        </p>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save booking link"}
        </Button>
        {state.saved && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </form>
  );
}

"use client";

import { useActionState, useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import {
  saveSenderAddress,
  toggleSendingPause,
  provisionEmailSending,
  createLinkedInConnectLink,
  type ChannelActionState,
} from "./actions";

// ── Sender address form ───────────────────────────────────────────────────────

interface SenderAddressFormProps {
  defaultValues: {
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
}

export function SenderAddressForm({ defaultValues }: SenderAddressFormProps) {
  const [state, action, pending] = useActionState<ChannelActionState, FormData>(
    saveSenderAddress,
    {}
  );

  return (
    <form action={action} className="space-y-3" data-copilot="channels-setup">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="line1">Street address</Label>
          <Input
            id="line1"
            name="line1"
            defaultValue={defaultValues.line1}
            placeholder="100 Main St"
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="line2">Apartment / suite (optional)</Label>
          <Input
            id="line2"
            name="line2"
            defaultValue={defaultValues.line2}
            placeholder="Suite 200"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={defaultValues.city}
            placeholder="Austin"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="region">State / region (optional)</Label>
          <Input
            id="region"
            name="region"
            defaultValue={defaultValues.region}
            placeholder="TX"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="postal">ZIP / postal code</Label>
          <Input
            id="postal"
            name="postal"
            defaultValue={defaultValues.postal}
            placeholder="78701"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            name="country"
            defaultValue={defaultValues.country}
            placeholder="USA"
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
        </Button>
        {state.success && (
          <p className="text-sm text-muted-foreground">{state.success}</p>
        )}
      </div>
      <FormError message={state.error} />
    </form>
  );
}

// ── Email provisioning form ───────────────────────────────────────────────────

export function ProvisionEmailForm() {
  const [state, action, pending] = useActionState<ChannelActionState, FormData>(
    provisionEmailSending,
    {}
  );

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        We&apos;ll provision dedicated sending domains and mailboxes for your workspace. New mailboxes
        spend a few weeks warming up before they&apos;re ready to send.
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="domainCount">Sending domains (1–2)</Label>
          <Input
            id="domainCount"
            name="domainCount"
            type="number"
            min={1}
            max={2}
            defaultValue={1}
            className="w-24"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mailboxesPerDomain">Mailboxes per domain (1–3)</Label>
          <Input
            id="mailboxesPerDomain"
            name="mailboxesPerDomain"
            type="number"
            min={1}
            max={3}
            defaultValue={1}
            className="w-24"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Setting up…" : "Set up email sending"}
        </Button>
        {state.success && (
          <p className="text-sm text-muted-foreground">{state.success}</p>
        )}
      </div>
      <FormError message={state.error} />
    </form>
  );
}

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
        Stops every outbound email and LinkedIn action for this workspace until resumed.
      </p>
      <p className="text-sm">
        Status:{" "}
        <span className={outreachPaused ? "font-medium text-amber-600" : "font-medium text-green-600"}>
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

export function LinkedInConnectButton({ label = "Connect LinkedIn account" }: { label?: string }) {
  const [isPending, startTransition] = useTransition();
  const [connectError, setConnectError] = useState<string | null>(null);

  function handleConnect() {
    startTransition(async () => {
      setConnectError(null);
      const result = await createLinkedInConnectLink();
      if (result.error) {
        setConnectError(result.error);
      } else if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={isPending} variant="outline">
        {isPending ? "Preparing…" : label}
      </Button>
      {connectError && <p className="text-sm text-destructive">{connectError}</p>}
    </div>
  );
}

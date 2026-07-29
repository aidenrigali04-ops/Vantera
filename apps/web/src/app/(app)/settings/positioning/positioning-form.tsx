"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { updatePositioning, type PositioningState } from "./actions";

export function PositioningForm({
  initial,
}: {
  initial: { valueProp: string; brandVoice: string; guardrails: string };
}) {
  const [state, action, pending] = useActionState<PositioningState, FormData>(updatePositioning, {});

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="valueProp">Value proposition</Label>
        <Textarea
          id="valueProp"
          name="valueProp"
          rows={3}
          defaultValue={initial.valueProp}
          placeholder="In your own words: what you do, for whom, and why it's worth their time."
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          How your agent describes what you do in a conversation. If you leave it blank, we use what
          we read from your website.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brandVoice">Brand voice</Label>
        <Input
          id="brandVoice"
          name="brandVoice"
          defaultValue={initial.brandVoice}
          placeholder="e.g. warm, direct, hospitality-insider"
        />
        <p className="text-xs text-muted-foreground">The tone your messages should match.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="guardrails">Guardrails</Label>
        <Textarea
          id="guardrails"
          name="guardrails"
          rows={3}
          defaultValue={initial.guardrails}
          placeholder={"Things your agent must never say. One per line.\ne.g. Never claim we're SOC 2 certified."}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Hard limits your agent will never cross, in any message.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save positioning"}
        </Button>
        <FormError message={state.error} />
        {state.saved && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </form>
  );
}

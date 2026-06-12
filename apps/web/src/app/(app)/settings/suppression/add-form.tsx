"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { addSuppressionEntry, type SuppressionActionState } from "./actions";

export function AddSuppressionForm() {
  const [state, action, pending] = useActionState<SuppressionActionState, FormData>(
    addSuppressionEntry,
    {}
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="kind">Channel</Label>
        <select
          id="kind"
          name="kind"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="email"
        >
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </div>
      <div className="min-w-64 flex-1 space-y-1">
        <Label htmlFor="value">Email address or LinkedIn URL</Label>
        <Input id="value" name="value" placeholder="jane@acme.com" required />
      </div>
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="Asked us to stop" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Suppress"}
      </Button>
      <div className="w-full">
        <FormError message={state.error} />
        {state.added && (
          <p className="text-sm text-muted-foreground">
            {state.added} is suppressed — no agent will ever contact them.
          </p>
        )}
      </div>
    </form>
  );
}

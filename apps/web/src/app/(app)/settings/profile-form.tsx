"use client";

import { useActionState } from "react";
import { updateProfile, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

export function ProfileForm({ displayName, email }: { displayName: string; email: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Email</Label>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" name="displayName" defaultValue={displayName} required />
        <p className="text-xs text-muted-foreground">Visible to your team.</p>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {state.saved && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </form>
  );
}

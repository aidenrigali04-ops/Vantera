"use client";

import { useActionState, useState } from "react";
import { changeEmail, changePassword, updateProfile, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
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

/**
 * R6: change the sign-in email without leaving the app. Confirmation links go to BOTH the
 * current and the new address — the switch completes only after both are clicked.
 */
export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changeEmail, {});
  const [editing, setEditing] = useState(false);

  if (!editing && !state.saved) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Change email
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="newEmail">New email</Label>
        <Input id="newEmail" name="newEmail" type="email" required placeholder={email} />
        <p className="text-xs text-muted-foreground">
          We&apos;ll send confirmation links to your current and new address — click both to
          finish the switch. You stay signed in either way.
        </p>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Sending…" : "Send confirmation"}
        </Button>
        {!state.saved && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
        {state.saved && (
          <span className="text-sm text-muted-foreground">
            Sent — check both inboxes to confirm.
          </span>
        )}
      </div>
    </form>
  );
}

/** P1: change password without leaving the app (was forgot-password-email only). */
export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirm</Label>
          <Input id="confirm" name="confirm" type="password" minLength={8} required />
        </div>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
        {state.saved && <span className="text-sm text-muted-foreground">Password changed</span>}
      </div>
    </form>
  );
}

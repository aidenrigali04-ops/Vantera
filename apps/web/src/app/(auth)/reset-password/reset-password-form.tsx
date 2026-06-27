"use client";

import { useActionState } from "react";
import { resetPassword, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AuthHeading, FIELD, SubmitButton } from "../auth-ui";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, {});
  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title="Choose a new password" sub="Set a new password for your account." />
      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-[13px] font-medium text-[var(--ink-2)]">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} className={FIELD} required />
          <p className="text-[12px] text-[var(--ink-4)]">At least 8 characters.</p>
        </div>
        <FormError message={state.error} />
        <SubmitButton pending={pending} idle="Save new password" busy="Saving…" className="mt-1" />
      </form>
    </div>
  );
}

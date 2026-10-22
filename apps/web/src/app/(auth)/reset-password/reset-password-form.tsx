"use client";

import { useActionState } from "react";
import { resetPassword, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import {
  AuthHeading,
  CtaArrow,
  FIELD,
  FIELD_STACK,
  HINT,
  LABEL,
  Rise,
  SubmitButton,
} from "../auth-ui";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, {});
  return (
    <div>
      <AuthHeading
        title="Choose a new"
        accent="password"
        sub="Set a new password for your account, then you're straight back in."
      />
      <Rise delay={0.12}>
        <form action={action} className="mt-8 space-y-4">
          <div className={FIELD_STACK}>
            <Label htmlFor="password" className={LABEL}>
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Create a password"
              className={FIELD}
              required
            />
            <p className={HINT}>At least 8 characters.</p>
          </div>
          <FormError message={state.error} />
          <SubmitButton
            pending={pending}
            idle={
              <>
                Save new password <CtaArrow />
              </>
            }
            busy="Saving…"
            className="mt-2"
          />
        </form>
      </Rise>
    </div>
  );
}

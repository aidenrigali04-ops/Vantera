"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AuthHeading, FIELD, SubmitButton } from "../auth-ui";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-foreground">Check your email</h1>
        <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
          If an account exists for that email, a reset link is on its way.
        </p>
        <p className="text-[14px]">
          <Link className="font-semibold text-[var(--cyan-strong)] hover:underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title="Reset your password" sub="We'll email you a link to set a new one." />
      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-[var(--ink-2)]">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className={FIELD} required />
        </div>
        <FormError message={state.error} />
        <SubmitButton pending={pending} idle="Send reset link" busy="Sending…" className="mt-1" />
      </form>
      <p className="text-center text-[14px] text-[var(--ink-3)]">
        <Link className="transition-colors hover:text-foreground" href="/login">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

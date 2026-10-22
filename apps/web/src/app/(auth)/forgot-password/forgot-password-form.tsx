"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import {
  AuthHeading,
  CtaArrow,
  FIELD,
  FIELD_STACK,
  LABEL,
  Rise,
  SubmitButton,
  TEXT_LINK,
} from "../auth-ui";

function BackToSignIn({ delay }: { delay: number }) {
  return (
    <Rise delay={delay}>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className={`${TEXT_LINK} inline-flex items-center gap-1.5`}>
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </Rise>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div>
        <AuthHeading
          title="Check your"
          accent="email"
          sub="If an account exists for that email, a reset link is on its way."
        />
        <BackToSignIn delay={0.12} />
      </div>
    );
  }

  return (
    <div>
      <AuthHeading
        title="Reset your"
        accent="password"
        sub="Enter your email and we'll send you a link to set a new one."
      />
      <Rise delay={0.12}>
        <form action={action} className="mt-8 space-y-4">
          <div className={FIELD_STACK}>
            <Label htmlFor="email" className={LABEL}>
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={FIELD}
              required
            />
          </div>
          <FormError message={state.error} />
          <SubmitButton
            pending={pending}
            idle={
              <>
                Send reset link <CtaArrow />
              </>
            }
            busy="Sending…"
            className="mt-2"
          />
        </form>
      </Rise>
      <BackToSignIn delay={0.18} />
    </div>
  );
}

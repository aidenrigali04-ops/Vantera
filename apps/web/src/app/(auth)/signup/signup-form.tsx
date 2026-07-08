"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AuthHeading, CtaArrow, FIELD, LinkedInMark, SubmitButton } from "../auth-ui";

export function SignupForm() {
  // No confirmation-email interstitial: signup signs the user in and redirects
  // straight to onboarding (see the signup action).
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title={
          <>
            Turn{" "}
            <span className="whitespace-nowrap">
              <LinkedInMark className="mr-[0.18em] inline-block size-[0.78em] align-[-0.1em]" />
              LinkedIn
            </span>{" "}
            intent into booked revenue.
          </>
        }
        sub="Vantera finds in-market buyers, qualifies them against your ICP, and drafts the outreach for your approval — your LinkedIn, run hands-off."
      />

      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName" className="text-[13px] font-medium text-[var(--ink-2)]">Company name</Label>
          <Input id="companyName" name="companyName" autoComplete="organization" placeholder="Acme Inc" className={FIELD} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-[var(--ink-2)]">Business email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className={FIELD} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-[13px] font-medium text-[var(--ink-2)]">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Create a password" className={FIELD} required />
          <p className="text-[12px] text-[var(--ink-4)]">At least 8 characters.</p>
        </div>
        <FormError message={state.error} />
        <SubmitButton pending={pending} idle={<>Create account <CtaArrow /></>} busy="Creating account…" className="mt-1" />
      </form>

      <p className="text-[12px] leading-relaxed text-[var(--ink-4)]">
        By creating an account you agree to our{" "}
        <Link href="#" className="font-medium text-[var(--ink-3)] underline-offset-2 hover:text-foreground hover:underline">Terms of Service</Link>{" "}
        and{" "}
        <Link href="#" className="font-medium text-[var(--ink-3)] underline-offset-2 hover:text-foreground hover:underline">Privacy Policy</Link>.
      </p>

      <p className="text-[14px] text-[var(--ink-3)]">
        Already have an account?{" "}
        <Link className="font-semibold text-[var(--cyan-strong)] hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}

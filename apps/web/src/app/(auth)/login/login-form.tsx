"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AuthHeading, CtaArrow, FIELD, SubmitButton } from "../auth-ui";

export function LoginForm({ linkExpired, next }: { linkExpired: boolean; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title="Welcome back to your pipeline."
        sub="Sign in to Vantera and pick your LinkedIn outreach up right where you left it."
      />

      <form action={action} className="flex flex-col gap-5">
        {/* R3: deep-link continuation (validated server-side) — invite links survive login. */}
        {next && <input type="hidden" name="next" value={next} />}
        {linkExpired && (
          <FormError message="That link expired or was already used. Sign in or request a new one." />
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-[var(--ink-2)]">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className={FIELD} required />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[13px] font-medium text-[var(--ink-2)]">Password</Label>
            <Link
              href="/forgot-password"
              className="text-[12.5px] text-[var(--ink-3)] transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" className={FIELD} required />
        </div>
        <FormError message={state.error} />
        <SubmitButton pending={pending} idle={<>Sign in <CtaArrow /></>} busy="Signing in…" className="mt-1" />
      </form>

      <p className="text-[14px] text-[var(--ink-3)]">
        New to Vantera?{" "}
        <Link className="font-semibold text-[var(--cyan-strong)] hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </div>
  );
}

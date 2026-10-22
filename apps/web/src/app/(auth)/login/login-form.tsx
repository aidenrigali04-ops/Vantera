"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import {
  AuthDivider,
  AuthHeading,
  CtaArrow,
  FIELD,
  FIELD_STACK,
  LABEL,
  Rise,
  SubmitButton,
  TEXT_LINK,
} from "../auth-ui";
import { GoogleAuthForm } from "../google-auth-form";

export function LoginForm({
  linkExpired,
  next,
  queryError,
}: {
  linkExpired: boolean;
  next?: string;
  queryError?: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  return (
    <div>
      <AuthHeading
        title="Welcome"
        accent="back"
        sub="Sign in to see who replied and what your agents booked."
      />

      {(linkExpired || queryError) && (
        <div className="mt-6 space-y-2">
          {linkExpired && (
            <FormError message="That link expired or was already used. Sign in or request a new one." />
          )}
          {queryError && <FormError message={queryError} />}
        </div>
      )}

      <Rise delay={0.1}>
        <div className="mt-8">
          <GoogleAuthForm next={next} />
          <div className="my-6">
            <AuthDivider />
          </div>
        </div>
      </Rise>

      <Rise delay={0.12}>
        <form action={action} className="space-y-4">
          {/* R3: deep-link continuation (validated server-side) — invite links survive login. */}
          {next && <input type="hidden" name="next" value={next} />}
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
          <div className={FIELD_STACK}>
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className={LABEL}>
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-[0.8rem] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              className={FIELD}
              required
            />
          </div>
          <FormError message={state.error} />
          <SubmitButton
            pending={pending}
            idle={
              <>
                Sign in <CtaArrow />
              </>
            }
            busy="Signing in…"
            className="mt-2"
          />
        </form>
      </Rise>

      <Rise delay={0.18}>
        <p className="mt-6 text-center text-sm text-[var(--ink-3)]">
          New to Vantera?{" "}
          <Link className={TEXT_LINK} href="/signup">
            Create an account
          </Link>
        </p>
      </Rise>
    </div>
  );
}

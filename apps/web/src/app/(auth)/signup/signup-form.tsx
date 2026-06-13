"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthFormState } from "../actions";
import { GlassEffect } from "@/components/ui/liquid-glass";
import { AnimatedPanelBorder } from "@/components/ui/animated-border";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

const inputClass =
  "border-white/15 bg-white/5 backdrop-blur-sm placeholder:text-muted-foreground focus-visible:border-white/40";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});

  if (state.sent) {
    return (
      <div className="relative w-full rounded-3xl">
        <GlassEffect className="w-full rounded-3xl">
          <div className="flex flex-col gap-4 p-8">
            <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to your inbox. Click it to continue setting up
              your workspace.
            </p>
            <p className="text-sm text-muted-foreground">
              Already confirmed?{" "}
              <Link className="text-foreground hover:underline" href="/login">
                Sign in
              </Link>
            </p>
          </div>
        </GlassEffect>
        <AnimatedPanelBorder />
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-3xl">
      <GlassEffect className="w-full rounded-3xl">
        <div className="flex flex-col gap-6 p-8">
          <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="companyName">Name</Label>
              <Input
                id="companyName"
                name="companyName"
                autoComplete="organization"
                placeholder="Acme Inc"
                className={inputClass}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                className={inputClass}
                required
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <FormError message={state.error} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-[18px] bg-foreground px-6 py-2.5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Creating account…" : "Create account"}
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link className="text-foreground hover:underline" href="/login">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </GlassEffect>
      <AnimatedPanelBorder />
    </div>
  );
}

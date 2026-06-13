"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";
import { GlassEffect } from "@/components/ui/liquid-glass";
import { AnimatedPanelBorder } from "@/components/ui/animated-border";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

const inputClass =
  "border-white/15 bg-white/[0.06] backdrop-blur-sm placeholder:text-muted-foreground focus-visible:border-white/40";

export function LoginForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  return (
    <div className="relative w-full rounded-3xl">
      <GlassEffect className="w-full rounded-3xl">
        <div className="flex flex-col gap-6 p-8">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <form action={action} className="flex flex-col gap-4">
            {linkExpired && (
              <FormError message="That link expired or was already used. Sign in or request a new one." />
            )}
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
                autoComplete="current-password"
                className={inputClass}
                required
              />
            </div>
            <FormError message={state.error} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-[18px] bg-foreground px-6 py-2.5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex justify-between text-sm text-muted-foreground">
              <Link className="hover:underline" href="/forgot-password">
                Forgot password?
              </Link>
              <Link className="hover:underline" href="/signup">
                Create account
              </Link>
            </div>
          </form>
        </div>
      </GlassEffect>
      <AnimatedPanelBorder />
    </div>
  );
}

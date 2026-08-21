"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { signup, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AuthHeading, CtaArrow, FIELD, SubmitButton } from "../auth-ui";

export function SignupForm({ site }: { site?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(48,207,255,0.2)]">
          <Mail className="size-5" strokeWidth={1.9} />
        </span>
        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-foreground">Check your email</h1>
        <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
          We sent a confirmation link to your inbox. Click it to continue setting up your workspace.
        </p>
        <p className="text-[14px] text-[var(--ink-3)]">
          Already confirmed?{" "}
          <Link className="font-semibold text-[var(--cyan-strong)] hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title="Create your account"
        sub="Free 3-day trial. Your agents start finding in-market buyers the moment you're in — and you approve every send."
      />

      <form action={action} className="flex flex-col gap-5">
        {site && <input type="hidden" name="site" value={site} />}
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

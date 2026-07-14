"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { signup, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { AuthHeading, CtaArrow, FIELD, LinkedInMark, SubmitButton } from "../auth-ui";

export function SignupForm({ initialSite }: { initialSite?: string }) {
  // No confirmation-email interstitial: signup signs the user in and redirects
  // straight to onboarding (see the signup action).
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});

  // The URL a visitor typed on the landing page is carried here so the promise
  // ("start with your site — we'll map your ICP") is kept: we show it back, submit
  // it, and onboarding pre-fills + scans it. Derive a clean host for display.
  const site = initialSite?.trim() ?? "";
  const siteHost = (() => {
    if (!site) return "";
    try {
      return new URL(site.includes("://") ? site : `https://${site}`).host;
    } catch {
      return site;
    }
  })();

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading
        title={
          <>
            Start with{" "}
            <span className="whitespace-nowrap">
              <LinkedInMark className="mr-[0.18em] inline-block size-[0.78em] align-[-0.1em]" />
              LinkedIn
            </span>{" "}
            outreach that already knows what works.
          </>
        }
        sub="Vera finds your in-market buyers and reaches them with proven plays — drafted for your approval, sharper every week, your LinkedIn run hands-off."
      />

      {siteHost && (
        <div className="-mt-3 flex items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] px-4 py-3 text-[13px] leading-snug text-[var(--ink-2)]">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--cyan-strong)]" aria-hidden />
          <span>
            Next, we&rsquo;ll scan{" "}
            <span className="font-semibold text-foreground">{siteHost}</span> to map your ICP and
            show you what already works for buyers like yours — automatically.
          </span>
        </div>
      )}

      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="site" value={site} />
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
        <Link href="/terms" className="font-medium text-[var(--ink-3)] underline-offset-2 hover:text-foreground hover:underline">Terms of Service</Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-[var(--ink-3)] underline-offset-2 hover:text-foreground hover:underline">Privacy Policy</Link>.
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

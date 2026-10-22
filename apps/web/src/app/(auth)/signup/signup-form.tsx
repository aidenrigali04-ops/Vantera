"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { useActionState } from "react";
import { signup, type AuthFormState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { ONBOARDING_MINUTES } from "@/components/landing/claims";
import {
  AuthDivider,
  AuthHeading,
  CtaArrow,
  FIELD,
  FIELD_STACK,
  HINT,
  LABEL,
  Rise,
  SubmitButton,
  TEXT_LINK,
} from "../auth-ui";
import { GoogleAuthForm } from "../google-auth-form";

export function SignupForm({
  initialSite,
  invite,
  inviteDead = false,
  queryError,
}: {
  /** The URL a visitor typed on the landing page (`?site=`) — carried into onboarding. */
  initialSite?: string;
  /** R3: signup through a team invite — join the inviting workspace, no company field */
  invite?: { token: string; email: string; workspaceName: string };
  /** the URL carried an invite token that is expired/used/unknown */
  inviteDead?: boolean;
  queryError?: string;
}) {
  // No confirmation-email interstitial: signup signs the user in and redirects
  // straight to onboarding (see the signup action).
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});

  // Shown back so the landing promise ("we'll read your site") visibly carries over;
  // onboarding pre-fills and scans it. Derive a clean host for display.
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
    <div>
      {invite ? (
        <AuthHeading
          title={<>Join {invite.workspaceName}</>}
          accent="on Vantera"
          sub="Create your account and you'll land inside your team's workspace — their pipeline, prospects, and agents, shared with you."
        />
      ) : (
        <AuthHeading
          title="Turn LinkedIn into"
          accent="pipeline on autopilot"
          sub={`Paste your website and connect LinkedIn. Your agents start finding in-market buyers in about ${ONBOARDING_MINUTES} minutes.`}
        />
      )}

      {inviteDead && (
        <Rise delay={0.1}>
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-[0.82rem] leading-snug text-amber-800">
            That invite link is no longer valid — ask your teammate to send a fresh one. You can
            still create your own workspace below.
          </div>
        </Rise>
      )}

      {queryError && (
        <div className="mt-6">
          <FormError message={queryError} />
        </div>
      )}

      {siteHost && !invite && (
        <Rise delay={0.1}>
          <p className="mt-6 inline-flex max-w-full items-center gap-2 rounded-lg border border-[rgba(12,16,26,0.08)] bg-white px-2.5 py-1.5 text-[0.8rem] text-[var(--ink-2)] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <Globe className="size-3.5 shrink-0 text-[var(--fb)]" aria-hidden />
            <span className="truncate">
              Next, we&rsquo;ll read <span className="font-semibold text-foreground">{siteHost}</span>{" "}
              to learn what you sell
            </span>
          </p>
        </Rise>
      )}

      <Rise delay={0.11}>
        <div className="mt-8">
          <GoogleAuthForm site={site || undefined} inviteToken={invite?.token} />
          {invite && (
            <p className={`mt-2 ${HINT}`}>
              Continue with Google using {invite.email} — the invite is bound to that address.
            </p>
          )}
          <div className="my-6">
            <AuthDivider />
          </div>
        </div>
      </Rise>

      <Rise delay={0.12}>
        <form action={action} className="space-y-4">
          {site && <input type="hidden" name="site" value={site} />}
          {invite && <input type="hidden" name="inviteToken" value={invite.token} />}
          {!invite && (
            <div className={FIELD_STACK}>
              <Label htmlFor="companyName" className={LABEL}>
                Brand name
              </Label>
              <Input
                id="companyName"
                name="companyName"
                autoComplete="organization"
                placeholder="Acme Inc"
                className={FIELD}
                required
              />
            </div>
          )}
          <div className={FIELD_STACK}>
            <Label htmlFor="email" className={LABEL}>
              {invite ? "Email" : "Business email"}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={FIELD}
              required
              defaultValue={invite?.email}
              readOnly={Boolean(invite)}
            />
            {invite && (
              <p className={HINT}>The invite was sent to this address — it&apos;s your sign-in email.</p>
            )}
          </div>
          <div className={FIELD_STACK}>
            <Label htmlFor="password" className={LABEL}>
              Password
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
                Create account <CtaArrow />
              </>
            }
            busy="Creating account…"
            className="mt-2"
          />
        </form>
      </Rise>

      <Rise delay={0.16}>
        <p className="mt-4 text-center text-[0.78rem] leading-relaxed text-[var(--ink-3)]">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="font-medium text-foreground underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-foreground underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Rise>

      <Rise delay={0.2}>
        <p className="mt-6 text-center text-sm text-[var(--ink-3)]">
          Already have an account?{" "}
          <Link className={TEXT_LINK} href="/login">
            Sign in
          </Link>
        </p>
      </Rise>
    </div>
  );
}

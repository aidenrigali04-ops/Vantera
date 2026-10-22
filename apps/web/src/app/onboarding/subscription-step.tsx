"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import type { PlanTier } from "@vantera/billing";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/form-error";
import { PRIMARY_BUTTON } from "@/components/landing/frame";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { startCheckout } from "@/app/(app)/settings/billing/actions";
import { finishOnboardingForm } from "./actions";

export interface OnboardingPlan {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyUsd: number;
  annualMonthlyUsd: number;
  annualYearlyUsd: number;
  highlight: boolean;
  features: string[];
}

type Interval = "month" | "year";

const CONFIRM_POLL_MS = 2000;
const CONFIRM_GIVE_UP_MS = 45_000;

/**
 * Step 3 · Subscription — card required, trial after. Picks a plan and hands off to
 * Checkout; on return (`?checkout=success`) the page re-renders in `confirming` mode and
 * refreshes until the webhook has attached the subscription, at which point the server
 * finishes provisioning and leaves for the dashboard.
 *
 * Set like the landing's highlighted pricing card (components/landing/pricing.tsx): a
 * blue "N days free" strip over the plan's name, a big price, the checkout button with
 * its reassurance line, then what the plan includes. With more than one plan on sale,
 * a radio list above the card picks which one it shows.
 */
export function SubscriptionStep({
  plans,
  trialDays,
  confirming,
  canceled,
  checkoutError,
  finishFailed,
  devBypass,
}: {
  plans: OnboardingPlan[];
  trialDays: number;
  confirming: boolean;
  canceled: boolean;
  /** Checkout could not be opened (provider misconfigured or unreachable). */
  checkoutError: boolean;
  finishFailed: boolean;
  /** Dev-only: billing isn't configured here, so Checkout cannot open at all. */
  devBypass: boolean;
}) {
  const [interval, setInterval_] = useState<Interval>("month");
  const [selected, setSelected] = useState<PlanTier>(plans.find((p) => p.highlight)?.tier ?? plans[0]!.tier);

  if (confirming) return <Confirming />;

  const plan = plans.find((p) => p.tier === selected) ?? plans[0]!;
  const price = interval === "year" ? plan.annualMonthlyUsd : plan.monthlyUsd;
  // Vantera runs on autopilot: per-message approval is not part of the offer, so an
  // approval-centric line in the billing copy stays off this card (the billing package
  // itself is untouched — the same filter as the landing's pricing card).
  const features = plan.features.filter((f) => !/approv/i.test(f));

  return (
    <div className="flex flex-col">
      <IntervalToggle interval={interval} onChange={setInterval_} />

      {plans.length > 1 && (
        <div role="radiogroup" aria-label="Plan" className="mt-5 flex flex-col gap-2.5">
          {plans.map((p) => {
            const on = p.tier === selected;
            const perMonth = interval === "year" ? p.annualMonthlyUsd : p.monthlyUsd;
            return (
              <button
                key={p.tier}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelected(p.tier)}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-xl border bg-white px-4 py-3.5 text-left transition-[border-color,box-shadow] duration-200",
                  on
                    ? "border-[var(--fb-strong)] shadow-[0_0_0_4px_var(--fb-tint)]"
                    : "border-[rgba(12,16,26,0.1)] hover:border-[rgba(12,16,26,0.2)]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                    on ? "border-[var(--fb-strong)] bg-[var(--fb-strong)]" : "border-[rgba(12,16,26,0.25)]"
                  )}
                >
                  {on && <span className="size-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1 text-[0.95rem] font-medium text-foreground">{p.name}</span>
                <span className="shrink-0 text-[0.95rem] font-medium tabular-nums text-foreground">
                  ${perMonth.toLocaleString()}
                  <span className="text-xs font-normal text-[var(--ink-3)]">/mo</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border-[1.5px] border-[var(--fb-strong)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_24px_48px_-28px_rgba(16,24,40,0.28)]">
        <p className="bg-[var(--fb-strong)] py-1.5 text-center text-xs font-semibold text-white">
          {trialDays} days free
        </p>
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <VanteraLogo className="mt-0.5 size-8 shrink-0 text-[var(--fb)]" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[1.35rem] font-medium leading-tight tracking-tight text-foreground">
                {plan.name}
                {plan.highlight && plans.length > 1 && (
                  <span className="rounded-md bg-[var(--cyan-tint)] px-2 py-0.5 text-xs font-medium text-[#1161cc]">
                    Most popular
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink-3)]">{plan.tagline}</p>
            </div>
          </div>

          <p className="mt-6 flex items-start text-foreground">
            <span className="mt-1.5 text-xl font-medium">$</span>
            <span className="text-[3.25rem] font-medium leading-none tracking-[-0.04em] tabular-nums">
              {price.toLocaleString()}
            </span>
            <span className="ml-1.5 self-end pb-1.5 text-sm text-[var(--ink-3)]">/month</span>
          </p>
          <p className="mt-2 text-sm text-[var(--ink-3)]">
            {interval === "year" ? (
              <>
                <span className="font-semibold tabular-nums text-foreground">
                  ${plan.annualYearlyUsd.toLocaleString()}
                </span>{" "}
                billed yearly.
              </>
            ) : (
              "Billed monthly."
            )}
          </p>

          <div className="mt-5">
            <FormError
              message={
                finishFailed
                  ? "Your plan is active but setup didn't finish. Refresh to try again."
                  : checkoutError
                    ? "We couldn't open secure checkout just now. No charge was made — try again in a moment."
                    : canceled
                      ? "No charge was made. Pick a plan whenever you're ready."
                      : undefined
              }
            />
          </div>

          <form action={startCheckout} className="mt-1">
            <input type="hidden" name="tier" value={plan.tier} />
            <input type="hidden" name="interval" value={interval} />
            <input type="hidden" name="returnTo" value="onboarding" />
            <button
              type="submit"
              disabled={devBypass}
              title={devBypass ? "Billing isn't configured in this local environment" : undefined}
              className={cn(
                "group w-full disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[var(--fb-strong)] disabled:active:scale-100",
                PRIMARY_BUTTON
              )}
            >
              Start {trialDays}-day free trial
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </form>

          <p className="mt-3 text-balance text-center text-xs leading-relaxed text-[var(--ink-3)]">
            <ShieldCheck className="mr-1 inline size-3.5 -translate-y-px align-middle" aria-hidden />
            Card required · $0 today · ${price.toLocaleString()}/mo after {trialDays} days · cancel anytime
          </p>

          {features.length > 0 && (
            <ul className="mt-6 space-y-3 border-t border-[var(--hairline)] pt-6">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[0.9rem] leading-snug text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--fb)]" strokeWidth={2.4} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {devBypass && (
        <form action={finishOnboardingForm} className="mt-6 rounded-xl border border-dashed border-amber-400/70 bg-amber-50 p-4">
          <p className="text-[12.5px] leading-relaxed text-amber-900">
            <strong>Local dev only.</strong> No billing keys in this environment, so secure checkout can&rsquo;t open and the
            button above is disabled. Use this to finish setup without a subscription — it never renders in production.
          </p>
          <button type="submit" className="mt-3 h-9 rounded-lg bg-amber-500 px-4 text-[13px] font-semibold text-white">
            Finish without billing
          </button>
        </form>
      )}
    </div>
  );
}

function IntervalToggle({ interval, onChange }: { interval: Interval; onChange: (i: Interval) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="tablist"
        aria-label="Billing cadence"
        className="inline-flex rounded-lg border border-[rgba(12,16,26,0.1)] bg-[rgba(12,16,26,0.03)] p-1"
      >
        {(["month", "year"] as const).map((value) => {
          const active = interval === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(value)}
              className={cn(
                "rounded-md px-4 py-1.5 text-[0.8rem] font-semibold transition-[color,background-color,box-shadow] duration-200",
                active
                  ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.1)]"
                  : "text-[var(--ink-3)] hover:text-foreground"
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
            </button>
          );
        })}
      </div>
      <span
        className={cn(
          "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
          interval === "year" ? "bg-[var(--cyan-tint)] text-[#1161cc]" : "text-[var(--ink-3)]"
        )}
      >
        2 months free on annual
      </span>
    </div>
  );
}

/** Post-checkout: poll (via router.refresh) until the webhook lands; the server finishes + redirects. */
function Confirming() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > CONFIRM_GIVE_UP_MS) {
        setSlow(true);
        clearInterval(t);
        return;
      }
      router.refresh();
    }, CONFIRM_POLL_MS);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex flex-col items-center rounded-xl border border-[rgba(12,16,26,0.09)] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className="grid size-12 place-items-center rounded-xl bg-[var(--cyan-tint)]">
        <Loader2 className="size-5 animate-spin text-[var(--fb-strong)]" />
      </span>
      <p className="mt-5 text-[1.05rem] font-semibold text-foreground">Confirming your subscription…</p>
      <p className="mt-2 max-w-[34ch] text-[0.88rem] leading-relaxed text-[var(--ink-3)]">
        {slow
          ? "This is taking longer than usual. Your card was saved — refresh this page in a moment, or contact support if it persists."
          : "Your agents are being set up. This usually takes a few seconds."}
      </p>
      {slow && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-5 inline-flex h-10 items-center rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-[rgba(12,16,26,0.16)] hover:bg-[rgba(12,16,26,0.02)]"
        >
          Refresh
        </button>
      )}
    </div>
  );
}

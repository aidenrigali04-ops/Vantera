"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type { PlanTier } from "@vantera/billing";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/form-error";
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

  return (
    <div className="flex flex-col">
      <IntervalToggle interval={interval} onChange={setInterval_} />

      <div role="radiogroup" aria-label="Plan" className="mt-5 flex flex-col gap-3">
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
                "flex w-full items-start gap-4 rounded-[14px] border bg-white p-4 text-left transition-all",
                on
                  ? "border-[var(--fb)] shadow-[0_0_0_3px_rgba(24,119,242,0.14)]"
                  : "border-[rgba(12,16,26,0.12)] hover:border-[rgba(12,16,26,0.24)]"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1 grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                  on ? "border-[var(--fb)] bg-[var(--fb)]" : "border-[rgba(12,16,26,0.28)]"
                )}
              >
                {on && <span className="size-2 rounded-full bg-white" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-foreground">{p.name}</span>
                  {p.highlight && (
                    <span className="rounded-full bg-[rgba(24,119,242,0.10)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--fb-strong)]">
                      Most popular
                    </span>
                  )}
                </span>
                <span className="text-[13px] leading-relaxed text-[var(--ink-3)]">{p.tagline}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-[17px] font-semibold tabular-nums text-foreground">
                  ${perMonth.toLocaleString()}
                  <span className="text-[12px] font-medium text-[var(--ink-4)]">/mo</span>
                </span>
                <span className="text-[11px] text-[var(--ink-4)]">
                  {interval === "year" ? `$${p.annualYearlyUsd.toLocaleString()} billed yearly` : "billed monthly"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ink-2)]">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--fb-strong)]" strokeWidth={2.4} />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-6">
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

      <form action={startCheckout} className="mt-2">
        <input type="hidden" name="tier" value={plan.tier} />
        <input type="hidden" name="interval" value={interval} />
        <input type="hidden" name="returnTo" value="onboarding" />
        <button
          type="submit"
          disabled={devBypass}
          title={devBypass ? "Billing isn't configured in this local environment" : undefined}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--fb-strong)] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#1461d1] hover:shadow-[0_10px_28px_-10px_rgba(24,119,242,0.6)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[var(--fb-strong)] disabled:hover:shadow-none"
        >
          Start {trialDays}-day free trial
        </button>
      </form>

      <p className="mt-4 text-center text-[12.5px] leading-relaxed text-[var(--ink-4)]">
        Card required · $0 today · ${price.toLocaleString()}/mo after {trialDays} days · cancel anytime
      </p>

      {devBypass && (
        <form action={finishOnboardingForm} className="mt-6 rounded-[12px] border border-dashed border-amber-400/70 bg-amber-50 p-4">
          <p className="text-[12.5px] leading-relaxed text-amber-900">
            <strong>Local dev only.</strong> No billing keys in this environment, so secure checkout can&rsquo;t open and the
            button above is disabled. Use this to finish setup without a subscription — it never renders in production.
          </p>
          <button type="submit" className="mt-3 rounded-[10px] bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white">
            Finish without billing
          </button>
        </form>
      )}
    </div>
  );
}

function IntervalToggle({ interval, onChange }: { interval: Interval; onChange: (i: Interval) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div role="tablist" aria-label="Billing cadence" className="inline-flex rounded-full border border-[rgba(12,16,26,0.12)] bg-white p-1">
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
                "rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                active ? "bg-[var(--fb-strong)] text-white" : "text-[var(--ink-3)] hover:text-foreground"
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
            </button>
          );
        })}
      </div>
      <span className={cn("text-[12px] font-medium transition-opacity", interval === "year" ? "text-[var(--fb-strong)]" : "text-[var(--ink-4)]")}>
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
    <div className="flex flex-col items-center py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[rgba(24,119,242,0.10)]">
        <Loader2 className="size-5 animate-spin text-[var(--fb-strong)]" />
      </span>
      <p className="mt-5 text-[16px] font-semibold text-foreground">Confirming your subscription…</p>
      <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-[var(--ink-3)]">
        {slow
          ? "This is taking longer than usual. Your card was saved — refresh this page in a moment, or contact support if it persists."
          : "Your agents are being set up. This usually takes a few seconds."}
      </p>
      {slow && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-5 rounded-[12px] border border-[rgba(12,16,26,0.12)] bg-white px-5 py-2.5 text-[13.5px] font-semibold text-foreground"
        >
          Refresh
        </button>
      )}
    </div>
  );
}

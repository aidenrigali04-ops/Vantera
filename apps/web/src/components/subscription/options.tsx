"use client";

import { useState } from "react";
import { ArrowRight, Sparkles, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { paybackLine, planFacts, usd, type Interval } from "./plan-facts";
import { FeatureList, IntervalSwitch, Receipt, StartButton, TrustLine, type WorkspaceContext } from "./shared";

/**
 * Three directions for the onboarding subscription step. The product sells ONE self-serve
 * plan, so none of these is a plan comparison — each is a different answer to "why start the
 * trial now", using a different lever:
 *
 *   A · Receipt     — remove every decision but yes/no. Lowest friction.
 *   B · Continuity  — show the workspace already built; cancelling throws it away.
 *   C · Payback     — anchor the price against one closed client, not against nothing.
 *
 * All three make the same promises with the same numbers (see `shared.tsx`); they differ in
 * what they put first.
 */

export interface SubscriptionOptionProps {
  /** server action for the checkout form */
  action: (formData: FormData) => void | Promise<void>;
  now: Date;
  ctx: WorkspaceContext;
}

function CheckoutForm({
  action,
  interval,
  tier,
  children,
}: {
  action: SubscriptionOptionProps["action"];
  interval: Interval;
  tier: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="interval" value={interval} />
      <input type="hidden" name="returnTo" value="onboarding" />
      {children}
    </form>
  );
}

/* ── A · Receipt ────────────────────────────────────────────────────────────────
   One decision, stated like a checkout: what you get, what it costs, when. Nothing
   competes with the button. Best when the user already wants in and any extra choice
   is friction. */
export function OptionReceipt({ action, now, ctx }: SubscriptionOptionProps) {
  const plan = planFacts();
  const [interval, setInterval] = useState<Interval>("month");
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--fb-strong)]">{plan.name}</p>
          <p className="mt-1.5 max-w-[38ch] text-[14.5px] leading-relaxed text-[var(--ink-3)]">{plan.tagline}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-[32px] font-bold leading-none tracking-[-0.03em] text-foreground">
            {usd(interval === "year" ? plan.annualMonthlyUsd : plan.monthlyUsd)}
          </span>
          <span className="ml-0.5 text-[14px] font-medium text-[var(--ink-4)]">/mo</span>
        </p>
      </div>

      <IntervalSwitch interval={interval} onChange={setInterval} monthsFree={plan.monthsFree} className="mt-5" />

      <FeatureList features={plan.features} className="mt-6" />

      <Receipt plan={plan} interval={interval} now={now} className="mt-6" />

      <CheckoutForm action={action} interval={interval} tier={plan.tier}>
        <StartButton label={`Start ${plan.trialDays} days free`} className="mt-5" />
      </CheckoutForm>
      <TrustLine trialDays={plan.trialDays} className="mt-3.5" />
      {ctx.senderName && (
        <p className="mt-4 text-center text-[12.5px] text-[var(--ink-4)]">
          Your first messages go out from {ctx.senderName} — after you approve them.
        </p>
      )}
    </div>
  );
}

/* ── B · Continuity ─────────────────────────────────────────────────────────────
   The user has already built something: a profile derived from their site, a connected
   sender, prospects found, drafts written. This design shows that inventory FIRST, so
   starting the trial reads as continuing, and abandoning reads as discarding. */
export function OptionContinuity({ action, now, ctx }: SubscriptionOptionProps) {
  const plan = planFacts();
  const [interval, setInterval] = useState<Interval>("month");
  const built = [
    ctx.icpName ? { icon: UserRound, label: "Your buyer profile", value: ctx.icpName } : null,
    ctx.senderName ? { icon: Sparkles, label: "Sender connected", value: ctx.senderName } : null,
    ctx.prospectsFound > 0 ? { icon: Users, label: "Prospects matched", value: `${ctx.prospectsFound}` } : null,
  ].filter(Boolean) as { icon: typeof UserRound; label: string; value: string }[];

  return (
    <div className="flex flex-col">
      <div className="rounded-[14px] border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-sm)]">
        <p className="text-[13px] font-semibold text-foreground">Ready and waiting for you</p>
        <ul className="mt-3.5 flex flex-col gap-3">
          {built.map((b) => (
            <li key={b.label} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[rgba(24,119,242,0.08)] text-[var(--fb-strong)]">
                <b.icon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-[var(--ink-4)]">{b.label}</span>
                <span className="block truncate text-[14px] font-medium text-foreground">{b.value}</span>
              </span>
            </li>
          ))}
        </ul>
        {ctx.draftsReady > 0 && (
          <p className="mt-4 rounded-[10px] bg-[rgba(24,119,242,0.06)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
            <span className="font-semibold text-foreground">{ctx.draftsReady} messages</span> are written and waiting for your
            approval. They send the moment you say so.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <p className="text-[14.5px] font-semibold text-foreground">Keep it running</p>
        <p>
          <span className="text-[22px] font-bold tracking-[-0.02em] text-foreground">
            {usd(interval === "year" ? plan.annualMonthlyUsd : plan.monthlyUsd)}
          </span>
          <span className="ml-0.5 text-[13px] font-medium text-[var(--ink-4)]">/mo</span>
        </p>
      </div>
      <IntervalSwitch interval={interval} onChange={setInterval} monthsFree={plan.monthsFree} className="mt-3" />
      <Receipt plan={plan} interval={interval} now={now} className="mt-5" />

      <CheckoutForm action={action} interval={interval} tier={plan.tier}>
        <StartButton label="Start free — keep my queue" className="mt-5" />
      </CheckoutForm>
      <TrustLine trialDays={plan.trialDays} className="mt-3.5" />
    </div>
  );
}

/* ── C · Payback ────────────────────────────────────────────────────────────────
   With one plan there is nothing to anchor the price against — so anchor it against the
   outcome. "One closed client covers 18 months" reframes $79 as trivially small, using
   the user's own average deal value. Falls back to the plain price when we don't know it,
   rather than inventing a number. */
export function OptionPayback({ action, now, ctx }: SubscriptionOptionProps) {
  const plan = planFacts();
  const [interval, setInterval] = useState<Interval>("year");
  const payback = paybackLine(plan, interval, ctx.avgDealValueUsd);

  return (
    <div className="flex flex-col">
      <div className="rounded-[16px] bg-[linear-gradient(180deg,#1877f2_0%,#1468da_74%,#1163d2_100%)] p-6 text-white">
        {payback ? (
          <>
            <p className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em]">{payback}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/75">
              At {usd(ctx.avgDealValueUsd ?? 0)} a client, one close pays for {plan.name} — the rest is margin.
            </p>
          </>
        ) : (
          <>
            <p className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em]">Everything, one price.</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/75">{plan.tagline}</p>
          </>
        )}
        <div className="mt-5 flex items-end justify-between border-t border-white/20 pt-4">
          <span className="text-[13px] text-white/75">{interval === "year" ? "Billed yearly" : "Billed monthly"}</span>
          <span>
            <span className="text-[30px] font-bold leading-none tracking-[-0.03em]">
              {usd(interval === "year" ? plan.annualMonthlyUsd : plan.monthlyUsd)}
            </span>
            <span className="ml-0.5 text-[13px] font-medium text-white/70">/mo</span>
          </span>
        </div>
      </div>

      <IntervalSwitch interval={interval} onChange={setInterval} monthsFree={plan.monthsFree} className="mt-5" />
      <FeatureList features={plan.features.slice(0, 4)} className="mt-5" />
      <Receipt plan={plan} interval={interval} now={now} className="mt-5" />

      <CheckoutForm action={action} interval={interval} tier={plan.tier}>
        <StartButton label={`Start ${plan.trialDays} days free`} className="mt-5" />
      </CheckoutForm>
      <TrustLine trialDays={plan.trialDays} className="mt-3.5" />
    </div>
  );
}

export const SUBSCRIPTION_OPTIONS = {
  receipt: { label: "A · Receipt", Component: OptionReceipt, lever: "Fewest decisions: what you get, what it costs, when." },
  continuity: { label: "B · Continuity", Component: OptionContinuity, lever: "Shows the workspace already built — starting continues it." },
  payback: { label: "C · Payback", Component: OptionPayback, lever: "Anchors the price against one closed client." },
} as const;

export type SubscriptionOptionKey = keyof typeof SUBSCRIPTION_OPTIONS;

/** A tiny helper so the preview and the real step agree on the frame around each option. */
export function OptionFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className={cn("w-full max-w-[480px]")}>
      <h1 className="text-[26px] font-bold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[28px]">{title}</h1>
      <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-[var(--ink-3)]">{sub}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

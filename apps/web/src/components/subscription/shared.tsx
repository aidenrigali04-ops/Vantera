"use client";

import { Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { chargeFacts, usd, type Interval, type PlanFacts } from "./plan-facts";

/**
 * Pieces every subscription design shares, so the three directions differ in LAYOUT and
 * EMPHASIS — not in what they claim. One price, one trial length, one set of promises.
 */

/** Monthly ⇄ annual. The only choice on this step, so it is a switch, not a plan grid. */
export function IntervalSwitch({
  interval,
  onChange,
  monthsFree,
  className,
}: {
  interval: Interval;
  onChange: (i: Interval) => void;
  monthsFree: number;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div role="tablist" aria-label="Billing cadence" className="inline-flex rounded-[10px] border border-[rgba(12,16,26,0.12)] bg-white p-1">
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
                "rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                active ? "bg-[var(--fb-strong)] text-white" : "text-[var(--ink-3)] hover:text-foreground"
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
            </button>
          );
        })}
      </div>
      <span
        className={cn(
          "text-[12.5px] font-medium transition-colors",
          interval === "year" ? "text-[var(--fb-strong)]" : "text-[var(--ink-4)]"
        )}
      >
        {monthsFree} months free
      </span>
    </div>
  );
}

/**
 * The receipt — the heart of every direction. A card-required trial lives or dies on two
 * numbers being impossible to misread: what leaves your account today ($0), and what leaves
 * it on a named date. Burying either is what makes a paywall feel like a trap.
 */
export function Receipt({ plan, interval, now, className }: { plan: PlanFacts; interval: Interval; now: Date; className?: string }) {
  const c = chargeFacts(plan, interval, now);
  return (
    <dl className={cn("rounded-[14px] border border-[var(--hairline)] bg-[var(--tint)] p-4", className)}>
      <div className="flex items-baseline justify-between">
        <dt className="text-[14px] text-[var(--ink-2)]">Due today</dt>
        <dd className="text-[22px] font-bold tracking-[-0.02em] text-foreground">{usd(c.todayUsd)}.00</dd>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between border-t border-[var(--hairline)] pt-2.5">
        <dt className="text-[14px] text-[var(--ink-3)]">
          Then from <span className="font-semibold text-[var(--ink-2)]">{c.firstChargeLabel}</span>
        </dt>
        <dd className="text-[15px] font-semibold text-[var(--ink-2)]">
          {usd(c.thenUsd)}
          <span className="text-[13px] font-medium text-[var(--ink-4)]">{c.thenUnit}</span>
        </dd>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--ink-4)]">
        Cancel any time through {c.cancelByLabel} and you pay nothing.
      </p>
    </dl>
  );
}

/** What the trial actually includes — capability, not adjectives. */
export function FeatureList({ features, className }: { features: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2.5 text-[14px] leading-snug text-[var(--ink-2)]">
          <Check className="mt-0.5 size-4 shrink-0 text-[var(--fb-strong)]" strokeWidth={2.4} aria-hidden />
          {f}
        </li>
      ))}
    </ul>
  );
}

/** The escape hatch sits next to the button, never in a footer. */
export function TrustLine({ trialDays, className }: { trialDays: number; className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--ink-4)]", className)}>
      <ShieldCheck className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Card required to start · {trialDays} days free · cancel in one click
    </p>
  );
}

export function StartButton({ label, pending = false, className }: { label: string; pending?: boolean; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--fb-strong)] px-6 py-3.5 text-[15px] font-semibold text-white",
        "transition-all hover:bg-[#1461d1] hover:shadow-[0_10px_28px_-10px_rgba(24,119,242,0.6)] active:scale-[0.99] disabled:opacity-60",
        className
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </button>
  );
}

/** The workspace the user already built — the thing a cancelled signup throws away. */
export interface WorkspaceContext {
  /** the ICP the scan derived, e.g. "Heads of Sales · B2B SaaS" */
  icpName: string | null;
  /** connected sender, e.g. "Anna K." */
  senderName: string | null;
  /** prospects already matched */
  prospectsFound: number;
  /** drafts already written and waiting */
  draftsReady: number;
  /** what one new client is worth, for the payback line */
  avgDealValueUsd: number | null;
}

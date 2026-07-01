"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeading } from "./heading";
import { PrimaryCta, SecondaryCta } from "./cta";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";

export interface LandingPlan {
  tier: string;
  name: string;
  tagline: string;
  monthlyUsd: number;
  annualMonthlyUsd: number;
  annualYearlyUsd: number;
  highlight: boolean;
  features: string[];
}

export function Pricing({ plans }: { plans: LandingPlan[] }) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative border-t border-[var(--hairline)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Pricing"
          title="Choose your plan"
          subtitle="Start free — choose a plan when you deploy your first agent. Every plan scales with your revenue goal, not a contract."
        />

        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="inline-flex items-center rounded-full border border-[var(--hairline)] bg-white p-1">
            {[
              { v: false, label: "Monthly" },
              { v: true, label: "Annual" },
            ].map((opt) => {
              const active = annual === opt.v;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setAnnual(opt.v)}
                  className={cn(
                    "rounded-full px-5 py-2 text-[13px] font-medium transition-colors",
                    active ? "bg-[#0a0c12] text-white" : "text-[var(--ink-3)] hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span className="text-[13px] font-medium text-[var(--ink-4)]">2 months free</span>
        </div>

        <Reveal className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = annual ? plan.annualMonthlyUsd : plan.monthlyUsd;
            return (
              <RevealItem
                key={plan.tier}
                className={cn(CARD_INTERACTIVE, "flex h-full flex-col p-7")}
                style={plan.highlight ? { borderColor: "rgba(11, 87, 171,0.5)" } : undefined}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-foreground">{plan.name}</h3>
                  {plan.highlight && (
                    <span className="rounded-full bg-[var(--cyan-strong)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mt-2 min-h-10 text-[13.5px] leading-relaxed text-[var(--ink-3)]">{plan.tagline}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-5xl font-semibold tabular-nums tracking-[-0.03em] text-foreground">${price}</span>
                  <span className="mb-1.5 text-[14px] font-medium text-[var(--ink-4)]">/mo</span>
                </div>
                <p className="mt-1 text-[12px] text-[var(--ink-4)]">
                  {annual ? `Billed $${plan.annualYearlyUsd.toLocaleString()}/yr` : "Billed monthly"}
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ink-2)]">
                      <Check className="mt-0.5 size-4 shrink-0 text-[var(--cyan-strong)]" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  {plan.highlight ? (
                    <PrimaryCta href="/signup" className="w-full">Start free</PrimaryCta>
                  ) : (
                    <SecondaryCta href="/signup" className="w-full">Start free</SecondaryCta>
                  )}
                </div>
              </RevealItem>
            );
          })}
        </Reveal>

        <p className="mt-8 text-center text-[13px] text-[var(--ink-4)]">
          Need custom volume, SSO, or a dedicated contact?{" "}
          <a href="mailto:sales@vanterasystem.com?subject=Vantera%20Enterprise" className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline">
            Talk to us about Enterprise
          </a>
          .
        </p>
      </div>
    </section>
  );
}

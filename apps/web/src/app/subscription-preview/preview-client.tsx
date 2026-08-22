"use client";

import { SUBSCRIPTION_OPTIONS, OptionFrame, type SubscriptionOptionKey } from "@/components/subscription/options";
import type { WorkspaceContext } from "@/components/subscription/shared";

/**
 * All three subscription directions side by side, in the real onboarding surface
 * (`auth-surface landing` — the same blue/white system the two steps before it use), on the
 * same sample workspace, so the only difference the eye can find is the design.
 */
const CTX: WorkspaceContext = {
  icpName: "Heads of Sales · B2B SaaS",
  senderName: "Anna K.",
  prospectsFound: 62,
  draftsReady: 14,
  avgDealValueUsd: 1400,
};

const COPY = {
  title: "Choose your plan",
  sub: "Start with a free trial. Your agents go live the moment you're in — and nothing sends without your approval.",
};

export function PreviewClient({ nowIso }: { nowIso: string }) {
  const now = new Date(nowIso);
  const noop = () => {};
  const keys = Object.keys(SUBSCRIPTION_OPTIONS) as SubscriptionOptionKey[];

  return (
    <main className="auth-surface landing min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-[1600px]">
        <p className="mb-8 text-[13px] text-[var(--ink-4)]">
          Onboarding · step 3 of 3 — three directions on the same workspace. Development only.
        </p>
        <div className="grid gap-12 xl:grid-cols-3">
          {keys.map((key) => {
            const { label, Component, lever } = SUBSCRIPTION_OPTIONS[key];
            return (
              <section key={key} className="flex flex-col">
                <div className="mb-6 border-b border-[var(--hairline)] pb-4">
                  <p className="text-[13px] font-semibold text-foreground">{label}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-4)]">{lever}</p>
                </div>
                <OptionFrame title={COPY.title} sub={COPY.sub}>
                  <Component action={noop} now={now} ctx={CTX} />
                </OptionFrame>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

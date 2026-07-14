"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/clarity";
import { Reveal, RevealItem, CARD } from "./surface";
import { INSET_CARD_SHADOW, MetricCell, StatRail, StatusDot, useInViewOnce } from "./viz";

/** LinkedIn brand glyph — lucide dropped brand icons, so we render it inline. */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/**
 * Final CTA — the closing conversion band. Light system to match the hero: near-black
 * heading on white, a faint on-palette gold/blue pool behind a centered card, one
 * reserved --fb primary CTA, and a compact inline booking pill (lighter than the
 * hero's). Cyan is used only for the eyebrow dot and hairline accents. Honors
 * prefers-reduced-motion for the ambient pool.
 */
export function FinalCta() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [cardRef] = useInViewOnce();

  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28 lg:py-32">
      {/* one restrained on-palette pool marking the closing moment — static, no breathing blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(50% 44% at 50% 6%, rgba(24,119,242,0.08) 0%, transparent 62%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <RevealItem>
            <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
              Get started
            </span>
          </RevealItem>

          <RevealItem>
            <h2 className="mx-auto mt-6 max-w-3xl text-[2.3rem] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-[3rem] lg:text-[3.35rem]">
              Your next 10 customers are already on{" "}
              <span className="whitespace-nowrap">
                <span
                  role="img"
                  aria-label="LinkedIn"
                  className="mx-[0.08em] inline-flex translate-y-[0.14em] items-center justify-center rounded-[10px] border border-[var(--hairline)] bg-white p-[0.18em] align-baseline shadow-[var(--shadow-card)]"
                >
                  <LinkedinMark className="h-[0.62em] w-[0.62em] text-[var(--fb)]" />
                  <span className="sr-only">LinkedIn</span>
                </span>
                .
              </span>
              <br className="hidden sm:block" /> Let Vera find them.
            </h2>
          </RevealItem>

          <RevealItem>
            <p className="mx-auto mt-6 max-w-xl text-[16px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]">
              Live in minutes. Vera starts on plays that already work, surfaces your in-market
              buyers, and drafts every message — you approve the sends, and it gets sharper every
              week.
            </p>
          </RevealItem>

          {/* primary CTA + reassurance row */}
          <RevealItem>
            <div className="mt-9 flex flex-col items-center gap-4">
              <Link
                href="/signup"
                onClick={() => trackEvent("cta_click", { location: "final_cta_button" })}
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(24,119,242,0.4)] transition-all hover:bg-[var(--fb-strong)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(24,119,242,0.45)] active:scale-[0.98]"
              >
                Start free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <p className="text-[13px] font-medium text-[var(--ink-4)]">
                Free trial{" "}
                <span className="mx-1.5 text-[var(--cyan-line)]">·</span> Live in minutes{" "}
                <span className="mx-1.5 text-[var(--cyan-line)]">·</span> Cancel anytime
              </p>
            </div>
          </RevealItem>

          {/* compact inline booking prompt — a lighter echo of the hero's URL pill */}
          <RevealItem>
            <div className="mx-auto mt-10 max-w-lg">
              <div className="mb-3 text-[12.5px] font-medium text-[var(--ink-4)]">
                Or start with your site — we&apos;ll map your ICP for you
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const site = url.trim();
                  trackEvent("cta_click", { location: "final_cta", has_site: site ? "1" : "0" });
                  router.push(site ? `/signup?site=${encodeURIComponent(site)}` : "/signup");
                }}
                className="flex w-full items-center gap-2 rounded-full border border-[var(--hairline)] bg-white py-1.5 pl-5 pr-1.5 shadow-[var(--shadow-sm)] transition-shadow focus-within:border-[var(--fb)] focus-within:shadow-[0_0_0_3px_rgba(24,119,242,0.16),var(--shadow-card)]"
              >
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourcompany.com"
                  aria-label="Your website URL"
                  className="min-w-0 flex-1 bg-transparent text-[14.5px] text-foreground outline-none placeholder:text-[var(--ink-4)]"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0a0b0d] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:bg-[#1a1c20] active:scale-[0.98]"
                >
                  Get my plan
                  <ArrowRight className="size-3.5" />
                </button>
              </form>
            </div>
          </RevealItem>
        </Reveal>

        {/* supporting visual — a compact "outcome" card built with the contract's
            light-card recipe, echoing the hero-calendar's booked-meeting language. */}
        <Reveal className="mx-auto mt-14 max-w-2xl">
          <RevealItem>
            <div
              ref={cardRef}
              className={cn(
                CARD,
                "group relative overflow-hidden rounded-3xl p-6 transition-all duration-300 sm:p-7",
                "hover:-translate-y-0.5 hover:border-[var(--cyan-line)]",
              )}
              style={{ boxShadow: INSET_CARD_SHADOW }}
            >
              {/* header — honest first-party proof: our own account, real numbers */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-[9px] bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                    <CalendarCheck className="size-[17px]" strokeWidth={2} />
                  </span>
                  <div className="leading-tight">
                    <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                      We run Vantera on our own outbound
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-4)]">Our account · first ~2.5 weeks · real numbers</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-tint)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                  Real data
                </span>
              </div>

              {/* metric rail */}
              <StatRail className="mt-5">
                {METRICS.map((m) => (
                  <MetricCell key={m.label} value={m.value} label={m.label} />
                ))}
              </StatRail>

              {/* the real funnel those numbers took — no invented trend */}
              <div className="mt-6 border-t border-[var(--hairline)] pt-5">
                <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">
                  <span className="font-medium text-foreground">
                    467 buyers sourced → 133 qualified → 90 contacted → 24 replies.
                  </span>{" "}
                  The same system you get, run on our own pipeline. Yours starts within ~15
                  minutes.{" "}
                  <Link
                    href="/how-we-prove-it"
                    className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline"
                  >
                    Why we only show real numbers
                  </Link>
                </p>
              </div>

              {/* pipeline rail — the hero's LinkedIn → calendar story as live progress */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--hairline)] pt-5 sm:justify-start">
                {PIPELINE.map((step, i) => {
                  const active = i === PIPELINE.length - 1;
                  return (
                    <span key={step} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
                          active
                            ? "bg-[var(--fb-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]"
                            : "border border-[var(--hairline)] bg-[var(--tint)] text-[var(--ink-2)] shadow-[var(--shadow-sm)]",
                        )}
                      >
                        {active ? (
                          <StatusDot size="sm" pulse />
                        ) : (
                          <Check className="size-3 text-[var(--cyan-strong)]" strokeWidth={2.6} />
                        )}
                        {step}
                      </span>
                      {i < PIPELINE.length - 1 && <ArrowRight className="size-3 text-[var(--ink-4)]" aria-hidden />}
                    </span>
                  );
                })}
              </div>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}

const METRICS: { value: string; label: string }[] = [
  { value: "133", label: "Qualified buyers" },
  { value: "90", label: "Contacted" },
  { value: "9", label: "Interested replies" },
];

const PIPELINE = ["Identify", "Qualify", "Draft", "Book"] as const;

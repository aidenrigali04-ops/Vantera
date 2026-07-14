"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics/clarity";
import { HeroCalendar } from "./hero-calendar";
import { HeroConnector } from "./hero-connector";

/** LinkedIn brand glyph — lucide dropped brand icons, so we render it inline. */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export function Hero() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  // Pipeline connector: LinkedIn icon → calendar. Endpoints measured from these refs;
  // each booked meeting bumps bookTick to send one packet down the pipe. The pill ref
  // measures the headline's bottom edge so the play chip can sit in the real whitespace
  // band between headline and subhead (never guessed — font sizes jump across breakpoints).
  const sectionRef = useRef<HTMLElement>(null);
  const linkedinRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [bookTick, setBookTick] = useState(0);
  const handleBook = useCallback(() => setBookTick((t) => t + 1), []);

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative min-h-[100svh] overflow-hidden pt-32 pb-16 sm:pt-36 lg:flex lg:min-h-fit lg:flex-1 lg:flex-col lg:justify-center lg:pt-28 lg:pb-6"
    >
      {/* subtle cyan ambience — a single soft wash, top-right, masked so it never reads as a glow blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(48% 42% at 78% 6%, rgba(24,119,242,0.16) 0%, transparent 62%), radial-gradient(40% 36% at 12% 0%, rgba(24,119,242,0.06) 0%, transparent 60%)",
        }}
      />

      {/* pipeline conduit: LinkedIn icon → calendar (rendered before the grid so it sits behind it) */}
      <HeroConnector
        sectionRef={sectionRef}
        linkedinRef={linkedinRef}
        pillRef={pillRef}
        calendarRef={calendarRef}
        bookTick={bookTick}
      />

      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.04fr_1fr] lg:gap-12">
          {/* LEFT — content */}
          <div className="max-w-xl">
            {/* h1 is the LCP element: no opacity gate, painted in SSR so it renders at
                first paint instead of waiting on hydration. */}
            {/* Base size stepped down from 2.9rem: the nowrap "knows what works" pill must fit a
                390px viewport; sm+ keeps the original scale. */}
            <h1 className="text-[2.3rem] font-semibold leading-[1.18] tracking-[-0.04em] text-foreground sm:text-[3.6rem] lg:text-[4rem]">
              The{" "}
              <span className="whitespace-nowrap">
                <span
                  ref={linkedinRef}
                  role="img"
                  aria-label="LinkedIn"
                  className="mx-[0.02em] inline-flex translate-y-[0.16em] items-center justify-center rounded-[12px] border border-[var(--hairline)] bg-white p-[0.2em] align-baseline shadow-[var(--shadow-card)]"
                >
                  <LinkedinMark className="h-[0.7em] w-[0.7em] text-[var(--fb)]" />
                  <span className="sr-only">LinkedIn</span>
                </span>
              </span>{" "}
              outreach that already{" "}
              <span
                ref={pillRef}
                className="relative inline-block whitespace-nowrap rounded-[12px] px-3 pb-[0.12em] pt-[0.04em] text-white shadow-[0_12px_30px_-10px_rgba(24,119,242,0.6)] [background:linear-gradient(180deg,#2a82f7_0%,#1877f2_56%,#166fe5_100%)]">
                knows what works
              </span>
            </h1>

            <p
              className="landing-rise mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[19px]"
              style={{ animationDelay: "90ms" }}
            >
              Meet Vera — the brain behind your outreach. It finds your in-market buyers, reaches
              them with plays that are already proven, and gets sharper every week from what
              actually lands. You approve every send — and your account stays safe.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const site = url.trim();
                trackEvent("cta_click", { location: "hero", has_site: site ? "1" : "0" });
                router.push(site ? `/signup?site=${encodeURIComponent(site)}` : "/signup");
              }}
              className="landing-rise mt-8 flex w-full max-w-md items-center gap-2 rounded-[12px] border border-[var(--hairline)] bg-white py-1.5 pl-5 pr-1.5 shadow-[var(--shadow-card)] transition-shadow focus-within:border-[var(--fb)] focus-within:shadow-[0_0_0_3px_rgba(24,119,242,0.16),var(--shadow-card)]"
              style={{ animationDelay: "170ms" }}
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter your website URL"
                aria-label="Your website URL"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[var(--ink-4)]"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[var(--fb-strong)] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#1461d1] hover:shadow-[0_8px_24px_-8px_rgba(24,119,242,0.7)] active:scale-[0.98]"
              >
                Start free
                <ArrowRight className="size-4" />
              </button>
            </form>

            <p className="landing-rise mt-3.5 text-[13px] text-[var(--ink-3)]" style={{ animationDelay: "250ms" }}>
              No credit card required · Free 7-day trial · You approve every message
            </p>
          </div>

          {/* RIGHT — live Google-Calendar filling with booked client meetings.
              min-w-0 lets the (intentionally wider) calendar overflow this grid track
              rightward instead of growing the track and squeezing the left column. */}
          <div className="landing-rise min-w-0" style={{ animationDelay: "200ms" }}>
            <HeroCalendar cardRef={calendarRef} onBook={handleBook} />
          </div>
        </div>
      </div>
    </section>
  );
}

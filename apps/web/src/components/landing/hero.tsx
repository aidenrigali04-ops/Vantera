import type { CSSProperties } from "react";
import { MarkDither } from "./hero-dither";
import { HeroTicker } from "./hero-ticker";
import { ONBOARDING_MINUTES } from "./claims";
import { UrlForm } from "./url-form";

/* Staggers the CSS entrance (`landing-rise` in globals.css). */
const rise = (delay: number) => ({ "--rise-delay": `${delay}s` }) as CSSProperties;

/**
 * The landing hero, after rankbox.xyz: white, framed between the hairline rails that
 * run down from the nav, the copy centred over a dithered Vantera mark. The headline's
 * second line cycles through what LinkedIn turns into; the proof band
 * (trust-strip.tsx) closes the hero and the painted showcase rises into the first view.
 *
 * The headline is the LCP element, so it paints on the server with no opacity gate;
 * only the lines under it rise in.
 */
export function Hero() {
  return (
    <section id="top" className="relative bg-white">
      <div className="relative mx-auto max-w-6xl overflow-hidden border-x border-[var(--hairline)]">
        {/* Faded toward the edges, so the mark sits behind the copy and the rails
            stay clean. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.42] [mask-image:radial-gradient(ellipse_66%_82%_at_50%_50%,#000_50%,transparent_100%)]"
        >
          <MarkDither />
        </div>

        <div className="relative flex flex-col items-center px-5 pb-16 pt-16 text-center sm:px-8 sm:pb-20 sm:pt-20 lg:pb-[5.5rem] lg:pt-24">
          <h1 className="text-[2.3rem] font-medium leading-[1.08] tracking-[-0.035em] text-foreground min-[400px]:text-[2.6rem] sm:text-[3.5rem] lg:text-[4.15rem]">
            {/* The full sentence for crawlers and screen readers; the visual line
                below swaps the outcome for the rolling reel. */}
            <span className="sr-only">
              Turn LinkedIn into revenue, meetings, pipeline, replies and customers on
              autopilot
            </span>
            <span aria-hidden className="block">
              Turn LinkedIn into
            </span>
            <span
              aria-hidden
              className="mt-[0.04em] flex flex-wrap items-center justify-center gap-x-[0.25em]"
            >
              <HeroTicker />
              <span>on autopilot</span>
            </span>
          </h1>

          <p
            className="landing-rise mt-6 max-w-[41rem] text-balance text-[1.05rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.15rem]"
            style={rise(0.1)}
          >
            Agents find in-market buyers on LinkedIn, write every first message from real
            activity, and turn warm replies into booked meetings, while machine learning
            sharpens who they target.
          </p>

          <div className="landing-rise mt-9 w-full max-w-[37rem]" style={rise(0.2)}>
            <UrlForm />
            <p className="mt-3.5 text-[0.82rem] text-[var(--ink-3)]">
              Set up in {ONBOARDING_MINUTES} minutes · Free 7-day trial
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

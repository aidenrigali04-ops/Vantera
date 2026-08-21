"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { LaurelBadges } from "./laurel-badges";
import { HeroConversations } from "./hero-conversations";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  };
}

/* "Data pixels" drifting on the blue slab — the reference's square particles.
   Generated once here as a literal (never Math.random at render: SSR and client
   must produce the identical field). Laid out as a jittered 9x6 grid so coverage
   is even across the whole slab, with a tight size band and low peak opacity so
   they read as texture, never as decoration competing with the copy.
   x/y in %, s in px, dur/delay in s, max = peak opacity. */
const PIXELS: { x: number; y: number; s: number; dur: number; delay: number; max: number }[] = [
  { x: 2.5, y: 12.6, s: 20, dur: 6.1, delay: 0.3, max: 0.068 },
  { x: 12.0, y: 8.4, s: 15, dur: 4.5, delay: 4.5, max: 0.104 },
  { x: 31.5, y: 8.3, s: 16, dur: 3.9, delay: 3.8, max: 0.11 },
  { x: 34.4, y: 9.0, s: 17, dur: 6.4, delay: 1.9, max: 0.107 },
  { x: 53.8, y: 4.1, s: 18, dur: 6.2, delay: 0.5, max: 0.09 },
  { x: 59.7, y: 11.9, s: 18, dur: 5.3, delay: 0.9, max: 0.112 },
  { x: 71.4, y: 2.0, s: 18, dur: 4.9, delay: 1.8, max: 0.059 },
  { x: 86.1, y: 2.1, s: 17, dur: 3.8, delay: 4.2, max: 0.117 },
  { x: 97.4, y: 12.1, s: 14, dur: 6.3, delay: 2.9, max: 0.084 },
  { x: 4.9, y: 25.9, s: 19, dur: 6.6, delay: 1.6, max: 0.054 },
  { x: 19.8, y: 19.5, s: 17, dur: 4.6, delay: 1.4, max: 0.058 },
  { x: 54.3, y: 19.1, s: 14, dur: 5.6, delay: 2.4, max: 0.109 },
  { x: 57.5, y: 26.7, s: 19, dur: 6.6, delay: 4.3, max: 0.117 },
  { x: 72.2, y: 20.0, s: 19, dur: 4.5, delay: 2.6, max: 0.113 },
  { x: 82.5, y: 27.9, s: 16, dur: 5.5, delay: 0.1, max: 0.103 },
  { x: 90.3, y: 24.2, s: 16, dur: 5.9, delay: 2.3, max: 0.091 },
  { x: 4.9, y: 47.4, s: 15, dur: 6.0, delay: 0.0, max: 0.053 },
  { x: 14.4, y: 37.1, s: 20, dur: 6.4, delay: 2.0, max: 0.112 },
  { x: 59.0, y: 37.6, s: 18, dur: 6.5, delay: 0.8, max: 0.081 },
  { x: 76.3, y: 44.1, s: 20, dur: 4.3, delay: 1.9, max: 0.075 },
  { x: 85.5, y: 42.7, s: 17, dur: 6.1, delay: 4.6, max: 0.07 },
  { x: 89.9, y: 40.0, s: 20, dur: 6.0, delay: 4.3, max: 0.079 },
  { x: 4.5, y: 62.1, s: 18, dur: 6.5, delay: 3.1, max: 0.066 },
  { x: 28.4, y: 63.4, s: 14, dur: 3.9, delay: 4.3, max: 0.053 },
  { x: 54.5, y: 64.0, s: 15, dur: 5.0, delay: 4.1, max: 0.083 },
  { x: 61.2, y: 61.5, s: 19, dur: 4.8, delay: 3.3, max: 0.085 },
  { x: 69.9, y: 59.8, s: 19, dur: 6.0, delay: 1.9, max: 0.091 },
  { x: 79.8, y: 57.4, s: 15, dur: 6.6, delay: 1.3, max: 0.11 },
  { x: 95.5, y: 57.5, s: 19, dur: 5.6, delay: 4.0, max: 0.115 },
  { x: 4.8, y: 73.4, s: 14, dur: 5.0, delay: 0.5, max: 0.077 },
  { x: 13.9, y: 82.1, s: 16, dur: 4.8, delay: 4.1, max: 0.05 },
  { x: 23.2, y: 81.0, s: 14, dur: 6.3, delay: 1.1, max: 0.058 },
  { x: 36.8, y: 68.2, s: 15, dur: 5.1, delay: 4.5, max: 0.105 },
  { x: 50.3, y: 74.8, s: 18, dur: 6.6, delay: 5.0, max: 0.117 },
  { x: 61.4, y: 68.4, s: 17, dur: 4.5, delay: 3.7, max: 0.116 },
  { x: 73.1, y: 81.0, s: 14, dur: 5.5, delay: 1.4, max: 0.08 },
  { x: 86.4, y: 82.0, s: 18, dur: 6.6, delay: 0.8, max: 0.076 },
  { x: 96.4, y: 79.8, s: 17, dur: 5.6, delay: 4.7, max: 0.059 },
  { x: 7.5, y: 96.2, s: 17, dur: 5.1, delay: 4.4, max: 0.103 },
  { x: 15.0, y: 91.9, s: 19, dur: 5.9, delay: 3.8, max: 0.056 },
  { x: 30.9, y: 88.0, s: 19, dur: 4.5, delay: 2.0, max: 0.103 },
  { x: 41.7, y: 96.1, s: 17, dur: 5.0, delay: 3.6, max: 0.1 },
  { x: 51.9, y: 96.8, s: 17, dur: 5.9, delay: 0.8, max: 0.089 },
  { x: 62.7, y: 89.8, s: 18, dur: 5.5, delay: 3.7, max: 0.071 },
  { x: 76.1, y: 96.6, s: 19, dur: 6.0, delay: 2.4, max: 0.07 },
  { x: 86.4, y: 93.2, s: 20, dur: 6.2, delay: 0.0, max: 0.056 },
  { x: 93.0, y: 86.8, s: 16, dur: 5.2, delay: 1.1, max: 0.062 },
];

function HeroPixels() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {PIXELS.map((p, i) => (
        <span
          key={i}
          className="hero-pixel absolute rounded-[2px] bg-white"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.s,
              height: p.s,
              "--pixel-max": p.max,
              "--pixel-dur": `${p.dur}s`,
              "--pixel-delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Full-bleed Facebook-blue hero. The slab is a near-imperceptible top-to-bottom
 * gradient (#1877f2 → #1163d2) so the brand hue holds at the top where only display
 * type lives (AA-large) while the small text lower down sits on a deeper blue that
 * clears WCAG AA 4.5:1 — see the --hero-blue* tokens in globals.css.
 * `isolate` gives -z-10 decorative children (the card's white glow) a stacking
 * context to paint into; `data-hero-dark` is LandingNav's inversion hook.
 */
export function Hero() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <section
      id="top"
      data-hero-dark
      className="relative isolate min-h-[100svh] overflow-hidden pt-32 pb-16 text-white sm:pt-36 lg:flex lg:min-h-fit lg:flex-1 lg:flex-col lg:justify-center lg:pt-28 lg:pb-10 [background:linear-gradient(180deg,#1877f2_0%,#1877f2_34%,#1468da_74%,#1163d2_100%)]"
    >
      <HeroPixels />
      <div className="relative mx-auto w-full max-w-6xl px-6 lg:px-8">
        {/* min-w-0 on the right track lets the (intentionally wider) card overflow
            rightward instead of growing the track and squeezing the headline —
            the page root's overflow-x-clip absorbs it. */}
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.95fr] lg:gap-12">
          {/* LEFT — content */}
          <div className="max-w-xl">
            {/* Powered-by laurels: only publicly-named integrations (LinkedIn, Claude,
                MCP) — white-labeled vendors never appear (rules 03/04/05). Same copy as
                the old lockup, recast as three all-white laurel badges. */}
            <motion.div {...rise(0)}>
              <LaurelBadges />
            </motion.div>

            {/* Sentence case in source — `uppercase` handles the display treatment, so
                the accessible name reads naturally. Caps need looser tracking than the
                old mixed-case -0.04em. */}
            {/* Three explicit lines as flex children rather than <br/>: the boxed word
                needs its own block so its padding and the line gap are controllable
                (vertical margins on an inline-block don't reliably push the next line).
                items-start keeps the box shrink-to-content instead of full width. */}
            <motion.h1
              {...rise(0.06)}
              className="mt-7 flex flex-col items-start gap-[0.09em] text-[2.5rem] font-extrabold uppercase leading-[0.94] tracking-[-0.015em] text-white sm:text-[3.3rem] lg:text-[3.6rem]"
            >
              {/* The {" "} keep the h1's text string word-separated ("LinkedIn into
                  Revenue on Autopilot") for crawlers and assistive tech — without them
                  the lines concatenate. CSS strips leading/trailing whitespace on a
                  line box, so neither space shifts anything visually. */}
              <span>LinkedIn into{" "}</span>
              <span className="rounded-[14px] bg-white px-[0.22em] pb-[0.08em] pt-[0.03em] text-[var(--fb-strong)] shadow-[0_20px_48px_-20px_rgba(3,22,58,0.6)]">
                Revenue
              </span>
              <span>{" "}on Autopilot</span>
            </motion.h1>

            {/* Solid white, never white/<100 — opacity drops this under 4.5:1. */}
            <motion.p
              {...rise(0.13)}
              className="mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-white sm:text-[19px]"
            >
              The smartest LinkedIn outreach automation — agents find in-market buyers, start real
              conversations, and turn warm replies into booked meetings. You approve every send.
            </motion.p>

            {/* The white pill stays opaque white: the .landing autofill override
                force-paints inputs white, so a glass field would flash on autofill.
                The blue submit button sits inside the white pill, not on the blue. */}
            <motion.form
              {...rise(0.2)}
              onSubmit={(e) => {
                e.preventDefault();
                const site = url.trim();
                router.push(site ? `/signup?site=${encodeURIComponent(site)}` : "/signup");
              }}
              className="mt-8 flex w-full max-w-md items-center gap-2 rounded-[12px] border border-white/70 bg-white py-1.5 pl-5 pr-1.5 shadow-[0_2px_6px_rgba(3,22,58,0.16),0_24px_54px_-22px_rgba(3,22,58,0.55)] transition-shadow focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.6),0_24px_54px_-22px_rgba(3,22,58,0.55)]"
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
                Get Started Free
                <ArrowRight className="size-4" />
              </button>
            </motion.form>

            <motion.p
              {...rise(0.27)}
              className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
            >
              Free 7-day trial · Cancel anytime
            </motion.p>
          </div>

          {/* RIGHT — LinkedIn conversations filling with warm replies */}
          <motion.div
            className="min-w-0"
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.24, ease: EASE }}
          >
            <HeroConversations />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

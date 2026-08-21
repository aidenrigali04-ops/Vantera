"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Rotating testimonial for the auth poster — one quote at a time, crossfading on a
 * fixed beat, paused on hover, pinned to the first under reduced motion. Copy is
 * SAMPLE until real customer quotes exist (same posture as the landing: fake proof is
 * negative proof — swap these for verified quotes before launch).
 */

const TESTIMONIALS = [
  {
    quote:
      "Three booked calls in the first week, and I read every message before it went out. That combination is the whole product.",
    name: "Marcus Deane",
    role: "Founder · Northwind Studio",
    initials: "MD",
  },
  {
    quote:
      "It writes like I would on a good day, then waits for me. My LinkedIn finally works while I'm in client meetings.",
    name: "Priya Natarajan",
    role: "Head of Growth · Halden Systems",
    initials: "PN",
  },
  {
    quote:
      "We replaced a list tool, a sequencer, and a VA. The review queue is where I spend five minutes a day now.",
    name: "Elliot Voss",
    role: "Managing Partner · Brightlane Agency",
    initials: "EV",
  },
  {
    quote:
      "The scores come with reasons. I stopped second-guessing who was in my queue after the second day.",
    name: "Sofia Marchetti",
    role: "VP Sales · Cadence",
    initials: "SM",
  },
];

const TICK_MS = 6000;

export function AuthTestimonials() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % TESTIMONIALS.length), TICK_MS);
    return () => clearInterval(t);
  }, [reduce, paused]);

  const t = TESTIMONIALS[index]!;

  return (
    <div
      className="relative"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* fixed-height stage so the poster never reflows between quotes */}
      <div className="relative min-h-[300px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={index}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="m-0"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-8 text-white/40"
              fill="currentColor"
              aria-hidden
            >
              <path d="M7.2 17.2c-1.7 0-3.1-1.4-3.1-3.3 0-3.6 2.4-6.5 6.1-7.9l.6 1.3c-2.1.9-3.4 2.3-3.7 4 .3-.1.6-.2 1-.2 1.6 0 2.8 1.3 2.8 3s-1.4 3.1-3.7 3.1zm9.6 0c-1.7 0-3.1-1.4-3.1-3.3 0-3.6 2.4-6.5 6.1-7.9l.6 1.3c-2.1.9-3.4 2.3-3.7 4 .3-.1.6-.2 1-.2 1.6 0 2.8 1.3 2.8 3s-1.4 3.1-3.7 3.1z" />
            </svg>
            <blockquote className="mt-5 max-w-[24ch] text-[1.9rem] font-semibold leading-[1.22] tracking-[-0.025em] text-white xl:text-[2.25rem]">
              {t.quote}
            </blockquote>
            <figcaption className="mt-7 flex items-center gap-3.5">
              <span className="grid size-11 place-items-center rounded-full bg-white text-[13px] font-bold text-[var(--fb-strong)] shadow-[0_12px_30px_-12px_rgba(3,22,58,0.6)]">
                {t.initials}
              </span>
              <span className="leading-tight">
                <span className="block text-[15px] font-semibold text-white">{t.name}</span>
                <span className="mt-0.5 block text-[13px] text-white/75">{t.role}</span>
              </span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>

      {/* position dots — tappable */}
      <div className="mt-6 flex items-center gap-2" role="tablist" aria-label="Testimonials">
        {TESTIMONIALS.map((x, i) => (
          <button
            key={x.name}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Testimonial ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
            )}
          />
        ))}
      </div>
    </div>
  );
}

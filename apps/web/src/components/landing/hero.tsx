"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { ResultsConsole } from "./hero-visual/results-console";
// Alternative motions kept as drop-in swaps for <ResultsConsole />:
// import { LiveWinsFeed } from "./hero-visual/live-wins-feed";
// import { ConnectionThread } from "./hero-visual/connection-thread";

/**
 * Landing hero — mirrors the reference component's layout (left-aligned pill → headline → sub →
 * two CTAs, then a full-width framed product surface below), with Vantera's copy and the live
 * Results console in the frame instead of a generic dashboard. Particles are kept but pulled back
 * behind a soft radial wash so the left-aligned content reads cleanly. Accent = LinkedIn blue.
 */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-[#0a0b0d]">
      <DottedSurface colorTheme="dark" contained />
      {/* Keep the particles, manipulate them to fit: a soft top-left wash + center calm so the
          dots frame the hero (echoing the reference's subtle corner glow) without clutter. */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(80% 60% at 0% 0%, rgba(10,102,194,0.10) 0%, transparent 55%), radial-gradient(70% 60% at 35% 38%, rgba(10,11,13,0.85) 0%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-32 pb-16 lg:px-8">
        {/* left-aligned content block */}
        <div className="flex max-w-3xl flex-col items-start text-left">
          {/* Live Events in San Francisco — the card on top */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] py-1 pl-1.5 pr-3"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-brand/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-brand">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
              </span>
              Live
            </span>
            <span className="text-[13px] text-foreground/85">Live Events in San Francisco</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading mt-7 text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl"
          >
            LinkedIn Automation
            <br />
            Reimagined
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl"
          >
            The #1 LinkedIn Automation System.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a
              href="mailto:sales@vanterasystem.com?subject=Vantera%20demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-white/[0.06]"
            >
              <Phone className="size-4" />
              Book a demo
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-[15px] font-medium text-brand-foreground shadow-lg shadow-brand/25 transition-opacity hover:opacity-90"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>

        {/* The framed product surface — same width/spacing as the reference dashboard */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <ResultsConsole />
        </motion.div>
      </div>
    </section>
  );
}

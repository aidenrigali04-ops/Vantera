"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TextEffect } from "@/components/ui/text-effect";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { LiveWinsFeed } from "./hero-visual/live-wins-feed";
// Alternative motion, kept as a drop-in swap (see hero-visual/connection-thread):
// import { ConnectionThread } from "./hero-visual/connection-thread";

/**
 * Landing hero — the promise + a LIVING proof, not a static dashboard. A "Live Events in
 * San Francisco" card sits up top, the headline lands, then a streaming wins feed shows the
 * product's value (in-market buyers worked → meetings booked → pipeline) the moment a visitor
 * arrives. Particles are kept but pulled behind a soft radial mask so the feed reads cleanly.
 */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4">
      <DottedSurface colorTheme="dark" contained />
      {/* Manipulate the particle field to fit: a soft radial vignette calms the center where the
          content lives, so the dots frame the hero instead of fighting the feed. */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 42%, rgba(10,10,12,0.92) 0%, rgba(10,10,12,0.65) 45%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center pt-24 pb-12 text-center">
        {/* Live Events in San Francisco — the card on top */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 shadow-lg shadow-black/20 backdrop-blur"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/60" />
            <span className="relative inline-flex size-2 rounded-full bg-foreground" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/85 sm:text-xs">
            Live Events in San Francisco
          </span>
        </motion.div>

        <TextEffect
          as="h1"
          per="word"
          preset="blur"
          className="font-heading max-w-4xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          LinkedIn Automation Reimagined
        </TextEffect>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg"
        >
          The #1 LinkedIn Automation System.
        </motion.p>

        {/* The living proof — replaces the generic dashboard */}
        <motion.div
          className="mt-10 w-full"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <LiveWinsFeed />

          <div className="mt-9 flex flex-col items-center gap-2">
            <Link
              href="/signup"
              className="rounded-[18px] border border-brand px-6 py-2.5 text-[17.5px] font-medium text-brand shadow-lg shadow-brand/20 transition-colors hover:bg-brand/10"
            >
              Start free
            </Link>
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground/70">
              No credit card to start
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

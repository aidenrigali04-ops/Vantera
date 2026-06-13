"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { TextEffect } from "@/components/ui/text-effect";
import { GlowBackdrop } from "./glow-backdrop";
import { LiveDemo } from "./pipeline-demo/live-demo";
import { WARM } from "./landing-theme";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pt-32 pb-20 sm:pt-40">
      <GlowBackdrop />

      <div className="mx-auto max-w-3xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wide text-foreground/70"
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: WARM.c2 }} />
          AGENTIC SDR SALES INTELLIGENCE
        </motion.span>

        <TextEffect
          as="h1"
          per="word"
          preset="blur"
          className="font-heading mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-[3.5rem] md:leading-[1.05]"
        >
          Describe your buyer. Watch the pipeline build itself.
        </TextEffect>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Vantera&apos;s SDR agents prospect, enrich, and score your market — then reach out across
          email, LinkedIn, and calls with only the high-quality leads, funneling booked meetings
          straight into your CRM.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground/70"
        >
          Try it free below — no signup, sample data, the real pipeline.
        </motion.div>
      </div>

      {/* The live demo (search + theater) */}
      <motion.div
        id="demo"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8 }}
        className="mx-auto mt-12 max-w-5xl scroll-mt-24"
      >
        <LiveDemo />
      </motion.div>

      <div className="mt-8 text-center">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          or skip the demo and create your account
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WARM, WARM_GRADIENT } from "./landing-theme";

export function FinalCta() {
  return (
    <section className="relative px-4 py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center sm:px-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: `radial-gradient(circle, ${WARM.c2}22, transparent 65%)` }}
        />
        <div className="relative">
          <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Deploy in minutes
          </span>
          <h2 className="font-heading mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Give your pipeline an SDR team that never clocks out.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Connect your channels, define your ICP, and let the agents prospect, enrich, score, and
            reach out — while you focus on closing.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium text-background shadow-lg shadow-black/30 transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: WARM_GRADIENT }}
            >
              Get started free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.04]"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-muted-foreground/70">
            No credit card to start · Cancel anytime
          </p>
        </div>
      </motion.div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WARM } from "./landing-theme";

export function FinalCta() {
  return (
    <section className="relative px-4 py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 px-6 py-16 text-center sm:px-12"
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
            The AI SDR you won&apos;t have to apologize for.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Define your ICP and connect your channels. The agents prospect, score, and draft — you
            approve every send, and you&apos;re never locked in.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background shadow-lg shadow-black/30 transition-opacity hover:opacity-90"
            >
              Get started free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.07]"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-muted-foreground/70">
            Free for 14 days · No credit card · Cancel anytime
          </p>
        </div>
      </motion.div>
    </section>
  );
}

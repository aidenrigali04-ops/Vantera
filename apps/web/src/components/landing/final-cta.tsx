"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="px-6 py-20 lg:px-8 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0c12] px-6 py-16 text-center shadow-[var(--panel-glow)] sm:py-24"
      >
        {/* subtle cyan ambience + top rim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 70% at 50% -10%, rgba(48,207,255,0.2), transparent 60%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-medium text-white/70">
            <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)]" />
            Get started
          </span>
          <h2 className="mx-auto mt-6 max-w-2xl text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[3.2rem]">
            Turn intent into <span className="text-[var(--cyan)]">revenue</span> on LinkedIn
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-white/55 sm:text-[18px]">
            Deploy your agents in minutes. They find in-market buyers, qualify them, and draft every
            message — you approve the sends and watch the meetings land.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-[#0a0c12] transition-transform hover:-translate-y-0.5"
            >
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="mailto:sales@vanterasystem.com?subject=Vantera%20demo"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-white/[0.06]"
            >
              Book a demo
            </a>
          </div>

          <p className="mt-6 text-[13px] text-white/40">No credit card · You approve every message</p>
        </div>
      </motion.div>
    </section>
  );
}

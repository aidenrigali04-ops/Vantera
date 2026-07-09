"use client";

import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, Hand, Ban } from "lucide-react";

/**
 * Above-the-fold trust row. This replaced a fabricated customer-logo cloud
 * (HubSpot/Okta/Zendesk/… — none are Vantera customers, so it was false
 * endorsement and legal exposure). Until real, attributable customer logos or
 * numbers exist, the honest thing to show here is the product's actual
 * guarantees — which also answer the category's #1 objection: "will this get my
 * LinkedIn account restricted?" Every claim below is literally true of the product.
 */
const SIGNALS = [
  { icon: ShieldCheck, label: "LinkedIn-safe pacing", sub: "human-like limits, built in" },
  { icon: Hand, label: "You approve every send", sub: "nothing goes out without you" },
  { icon: CheckCircle2, label: "Live in minutes", sub: "connect and it's working" },
  { icon: Ban, label: "No card to start", sub: "cancel anytime" },
] as const;

export function TrustStrip() {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-12 lg:py-9">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Above the fold on lg, so reveal on load rather than on scroll-into-view. */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-4)]"
        >
          Built to protect your account
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } } }}
          className="mt-10 grid grid-cols-2 gap-x-8 gap-y-7 sm:flex sm:flex-wrap sm:items-start sm:justify-center sm:gap-x-12 lg:mt-7 lg:gap-x-16"
        >
          {SIGNALS.map((s) => (
            <motion.div
              key={s.label}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              className="flex items-start gap-2.5"
            >
              <span className="mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-[8px] bg-[var(--cyan-tint)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)]">
                <s.icon className="size-[15px] text-[var(--cyan-strong)]" strokeWidth={2.2} />
              </span>
              <span className="leading-tight">
                <span className="block text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">
                  {s.label}
                </span>
                <span className="block text-[12px] text-[var(--ink-4)]">{s.sub}</span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

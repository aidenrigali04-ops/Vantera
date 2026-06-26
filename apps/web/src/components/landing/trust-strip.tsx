"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Eye, UserCheck, Network, Lock } from "lucide-react";

/**
 * "Powering revenue for modern teams" — an honest credibility strip. No fabricated
 * customer logos (honesty contract); instead the real product guarantees that make
 * Vantera safe to run on your own LinkedIn account.
 */
const PILLARS = [
  { icon: UserCheck, label: "You approve every send" },
  { icon: ShieldCheck, label: "LinkedIn-safe pacing" },
  { icon: Eye, label: "100% reply visibility" },
  { icon: Network, label: "Multi-sender distribution" },
  { icon: Lock, label: "GDPR-ready & audited" },
];

export function TrustStrip() {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-12">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-4)]"
        >
          Powering revenue for modern teams
        </motion.p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:gap-x-5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]"
            >
              <p.icon className="size-4 text-[var(--cyan-strong)]" />
              {p.label}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

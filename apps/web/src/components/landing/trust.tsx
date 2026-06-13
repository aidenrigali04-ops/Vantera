"use client";

import { motion } from "framer-motion";
import { ShieldCheck, MailX, Gauge, FileCheck } from "lucide-react";
import { SectionHeading } from "./section-heading";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Suppression by default",
    body: "A per-account suppression list is checked before every send on every channel — no path bypasses it.",
  },
  {
    icon: MailX,
    title: "One-click unsubscribe",
    body: "Every email carries unsubscribe + your address; opt-outs are honored instantly across all campaigns.",
  },
  {
    icon: Gauge,
    title: "Account-safe pacing",
    body: "Ramped volumes and human-like timing protect your LinkedIn account and your domain's deliverability.",
  },
  {
    icon: FileCheck,
    title: "GDPR & audit-ready",
    body: "Deletion cascades, retention windows, and a full send audit trail are built in from day one.",
  },
];

export function Trust() {
  return (
    <section className="relative px-4 py-24">
      <SectionHeading
        eyebrow="Trust"
        title="Aggressive on pipeline. Conservative on your reputation."
        subtitle="Cold outreach has real legal and deliverability surface. Vantera treats compliance as a product requirement, not an afterthought."
      />

      <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <item.icon className="size-5 text-foreground/80" />
            <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

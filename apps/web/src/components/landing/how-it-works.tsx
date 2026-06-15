"use client";

import { motion } from "framer-motion";
import { Crosshair, Database, Gauge, Send, CalendarCheck, GitBranch } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { WARM } from "./landing-theme";

const STEPS = [
  {
    icon: Crosshair,
    title: "Prospect",
    body: "Agents hunt your exact ICP across 150M+ companies and 800M+ contacts — on a schedule, while you sleep.",
    aha: "A full prospect list before Monday, with zero manual searching.",
  },
  {
    icon: Database,
    title: "Enrich",
    body: "Survivors get the waterfall: verified email, validated phone, firmographics, tech stack, and live buying signals.",
    aha: "Every contact is reachable and real — no bounces, no dead numbers.",
  },
  {
    icon: Gauge,
    title: "Score",
    body: "A deterministic rules gate plus AI ranking keep only high-fit, well-timed leads — each with a rationale.",
    aha: "You only ever spend reach on the leads worth reaching.",
  },
  {
    icon: Send,
    title: "Outreach",
    body: "Personalized email, LinkedIn, iMessage, and AI calls draft from each prospect's pain points and triggers — humanized, never spammy.",
    aha: "Outreach that sounds like your best rep wrote it, at machine scale.",
  },
  {
    icon: CalendarCheck,
    title: "Close",
    body: "Replies are classified, meetings get booked, and compliance — suppression, unsubscribe, pacing — is enforced automatically.",
    aha: "Meetings on the calendar, not another inbox to babysit.",
  },
  {
    icon: GitBranch,
    title: "CRM",
    body: "Closed and converting leads sync straight into your CRM, so revenue ops stays the single source of truth.",
    aha: "Pipeline lands where your team already works — no copy-paste.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="The loop"
        title="One pipeline, fully run by agents"
        subtitle="Every stage you just watched is a real part of the system — not a slide. Here's what runs end to end."
      />

      <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-5 transition-colors hover:border-white/20"
          >
            <div className="flex items-center gap-3">
              <span
                className="grid size-9 place-items-center rounded-xl border border-white/[0.16] bg-white/[0.07] text-foreground/80"
                style={{ boxShadow: `0 0 24px -10px ${WARM.c2}` }}
              >
                <step.icon className="size-4" />
              </span>
              <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
                0{i + 1}
              </span>
              <h3 className="font-heading text-lg font-semibold text-foreground">{step.title}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{step.body}</p>
            <p
              className="mt-3 border-l-2 pl-3 text-sm text-foreground/80"
              style={{ borderColor: WARM.c2 }}
            >
              {step.aha}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

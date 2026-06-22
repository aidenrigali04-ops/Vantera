"use client";

import { motion } from "framer-motion";
import { Radar, Lightbulb, Database, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { WARM } from "./landing-theme";

/**
 * The moat. Underneath the automation is a model of the person on the other end —
 * intent (who's in-market), motive (why they fit), memory (the living record).
 * "Memory" here is the account's signal + interaction record, not conversational
 * thread memory — kept honest in the copy.
 */
const PILLARS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Radar,
    title: "Intent",
    body: "Knows who's in-market now — not just who exists. It reads buying behavior on LinkedIn and moves while the timing's hot.",
  },
  {
    icon: Lightbulb,
    title: "Motive",
    body: "The pain, the trigger, and the value angle behind each fit — scored with a reason you can actually read.",
  },
  {
    icon: Database,
    title: "Memory",
    body: "Every signal, every reply, every touch, kept as one living record of the account. Nothing ever starts from scratch.",
  },
];

export function DeepAnalyst() {
  return (
    <section id="analyst" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="Deep Analyst"
        title="It doesn't just send. It understands."
        subtitle="Underneath every message is a model of the person on the other end."
      />

      <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-3">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-6"
          >
            <span
              className="grid size-10 place-items-center rounded-xl border border-white/[0.16] bg-white/[0.07] text-foreground/80"
              style={{ boxShadow: `0 0 24px -10px ${WARM.c2}` }}
            >
              <p.icon className="size-5" />
            </span>
            <h3 className="font-heading mt-4 text-lg font-semibold text-foreground">{p.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Bot, EyeOff, Clock, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./section-heading";

/**
 * Recognition, not fear. The three places outreach actually breaks — stated as
 * things the visitor has felt, so the rest of the page reads as the answer. Quiet
 * by design; the value displays itself.
 */
const FAILURES: { icon: LucideIcon; title: string; body: ReactNode }[] = [
  {
    icon: Bot,
    title: "It reads like a template.",
    body: (
      <>
        A prospect spots a{" "}
        <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[12px] text-foreground/80">
          {"{{first_name}}"}
        </code>{" "}
        blast in a second — and never replies.
      </>
    ),
  },
  {
    icon: EyeOff,
    title: "It can't tell who's ready.",
    body: "Spray everyone and you book the wrong people, or no one at all.",
  },
  {
    icon: Clock,
    title: "The reply comes, and sits.",
    body: "They message back on a Friday. By the time you see it, they've moved on.",
  },
];

export function Problem() {
  return (
    <section className="relative px-4 py-24">
      <SectionHeading eyebrow="Why deals slip" title="Outreach fails in the same three places." />

      <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-3">
        {FAILURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-5"
          >
            <f.icon className="size-5 text-muted-foreground/70" />
            <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mx-auto mt-8 max-w-2xl text-center text-base text-foreground/80"
      >
        Vantera was built to close all three.
      </motion.p>
    </section>
  );
}

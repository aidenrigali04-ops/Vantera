"use client";

import { motion } from "framer-motion";
import { Radar, Lightbulb, PenLine, MessagesSquare, ShieldCheck, GitBranch } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { WARM } from "./landing-theme";

const STEPS = [
  {
    icon: Radar,
    title: "Spot intent",
    body: "The Intent Agent watches LinkedIn for buying behavior around your space — people engaging competitors, posting about the problem you solve — and qualifies each against your ICP before they enter outreach.",
    aha: "You reach people while they're in-market, not at random.",
  },
  {
    icon: Lightbulb,
    title: "Understand the person",
    body: "The Deep Analyst reads why each one fits — the pain, the trigger, the motive behind the next deal — and keeps every signal as a living profile.",
    aha: "Every message starts from real context, never a guess.",
  },
  {
    icon: PenLine,
    title: "Write it personally",
    body: "Each prospect gets a message built from their own context — never a template. A humanizer strips the spammy tells before anything reaches you.",
    aha: "Outreach that reads like you wrote it, one prospect at a time.",
  },
  {
    icon: MessagesSquare,
    title: "Run the conversation",
    body: "Connection, follow-ups, and every reply in between. Vantera reads the intent the moment they respond and drafts your next move — you approve, it sends.",
    aha: "It only stops when they book, or bow out.",
  },
  {
    icon: ShieldCheck,
    title: "Respect the no",
    body: "A hard “no” is honored instantly and never touched again. A “not right now” is remembered, so timing that changes doesn't cost you the deal.",
    aha: "Your reputation stays intact; the warm-laters don't slip away.",
  },
  {
    icon: GitBranch,
    title: "Show the result",
    body: "Closed and converting leads sync straight into your CRM, and every reply is measured against the revenue goal you set.",
    aha: "Pipeline where your team already works — measured against your number.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="The motion"
        title="One system, from in-market to booked"
        subtitle="Every step runs on its own — and stops the instant you'd want it to. Here's what runs end to end."
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

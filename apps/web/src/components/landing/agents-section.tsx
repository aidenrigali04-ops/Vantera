"use client";

import { motion } from "framer-motion";
import { Telescope, PenLine, Radar } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { WARM, WARM_GRADIENT } from "./landing-theme";

const AGENTS = [
  {
    icon: Telescope,
    name: "Prospect Agent",
    role: "prospect",
    tagline: "Finds and qualifies the buyers worth your time.",
    points: [
      "Hunts your ICP on a daily or weekly schedule",
      "Deterministic rules gate + AI scoring",
      "Hands only high-fit leads to the team",
    ],
  },
  {
    icon: PenLine,
    name: "Outreach Agent",
    role: "outreach",
    tagline: "Writes each message and runs the conversation.",
    points: [
      "Personalized per prospect — never templated",
      "Humanizer linter kills the spammy tells",
      "Every draft waits in your review queue",
    ],
  },
  {
    icon: Radar,
    name: "Intent Agent",
    role: "intent",
    tagline: "Catches the people going in-market this week.",
    points: [
      "Watches LinkedIn for buying behavior in your niche",
      "Qualifies each against your ICP — never a bypass",
      "Reaches them while the timing is hot",
    ],
  },
];

export function AgentsSection() {
  return (
    <section id="agents" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="Your agents"
        title="Three agents. One outcome."
        subtitle="Deploy them the way you'd hire reps — except they run around the clock, never forget a follow-up, and only ever work the leads that fit."
      />

      <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
        {AGENTS.map((agent, i) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: i * 0.1 }}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-5 transition-colors hover:border-white/20"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: `radial-gradient(circle, ${WARM.c2}22, transparent 70%)` }}
            />
            <div className="flex items-center justify-between">
              <span
                className="grid size-10 place-items-center rounded-xl text-background"
                style={{ backgroundImage: WARM_GRADIENT }}
              >
                <agent.icon className="size-5" />
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: WARM.c2 }} />
                LIVE
              </span>
            </div>

            <h3 className="font-heading mt-4 text-lg font-semibold text-foreground">{agent.name}</h3>
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
              kind · {agent.role}
            </span>
            <p className="mt-2 text-sm text-foreground/80">{agent.tagline}</p>

            <ul className="mt-4 space-y-2 border-t border-white/5 pt-4">
              {agent.points.map((p) => (
                <li key={p} className="flex gap-2 text-[13px] text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ backgroundColor: WARM.c2 }} />
                  {p}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

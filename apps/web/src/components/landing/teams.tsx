"use client";

import { User, Building2, Users } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { cn } from "@/lib/utils";

const TEAMS = [
  {
    icon: User,
    name: "Solo & startup",
    plan: "Starter",
    body: "One sender working your ICP, hands-off. Prove the motion before you scale — Vantera sources, qualifies, and drafts while you run the business.",
  },
  {
    icon: Users,
    name: "Small business",
    plan: "Growth",
    body: "A whole revenue function without the headcount. The Intent Agent surfaces in-market buyers; you approve the sends and book the meetings.",
    highlight: true,
  },
  {
    icon: Building2,
    name: "Agencies",
    plan: "Scale",
    body: "Run outreach across many client accounts with multi-sender distribution — fifteen senders in parallel, each pacing safely, all in one workspace.",
  },
];

export function Teams() {
  return (
    <section id="teams" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Scalable for any team"
          title="Built for teams of every size"
          subtitle="Whether you're a solo founder or an agency running at volume, Vantera scales to fit — the same hands-off system, more senders as you grow."
        />

        <Reveal className="mt-14 grid gap-4 lg:grid-cols-3">
          {TEAMS.map((t) => (
            <RevealItem
              key={t.name}
              className={cn(CARD_INTERACTIVE, "group flex flex-col p-7")}
              style={t.highlight ? { borderColor: "rgba(11, 87, 171,0.5)" } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(11, 87, 171,0.2)] transition-transform duration-300 group-hover:scale-105">
                  <t.icon className="size-5" strokeWidth={1.9} />
                </span>
                <span className="rounded-full border border-[var(--hairline)] bg-[#fbfbfc] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-3)]">
                  {t.plan}
                </span>
              </div>
              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.015em] text-foreground">{t.name}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-3)]">{t.body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

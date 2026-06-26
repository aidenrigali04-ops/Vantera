"use client";

import { Users, BarChart3, ShieldCheck } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    icon: Users,
    title: "Team seating",
    body: "Invite your team into one workspace. Shared pipeline, shared review queue — everyone works from the same source of truth.",
  },
  {
    icon: BarChart3,
    title: "Smart analytics",
    body: "Every stage measured: sourced, qualified, drafted, replied, booked. See exactly what's working and where your revenue comes from.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-ban method",
    body: "Human-like pacing, multi-sender distribution, and hard safety ceilings keep your LinkedIn account well clear of restriction.",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="relative border-t border-[var(--hairline)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Intelligence that delivers"
          title="Achieve more together"
          subtitle="The system around the outreach — visibility, collaboration, and the safeguards that keep it all running."
        />

        <Reveal className="mt-14 grid gap-4 lg:grid-cols-3">
          {CARDS.map((c) => (
            <RevealItem key={c.title} className={cn(CARD_INTERACTIVE, "group p-7")}>
              <span className="grid size-12 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(48,207,255,0.2)] transition-transform duration-300 group-hover:scale-105">
                <c.icon className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.015em] text-foreground">{c.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-3)]">{c.body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

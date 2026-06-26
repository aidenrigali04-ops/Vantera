"use client";

import { Radar, Filter, BadgeCheck, Sparkles } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Radar,
    title: "Advanced user intent tracking",
    body: "Vantera reads buying intent across LinkedIn — the topics people engage with, the problems they raise, the company moves they make — to surface the buyers your product actually solves a problem for, while they're in-market. Not just the few who already found you.",
  },
  {
    icon: Filter,
    title: "Qualified prospects only",
    body: "Every prospect is scored on fit, seniority, and intent against your ICP. Anyone below the bar is filtered out automatically — you only ever pursue the leads with the highest close rate.",
  },
  {
    icon: BadgeCheck,
    title: "Outreach & close on approval",
    body: "Agents draft a personal message for each qualified lead and queue it for your sign-off. Nothing sends without you. Approve, and the sequence runs the conversation toward a booked meeting.",
  },
  {
    icon: Sparkles,
    title: "Efficiency powered by AI",
    body: "Sourcing, scoring, enrichment, and copywriting run autonomously in the background. The busywork disappears — you spend your time only on the people who are ready to talk.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="relative border-t border-[var(--hairline)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="The system"
          title="Everything you need to make LinkedIn profitable"
          subtitle="Outreach tailored to your niche, filtered to only the prospects who match your ICP and show intent — run end to end, until close."
        />

        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <RevealItem key={f.title} className={cn(CARD_INTERACTIVE, "group p-7")}>
              <span className="grid size-12 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(48,207,255,0.2)] transition-transform duration-300 group-hover:scale-105">
                <f.icon className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.015em] text-foreground">
                {f.title}
              </h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-3)]">{f.body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

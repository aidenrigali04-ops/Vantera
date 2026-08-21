"use client";

import Link from "next/link";
import { ArrowRight, Crosshair, RefreshCcw, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";

/**
 * The self-optimizing system — the three learning loops that make Vantera an adaptive
 * prospecting system rather than a sequencer (owner positioning pass, 2026-07-15). Each
 * pillar maps to real shipped machinery (targeting tilt, experiment engine, recipe
 * attribution), so every line here is a claim the product actually keeps. Built on the
 * landing card system (CARD_INTERACTIVE + Reveal) so it reads as one piece with the grid.
 */

type Pillar = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
};

const PILLARS: Pillar[] = [
  {
    icon: Crosshair,
    label: "Targeting",
    title: "Dynamic audience refinement",
    body: "Every accept, reply, and booked call teaches the system who your real buyers are. Sourcing shifts toward the segments that actually convert, and best-fit prospects move to the front of the queue — while the quality bar never drops.",
  },
  {
    icon: TrendingUp,
    label: "Messaging",
    title: "Evolving market-fit engine",
    body: "Vera tests one careful change at a time against your live audience — openers, angles, asks — keeps what your market responds to, and retires what it ignores. Your playbook becomes proven market fit, not guesswork.",
  },
  {
    icon: RefreshCcw,
    label: "Proof",
    title: "Closed-loop learning system",
    body: "Every message carries a record of the exact approach that wrote it, joined to its outcome. Wins feed the next campaign, losses are dropped, and any change that ever hurts results is rolled back automatically.",
  },
];

function PillarCard({ p }: { p: Pillar }) {
  return (
    <RevealItem className={cn(CARD_INTERACTIVE, "group flex flex-col p-7")}>
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-inset ring-[rgba(24,119,242,0.2)] transition-transform duration-300 group-hover:scale-105">
          <p.icon className="size-5" />
        </span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
          {p.label}
        </span>
      </div>
      <h3 className="mt-6 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
        {p.title}
      </h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{p.body}</p>
    </RevealItem>
  );
}

export function SystemPillars() {
  return (
    <section id="system" className="relative border-t border-[var(--hairline)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Self-optimizing"
          title="Outbound that compounds instead of burning out"
          subtitle="Three learning loops run on your real results — refining who you target, what you say, and what's worth keeping. Every sequencer is frozen the day you set it up."
        />

        <Reveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <PillarCard key={p.title} p={p} />
          ))}
        </Reveal>

        <div className="mt-10 text-center">
          <Link
            href="/how-it-learns"
            className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-[var(--cyan-strong)] transition-colors hover:text-[#1461d1]"
          >
            How the learning works, in plain English
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

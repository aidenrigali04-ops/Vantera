"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { AnimatedPanelBorder } from "@/components/ui/animated-border";
import { WARM_BEAM, WARM_GRADIENT } from "../landing-theme";
import { CountUp } from "./count-up";
import type { DemoDataset } from "./sim-data";

/** The dependency hook: the run is built, the payoff is locked behind signup. */
export function GatedPayoff({
  dataset,
  visibleCount,
  active,
}: {
  dataset: DemoDataset;
  visibleCount: number;
  active: boolean;
}) {
  const more = Math.max(0, dataset.stats.qualified - visibleCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 16 }}
      transition={{ duration: 0.6 }}
      className="relative rounded-3xl"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        {/* Blurred "locked" leads peeking from behind */}
        <div aria-hidden className="pointer-events-none absolute inset-x-5 top-5 space-y-2 opacity-40 blur-[6px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <span className="size-8 rounded-full bg-white/10" />
              <span className="h-2 flex-1 rounded bg-white/10" style={{ maxWidth: `${70 - i * 12}%` }} />
              <span className="h-5 w-9 rounded bg-white/10" />
            </div>
          ))}
        </div>

        <div className="relative pt-24">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-foreground/70">
                <Lock className="size-3" /> the rest is ready to launch
              </span>
              <h3 className="font-heading mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: WARM_GRADIENT }}>
                  +<CountUp to={more} active={active} duration={1200} />
                </span>{" "}
                more qualified leads, drafted and waiting.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your account to launch this “{dataset.label}” run for real — every lead
                enriched, scored, and sequenced across email, LinkedIn, and calls while you sleep.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              <div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  <CountUp to={dataset.stats.meetings} active={active} duration={1200} />
                </div>
                <div className="font-mono text-[10px] tracking-wide text-muted-foreground">meetings</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  <CountUp
                    to={dataset.stats.pipelineValue}
                    active={active}
                    duration={1300}
                    format={(n) => `$${Math.round(n / 1000)}k`}
                  />
                </div>
                <div className="font-mono text-[10px] tracking-wide text-muted-foreground">pipeline</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-background shadow-lg shadow-black/30 transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: WARM_GRADIENT }}
            >
              <Sparkles className="size-4" />
              Get started — launch this campaign
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="font-mono text-[11px] text-muted-foreground">
              Sample-data preview · no card required to try
            </span>
          </div>
        </div>
      </div>
      <AnimatedPanelBorder radius={24} gradient={WARM_BEAM} />
    </motion.div>
  );
}

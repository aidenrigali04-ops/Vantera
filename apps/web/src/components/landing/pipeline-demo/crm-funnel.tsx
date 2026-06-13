"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WARM_GRADIENT } from "../landing-theme";
import { CountUp } from "./count-up";
import type { DemoStats } from "./sim-data";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Closing stage: the qualified pipeline collapsing into booked meetings + CRM sync. */
export function CrmFunnel({ stats, active }: { stats: DemoStats; active: boolean }) {
  const replied = Math.round(stats.qualified * 0.16);
  const steps = [
    { label: "Sourced", value: stats.sourced },
    { label: "Qualified", value: stats.qualified },
    { label: "Contacted", value: stats.qualified },
    { label: "Replied", value: replied },
    { label: "Booked", value: stats.meetings },
  ];
  const max = stats.sourced;
  const goalPct = Math.min(100, Math.round((stats.pipelineValue / stats.mrrGoal) * 100));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
          pipeline → CRM
        </span>
        <span className="font-mono text-[11px] text-foreground/70">
          <CountUp to={stats.meetings} active={active} duration={1100} /> meetings booked
        </span>
      </div>

      <div className="space-y-1.5">
        {steps.map((s, i) => {
          const pct = Math.max(7, Math.round((s.value / max) * 100));
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{s.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-white/[0.03]">
                <motion.div
                  className="flex h-full items-center justify-end rounded-md pr-2"
                  style={{
                    backgroundImage: WARM_GRADIENT,
                    opacity: 0.35 + (1 - i / steps.length) * 0.6,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: active ? `${pct}%` : 0 }}
                  transition={{ duration: 0.9, delay: i * 0.12, ease: "easeOut" }}
                >
                  <span className="font-mono text-[10px] font-medium text-background/90">
                    <CountUp to={s.value} active={active} duration={1000} />
                  </span>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Goal-gradient: pipeline value toward the MRR goal */}
      <div className="mt-4 border-t border-white/5 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
            pipeline value
          </span>
          <span className="text-[11px] text-foreground/70">
            <span className="font-medium text-foreground">
              <CountUp to={stats.pipelineValue} active={active} duration={1300} format={money} />
            </span>{" "}
            of {money(stats.mrrGoal)} goal
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundImage: WARM_GRADIENT }}
            initial={{ width: 0 }}
            animate={{ width: active ? `${goalPct}%` : 0 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <ArrowRight className="size-3" />
          synced to your CRM
          <span className="text-foreground/60">Salesforce · HubSpot · Pipedrive</span>
        </div>
      </div>
    </div>
  );
}

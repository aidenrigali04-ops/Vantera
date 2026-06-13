"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WARM } from "../landing-theme";
import { StageRail } from "./stage-rail";
import { ProspectRow } from "./prospect-card";
import { ChannelDraft } from "./channel-draft";
import { CrmFunnel } from "./crm-funnel";
import { GatedPayoff } from "./gated-payoff";
import type { PipelineSimulation } from "./use-pipeline-simulation";

const PHASE_CAPTION: Record<string, string> = {
  idle: "standing by",
  sourcing: "pulling prospects that match your ICP…",
  gating: "applying the deterministic rules gate…",
  enriching: "enriching survivors — email, phone, signals…",
  scoring: "AI ranking on fit, timing & intent…",
  drafting: "drafting personalized outreach per channel…",
  sending: "sequencing sends — replies coming in…",
  crm: "closing the loop into your CRM…",
  done: "run complete — sample data",
};

export function PipelineTheater({ sim }: { sim: PipelineSimulation }) {
  const { dataset, phase, reached } = sim;

  const featured = dataset?.prospects.find((p) => p.fit) ?? null;
  const fitCount = dataset?.prospects.filter((p) => p.fit).length ?? 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c0f]/80 shadow-2xl shadow-black/50 backdrop-blur-xl">
      {/* Console header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
          vantera · live pipeline
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-foreground/70">
          <motion.span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: WARM.c2 }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          />
          LIVE PREVIEW
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Stage rail + caption */}
        <div className="space-y-2">
          <StageRail phase={phase} />
          <p className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground/70">
              {dataset ? `“${dataset.label}”` : "loading…"}
            </span>{" "}
            — {PHASE_CAPTION[phase]}
          </p>
        </div>

        {!dataset ? (
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.02]" />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
              {/* Prospect stream */}
              <ul className="space-y-2">
                {dataset.prospects.map((p, i) => (
                  <ProspectRow key={p.id} prospect={p} phase={phase} reached={reached} index={i} />
                ))}
              </ul>

              {/* Agent side panel */}
              <div className="space-y-4">
                {featured && reached("drafting") ? (
                  <ChannelDraft prospect={featured} active={reached("drafting")} reduced={sim.reducedMotion} />
                ) : (
                  <div
                    className={cn(
                      "rounded-2xl border border-white/10 bg-white/[0.02] p-3 font-mono text-[11px] text-muted-foreground",
                      "flex h-[124px] items-center justify-center text-center",
                    )}
                  >
                    outreach agent — queued for qualified leads
                  </div>
                )}
                <CrmFunnel stats={dataset.stats} active={reached("crm")} />
              </div>
            </div>

            <GatedPayoff dataset={dataset} visibleCount={fitCount} active={reached("crm")} />
          </>
        )}
      </div>
    </div>
  );
}

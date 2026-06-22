"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkedinGlyph } from "./brand-icons";
import { CountUp } from "./count-up";
import { GatedPayoff } from "./gated-payoff";
import { PHASE_ORDER, type Phase, type PipelineSimulation } from "./use-pipeline-simulation";
import type { Prospect } from "./sim-data";

const STEPS: { phase: Phase; title: string }[] = [
  { phase: "sourcing", title: "Source prospects" },
  { phase: "gating", title: "Qualify against your ICP" },
  { phase: "enriching", title: "Enrich the survivors" },
  { phase: "scoring", title: "AI score & rank" },
  { phase: "drafting", title: "Draft personalized outreach" },
  { phase: "sending", title: "Sequence & book meetings" },
  { phase: "crm", title: "Sync to your CRM" },
];

/** Tiny lint-safe typewriter — state is only written from the interval callback. */
function useTypewriter(text: string, active: boolean, reduced: boolean, speed = 22) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!active || reduced) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, active, reduced, speed]);
  return !active ? "" : reduced ? text : typed;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.16] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
      {children}
    </span>
  );
}

function StepResult({
  phase,
  active,
  reduced,
  dataset,
  specimen,
}: {
  phase: Phase;
  active: boolean;
  reduced: boolean;
  dataset: PipelineSimulation["dataset"];
  specimen: Prospect | null;
}) {
  const draftBody = specimen?.draft.body ?? "";
  const typed = useTypewriter(draftBody, phase === "drafting" && active, reduced);

  if (!dataset || !specimen) return null;
  const replied = dataset.prospects.filter((p) => p.replied).length;
  const skipped = dataset.prospects.filter((p) => !p.fit).length;

  switch (phase) {
    case "sourcing":
      return (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {dataset.prospects.slice(0, 4).map((p) => (
              <span
                key={p.id}
                className="grid size-5 place-items-center rounded-full border border-[#0b0c0f] bg-white/[0.08] font-mono text-[9px] text-foreground/80"
              >
                {p.firstName[0]}
                {p.lastName[0]}
              </span>
            ))}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {dataset.stats.sourced} prospects pulled
          </span>
        </div>
      );
    case "gating":
      return (
        <span className="font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground/80">{dataset.stats.qualified} qualified</span> ·{" "}
          {skipped + (dataset.stats.sourced - dataset.stats.qualified)} skipped off-ICP
        </span>
      );
    case "enriching":
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>{specimen.email}</Chip>
          {specimen.phoneValid && <Chip>{specimen.phone}</Chip>}
          <Chip>{specimen.techStack[0]}</Chip>
          <Chip>{specimen.signal}</Chip>
        </div>
      );
    case "scoring":
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              <CountUp to={specimen.score} active duration={1000} format={(n) => String(Math.round(n))} />
              /100
            </span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {specimen.firstName} {specimen.lastName} — {specimen.ahaMoment}
            </span>
          </div>
          {/* The timing edge — why this lead is worth reaching NOW, not just who they are. */}
          <div className="flex items-center gap-1.5">
            <Zap className="size-3 shrink-0 text-foreground/80" aria-hidden />
            <span className="truncate font-mono text-[11px] text-foreground/85">
              why now — {specimen.signal}
            </span>
          </div>
        </div>
      );
    case "drafting":
      return (
        <div className="space-y-1.5">
          <p className="text-[12px] leading-snug text-foreground/85">
            {typed || draftBody}
            {phase === "drafting" && active && typed.length < draftBody.length && (
              <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-foreground/70 align-middle" />
            )}
          </p>
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded border border-white/[0.16] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
              <LinkedinGlyph className="size-3" /> LinkedIn
            </span>
          </div>
        </div>
      );
    case "sending":
      return (
        <span className="font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground/80">{replied} replies</span> · 1 meeting booked
        </span>
      );
    case "crm":
      return (
        <span className="font-mono text-[11px] text-muted-foreground">
          qualified pipeline synced — Salesforce · HubSpot · Pipedrive
        </span>
      );
    default:
      return null;
  }
}

function StepRow({
  step,
  index,
  sim,
  specimen,
}: {
  step: { phase: Phase; title: string };
  index: number;
  sim: PipelineSimulation;
  specimen: Prospect | null;
}) {
  const stepIdx = PHASE_ORDER.indexOf(step.phase);
  const active = sim.phaseIndex === stepIdx;
  const done = sim.phaseIndex > stepIdx;
  const reached = active || done;

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-500",
        active ? "border-white/20 bg-white/[0.07]" : "border-transparent",
      )}
    >
      {/* Status indicator */}
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] transition-colors",
          done
            ? "bg-foreground text-background"
            : active
              ? "bg-white/10 text-foreground"
              : "bg-white/[0.07] text-muted-foreground/60",
        )}
      >
        {done ? (
          <Check className="size-3" strokeWidth={3} />
        ) : active ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          index + 1
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-medium transition-colors",
            reached ? "text-foreground" : "text-muted-foreground/60",
          )}
        >
          {step.title}
        </div>
        <AnimatePresence>
          {reached && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-1.5"
            >
              <StepResult
                phase={step.phase}
                active={active}
                reduced={sim.reducedMotion}
                dataset={sim.dataset}
                specimen={specimen}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

/** Compact, step-by-step automation runner — constrained to a section, not a dashboard. */
export function StepSimulation({ sim }: { sim: PipelineSimulation }) {
  const { dataset, reached } = sim;
  const specimen = dataset?.prospects.find((p) => p.fit) ?? null;
  const fitCount = dataset?.prospects.filter((p) => p.fit).length ?? 0;
  const completedSteps = STEPS.filter((s) => sim.phaseIndex >= PHASE_ORDER.indexOf(s.phase)).length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-white/[0.16] bg-[#0b0c0f]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.16] px-4 py-2.5">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
            {dataset ? `running · “${dataset.label}”` : "ready — describe your buyer above"}
          </span>
          <span className="font-mono text-[10px] tracking-wide text-foreground/70">
            step {Math.min(completedSteps, STEPS.length)} / {STEPS.length}
          </span>
        </div>

        <div className="p-3">
          <ol className="space-y-1">
            {STEPS.map((step, i) => (
              <StepRow key={step.phase} step={step} index={i} sim={sim} specimen={specimen} />
            ))}
          </ol>
          {!dataset && (
            <p className="px-3 pt-2.5 pb-1 font-mono text-[11px] text-muted-foreground/70">
              Type a target audience above (or tap an example) to run the pipeline.
            </p>
          )}
        </div>
      </div>

      {/* Output / conversion — kept verbatim */}
      <AnimatePresence>
        {dataset && reached("crm") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <GatedPayoff dataset={dataset} visibleCount={fitCount} active />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WARM_GRADIENT } from "../landing-theme";
import { PHASE_ORDER, type Phase } from "./use-pipeline-simulation";

const STAGES: { key: Phase; label: string }[] = [
  { key: "sourcing", label: "Source" },
  { key: "gating", label: "Qualify" },
  { key: "enriching", label: "Enrich" },
  { key: "scoring", label: "Score" },
  { key: "drafting", label: "Draft" },
  { key: "sending", label: "Send" },
  { key: "crm", label: "CRM" },
];

/** The pipeline's stage indicator — the "machine layer" rendered in mono. */
export function StageRail({ phase }: { phase: Phase }) {
  const current = PHASE_ORDER.indexOf(phase);

  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto font-mono text-[11px] tracking-wide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {STAGES.map((stage, i) => {
        const idx = PHASE_ORDER.indexOf(stage.key);
        const done = current > idx;
        const active = current === idx;
        return (
          <li key={stage.key} className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors duration-500",
                active
                  ? "border-transparent text-background"
                  : done
                    ? "border-white/10 text-foreground/80"
                    : "border-white/10 text-muted-foreground/50",
              )}
              style={active ? { backgroundImage: WARM_GRADIENT } : undefined}
            >
              <span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-full text-[9px]",
                  active ? "bg-background/25" : done ? "bg-white/10" : "bg-white/5",
                )}
              >
                {done ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
              </span>
              {stage.label}
            </span>
            {i < STAGES.length - 1 && (
              <span
                className={cn(
                  "h-px w-3 transition-colors duration-500 sm:w-5",
                  done ? "bg-foreground/30" : "bg-white/10",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

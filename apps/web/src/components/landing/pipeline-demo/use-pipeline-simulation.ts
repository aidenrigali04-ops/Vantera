"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { DemoDataset } from "./sim-data";

/**
 * Sequences the Pipeline Theater through the real pipeline stages on a timeline.
 * Components read `phase`/`reached()` to reveal cumulative state. Honoring
 * reduced-motion jumps straight to the final state with no timers.
 */
export type Phase =
  | "idle"
  | "sourcing"
  | "gating"
  | "enriching"
  | "scoring"
  | "drafting"
  | "sending"
  | "crm"
  | "done";

export const PHASE_ORDER: Phase[] = [
  "idle",
  "sourcing",
  "gating",
  "enriching",
  "scoring",
  "drafting",
  "sending",
  "crm",
  "done",
];

// Paced deliberately slow so a first-time viewer can read each step as it runs.
const SEQUENCE: { phase: Phase; duration: number }[] = [
  { phase: "sourcing", duration: 2300 },
  { phase: "gating", duration: 2100 },
  { phase: "enriching", duration: 2500 },
  { phase: "scoring", duration: 2400 },
  { phase: "drafting", duration: 2800 },
  { phase: "sending", duration: 2300 },
  { phase: "crm", duration: 2100 },
  { phase: "done", duration: 0 },
];

export interface PipelineSimulation {
  dataset: DemoDataset | null;
  phase: Phase;
  phaseIndex: number;
  /** True once the timeline has advanced to (or past) the given phase. */
  reached: (phase: Phase) => boolean;
  isRunning: boolean;
  reducedMotion: boolean;
  run: (dataset: DemoDataset) => void;
}

export function usePipelineSimulation(): PipelineSimulation {
  const reduce = useReducedMotion() ?? false;
  const [dataset, setDataset] = useState<DemoDataset | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const run = useCallback(
    (ds: DemoDataset) => {
      clearTimers();
      setDataset(ds);
      if (reduce) {
        setPhase("done");
        return;
      }
      setPhase(SEQUENCE[0].phase);
      let acc = 0;
      for (let i = 0; i < SEQUENCE.length - 1; i++) {
        acc += SEQUENCE[i].duration;
        const next = SEQUENCE[i + 1].phase;
        timers.current.push(window.setTimeout(() => setPhase(next), acc));
      }
    },
    [clearTimers, reduce],
  );

  useEffect(() => clearTimers, [clearTimers]);

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const reached = useCallback(
    (p: Phase) => phaseIndex >= PHASE_ORDER.indexOf(p),
    [phaseIndex],
  );

  return {
    dataset,
    phase,
    phaseIndex,
    reached,
    isRunning: phase !== "idle" && phase !== "done",
    reducedMotion: reduce,
    run,
  };
}

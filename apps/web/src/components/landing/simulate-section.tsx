"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SearchBar } from "./pipeline-demo/search-bar";
import { StepSimulation } from "./pipeline-demo/step-simulation";
import { usePipelineSimulation } from "./pipeline-demo/use-pipeline-simulation";
import {
  DEFAULT_DATASET_ID,
  datasetForPreset,
  datasetForQuery,
} from "./pipeline-demo/sim-data";
import { WARM } from "./landing-theme";

/**
 * The scroll target for "Simulate agents". Typing or tapping an example only
 * fills the input — the run starts ONLY when "Simulate" is pressed, and the
 * simulation panel appears at that point (it is not shown by default).
 */
export function SimulateSection() {
  const sim = usePipelineSimulation();
  const [query, setQuery] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);

  // Typing clears any chosen preset so the run reflects the typed text.
  const handleChange = (v: string) => {
    setQuery(v);
    setPresetId(null);
  };

  // Chips fill the input only — they do not start the simulation.
  const handlePreset = (id: string, presetQuery: string) => {
    setQuery(presetQuery);
    setPresetId(id);
  };

  // The only trigger: pressing Simulate.
  const runSimulation = () => {
    if (presetId) sim.run(datasetForPreset(presetId));
    else sim.run(query.trim() ? datasetForQuery(query) : datasetForPreset(DEFAULT_DATASET_ID));
  };

  return (
    <section id="simulate" className="relative scroll-mt-24 px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: WARM.c2 }} />
          Live simulation
        </span>
        <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Type your buyer. Press Simulate.
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Describe a target audience and hit Simulate — the pipeline runs end to end on
          sample data: sourced, enriched, scored, and sequenced across every channel.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-6">
        <SearchBar value={query} onChange={handleChange} onSubmit={runSimulation} onPreset={handlePreset} />

        <AnimatePresence>
          {sim.dataset && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <StepSimulation sim={sim} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

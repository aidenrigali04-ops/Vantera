"use client";

import { useEffect, useRef, useState } from "react";
import { SearchBar } from "./search-bar";
import { PipelineTheater } from "./pipeline-theater";
import { usePipelineSimulation } from "./use-pipeline-simulation";
import {
  DEFAULT_DATASET_ID,
  datasetForPreset,
  datasetForQuery,
} from "./sim-data";

/**
 * Owns the simulation so the search bar and theater stay in sync. Datasets are
 * generated client-side only (deterministic seed) — no SSR/CSR drift, no API.
 * Auto-runs the default ICP on mount so there's never an empty state.
 */
export function LiveDemo() {
  const sim = usePipelineSimulation();
  const [query, setQuery] = useState("");
  const theaterRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sim.run(datasetForPreset(DEFAULT_DATASET_ID));
  }, [sim]);

  const scrollToTheater = () => {
    theaterRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleSubmit = () => {
    if (!query.trim()) return;
    sim.run(datasetForQuery(query));
    scrollToTheater();
  };

  const handlePreset = (id: string, presetQuery: string) => {
    setQuery(presetQuery);
    sim.run(datasetForPreset(id));
    scrollToTheater();
  };

  return (
    <div className="w-full space-y-8">
      <SearchBar value={query} onChange={setQuery} onSubmit={handleSubmit} onPreset={handlePreset} />
      <div ref={theaterRef} className="scroll-mt-24">
        <PipelineTheater sim={sim} />
      </div>
    </div>
  );
}

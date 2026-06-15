"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TextEffect } from "@/components/ui/text-effect";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { SearchBar } from "./pipeline-demo/search-bar";
import { StepSimulation } from "./pipeline-demo/step-simulation";
import { usePipelineSimulation } from "./pipeline-demo/use-pipeline-simulation";
import {
  DEFAULT_DATASET_ID,
  datasetForPreset,
  datasetForQuery,
} from "./pipeline-demo/sim-data";

/**
 * Interactive hero. The product's aha — describe a buyer, watch the agents run
 * the full pipeline — is the FIRST thing a visitor sees, not a scroll away. The
 * input lives in the hero; pressing Simulate reveals the live run just below and
 * scrolls to it. "Get started free" is the single commit CTA.
 */
export function Hero() {
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

  const runSimulation = () => {
    if (presetId) sim.run(datasetForPreset(presetId));
    else sim.run(query.trim() ? datasetForQuery(query) : datasetForPreset(DEFAULT_DATASET_ID));
    // Reveal the run and bring it into view.
    requestAnimationFrame(() =>
      document.getElementById("sim-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <section id="top" className="relative overflow-hidden px-4">
      <DottedSurface colorTheme="dark" contained />

      {/* First screen: the promise + the interactive demo, vertically centered. */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center pt-24 pb-12 text-center">
        <TextEffect
          as="h1"
          per="word"
          preset="blur"
          className="font-heading max-w-3xl text-4xl font-medium tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          Your next customers, found and contacted on autopilot.
        </TextEffect>

        {/* The promise resolves first (headline blur), then the demo + CTA rise as one block. */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Vantera&apos;s SDR agents prospect, enrich, score, and reach out across email, LinkedIn,
            and calls — handing you only high-fit leads, booked into your CRM. Describe your buyer to
            watch the pipeline run.
          </p>

          <div id="simulate" className="mt-10 w-full scroll-mt-28">
            <SearchBar
              value={query}
              onChange={handleChange}
              onSubmit={runSimulation}
              onPreset={handlePreset}
            />
          </div>

          <div className="mt-7 flex flex-col items-center gap-2">
            <Link
              href="/signup"
              className="rounded-[18px] bg-foreground px-6 py-2.5 text-[17.5px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground/70">
              No credit card to start
            </span>
          </div>
        </motion.div>
      </div>

      {/* The run reveals here on submit — sample data, the real pipeline stages. */}
      <div id="sim-results" className="relative z-10 mx-auto max-w-2xl scroll-mt-24 pb-24">
        <AnimatePresence>
          {sim.dataset && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-6 text-center">
                <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                  Live simulation · sample data
                </span>
              </div>
              <StepSimulation sim={sim} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

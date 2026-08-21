"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Info, TrendingUp, Users } from "lucide-react";
import { LandingHeading } from "@/components/landing/heading";
import { INSET_CARD_SHADOW } from "@/components/landing/viz";
import type { RoiContent } from "./types";

const OPP_RATE = 0.25; // meeting → opportunity
const HOURS_PER_REP = 10; // reclaimed per rep / week
const SDR_MEETINGS = 10; // qualified meetings one SDR books / month

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/**
 * ROI calculator — a live, honest business-impact model. Three sliders (reps, avg deal
 * size, meetings/rep/month) drive the outputs instantly: new qualified meetings, new
 * monthly pipeline, hours reclaimed, and the SDR-equivalent of output. The math and its
 * assumptions are stated in-panel — this is illustrative, not a promise.
 */
export function RoiCalculator({ content }: { content: RoiContent }) {
  const [reps, setReps] = useState(content.reps.default);
  const [dealSize, setDealSize] = useState(content.dealSize.default);
  const [meetings, setMeetings] = useState(content.meetings.default);

  const addedMeetings = reps * meetings;
  const newPipeline = addedMeetings * OPP_RATE * dealSize;
  const hoursWeek = reps * HOURS_PER_REP;
  const sdrEquivalent = Math.max(1, Math.round(addedMeetings / SDR_MEETINGS));

  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-14 grid max-w-5xl overflow-hidden rounded-[20px] border border-[#E6EAEE] bg-white lg:grid-cols-[minmax(0,1fr)_1.1fr]"
          style={{ boxShadow: INSET_CARD_SHADOW }}
        >
          {/* INPUTS */}
          <div className="border-b border-[#EFF2F5] p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">Your team</span>
            <div className="mt-6 flex flex-col gap-7">
              <Slider
                label={content.repsLabel ?? "Sales reps"}
                value={reps}
                display={`${reps}`}
                min={content.reps.min}
                max={content.reps.max}
                step={1}
                onChange={setReps}
              />
              <Slider
                label={content.dealSizeLabel ?? "Average deal size"}
                value={dealSize}
                display={formatUsd(dealSize)}
                min={content.dealSize.min}
                max={content.dealSize.max}
                step={content.dealSize.step}
                onChange={setDealSize}
              />
              <Slider
                label={content.meetings.label}
                value={meetings}
                display={`${meetings}`}
                min={content.meetings.min}
                max={content.meetings.max}
                step={1}
                onChange={setMeetings}
              />
            </div>
          </div>

          {/* OUTPUTS */}
          <div className="relative p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(60% 50% at 90% 0%, rgba(24,119,242,0.05) 0%, transparent 60%)" }}
            />
            <div className="relative">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--cyan-strong)]">
                Projected monthly impact
              </span>

              {/* headline output */}
              <div className="mt-5 rounded-2xl border border-[var(--cyan-line)] bg-[var(--cyan-tint)] p-5">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--cyan-strong)]">
                  <TrendingUp className="size-3.5" strokeWidth={2.4} />
                  {content.pipelineLabel ?? "New pipeline / month"}
                </div>
                <div className="mt-1.5 font-mono text-[2.6rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground sm:text-[3rem]">
                  {formatUsd(newPipeline)}
                </div>
                <div className="mt-1.5 text-[12px] text-[var(--ink-4)]">≈ {formatUsd(newPipeline * 12)} a year</div>
              </div>

              {/* secondary outputs */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <OutputTile
                  icon={<TrendingUp className="size-4" strokeWidth={2.2} />}
                  value={addedMeetings.toLocaleString()}
                  label={content.meetingsOutputLabel ?? "Qualified meetings / mo"}
                />
                <OutputTile
                  icon={<Clock className="size-4" strokeWidth={2.2} />}
                  value={`${hoursWeek}`}
                  label={content.hoursLabel ?? "Hours reclaimed / week"}
                />
              </div>

              {/* SDR-equivalent callout */}
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--tint)] p-4">
                <span className="grid size-10 flex-none place-items-center rounded-xl bg-white text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)] shadow-[var(--shadow-sm)]">
                  <Users className="size-5" strokeWidth={2} />
                </span>
                <p className="text-[13px] leading-snug text-[var(--ink-2)]">
                  About the output of{" "}
                  <span className="font-semibold text-foreground">
                    {sdrEquivalent} {content.equivalentUnit ?? "full-time SDRs"}
                  </span>{" "}
                  — {content.equivalentTail ?? "from the team you already have."}
                </p>
              </div>

              {/* assumptions */}
              <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--ink-4)]">
                <Info className="mt-px size-3 flex-none" strokeWidth={2.2} />
                {content.assumptions}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[13.5px] font-medium text-[var(--ink-2)]">{label}</span>
        <span className="font-mono text-[15px] font-semibold tabular-nums text-[var(--cyan-strong)]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#e6eaef] accent-[var(--fb)]"
      />
    </label>
  );
}

function OutputTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <span className="grid size-8 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
        {icon}
      </span>
      <div className="mt-3 font-mono text-[1.6rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] font-medium leading-snug text-[var(--ink-4)]">{label}</div>
    </div>
  );
}

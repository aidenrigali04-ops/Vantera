"use client";

import { motion } from "framer-motion";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts";
import { SectionHeading } from "./section-heading";
import { WARM } from "./landing-theme";

const DISTRIBUTION = [
  { band: "0–39", pct: 55, keep: false },
  { band: "40–69", pct: 30, keep: false },
  { band: "70–84", pct: 11, keep: true },
  { band: "85–100", pct: 4, keep: true },
];

const STATS = [
  { value: "70+", label: "score floor to send" },
  { value: "1:1", label: "personalized per prospect" },
  { value: "0", label: "templated messages" },
  { value: "100%", label: "sends compliance-checked" },
];

export function Outcomes() {
  return (
    <section id="outcomes" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="The point"
        title="Only the leads worth your time"
        subtitle="Most prospecting drowns reps in noise. Vantera's two-stage gate keeps the few leads with real fit and timing — and routes effort only there."
      />

      <div className="mx-auto mt-14 grid max-w-5xl items-stretch gap-4 lg:grid-cols-2">
        {/* Quality-gate chart */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-5"
        >
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="font-heading text-lg font-semibold text-foreground">The quality gate</h3>
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
              illustrative distribution
            </span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Of every 100 prospects sourced, only the top ~15 clear the gate and earn outreach.
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DISTRIBUTION} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="warmBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={WARM.c1} />
                    <stop offset="100%" stopColor={WARM.c3} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="band"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {DISTRIBUTION.map((d) => (
                    <Cell key={d.band} fill={d.keep ? "url(#warmBar)" : "rgba(255,255,255,0.08)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 font-mono text-[10px] tracking-wide text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-white/10" /> filtered out
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ backgroundColor: WARM.c2 }} /> sent (70+)
            </span>
          </div>
        </motion.div>

        {/* Stats + goal framing */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-4">
                <div
                  className="font-heading bg-clip-text text-3xl font-semibold text-transparent"
                  style={{ backgroundImage: `linear-gradient(135deg, ${WARM.c1}, ${WARM.c3})` }}
                >
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex-1 rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-5">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Every campaign tracks to your number
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Set a monthly revenue goal once, and the dashboard measures meetings booked and
              pipeline value against it — so progress is always visible, and so is the gap.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

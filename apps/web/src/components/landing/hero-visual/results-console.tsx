"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CalendarCheck, CornerUpLeft, TrendingUp, Radar, Users, Send, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "../vantera-logo";

/**
 * The hero's framed centerpiece — same frame/width/layout as the reference dashboard, but the
 * content is Vantera's LIVE results instead of a generic admin UI: a slim agent sidebar, a row of
 * result stat cards, and a streaming "wins" feed where the chart was. Representative sample activity
 * (honesty contract); the motion is the proof. Swap-in alternatives live alongside in hero-visual/.
 */

type Stage = "accepted" | "replied" | "booked";
interface Win {
  tag: string;
  role: string;
  company: string;
  stage: Stage;
}

const POOL: Win[] = [
  { tag: "VP", role: "VP of Engineering", company: "Seed-stage AI startup", stage: "booked" },
  { tag: "HG", role: "Head of Growth", company: "Series B fintech", stage: "replied" },
  { tag: "CR", role: "Chief Revenue Officer", company: "DevTools scale-up", stage: "accepted" },
  { tag: "CT", role: "CTO", company: "Healthtech, 50–200", stage: "replied" },
  { tag: "VP", role: "VP of Sales", company: "Vertical SaaS", stage: "booked" },
  { tag: "HP", role: "Head of Product", company: "Climate startup", stage: "accepted" },
  { tag: "FO", role: "Founder", company: "YC-backed, pre-seed", stage: "replied" },
  { tag: "DR", role: "Director of RevOps", company: "Series C marketplace", stage: "booked" },
];

const STAGE_META: Record<Stage, { label: string; icon: typeof Check }> = {
  accepted: { label: "accepted invite", icon: Check },
  replied: { label: "replied — interested", icon: CornerUpLeft },
  booked: { label: "booked a call", icon: CalendarCheck },
};

const NAV = [
  { icon: Radar, label: "Live Results", active: true },
  { icon: Users, label: "Scout" },
  { icon: Send, label: "Outreach" },
  { icon: Zap, label: "Intent" },
  { icon: TrendingUp, label: "Pipeline" },
];

const VISIBLE = 4;
const TICK_MS = 2400;
const row = (i: number): Win & { id: number } => ({ ...POOL[i % POOL.length]!, id: i });

export function ResultsConsole() {
  const [cursor, setCursor] = useState(VISIBLE);
  const [feed, setFeed] = useState<(Win & { id: number })[]>(() =>
    Array.from({ length: VISIBLE }, (_, i) => row(VISIBLE - 1 - i))
  );
  const [meetings, setMeetings] = useState(127);
  const [pipelineK, setPipelineK] = useState(842);

  useEffect(() => {
    const t = setInterval(() => {
      const next = row(cursor);
      setFeed((f) => [next, ...f].slice(0, VISIBLE));
      setCursor((c) => c + 1);
      if (next.stage === "booked") {
        setMeetings((m) => m + 1);
        setPipelineK((p) => p + 6 + (next.id % 5));
      }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [cursor]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b0c0f] shadow-2xl shadow-black/50">
      <div className="flex">
        {/* Sidebar — mirrors the reference layout, with Vantera's agents */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.07] p-4 lg:flex">
          <div className="flex items-center gap-2 px-1 pb-5">
            <VanteraLogo className="size-5 text-foreground" />
            <span className="font-heading text-sm font-semibold text-foreground">Vantera</span>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <span
                key={n.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                  n.active ? "bg-white/[0.07] text-foreground" : "text-muted-foreground"
                )}
              >
                <n.icon className="size-3.5" />
                {n.label}
                {n.active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
              </span>
            ))}
          </nav>
          <div className="mt-5 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            Workspace
          </div>
          <div className="mt-2 flex flex-col gap-0.5 px-2.5 text-[13px] text-muted-foreground">
            <span>Leads</span>
            <span>Replies</span>
            <span>CRM sync</span>
          </div>
        </aside>

        {/* Main — top bar, stat cards, live feed */}
        <div className="min-w-0 flex-1 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Results</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              San Francisco
            </span>
          </div>

          {/* Stat cards — same shape as the reference's four cards */}
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Meetings booked" value={meetings.toLocaleString()} delta="+12.5%" note="Trending up this month" />
            <StatCard label="Pipeline created" value={`$${pipelineK.toLocaleString()}k`} delta="+18%" note="From booked meetings" />
            <StatCard label="Acceptance rate" value="41%" delta="+4.5%" note="Invites accepted — safe pace" />
            <StatCard label="In-market now" value="7" live note="Buying signals on LinkedIn" />
          </div>

          {/* Live feed — where the chart was */}
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/70" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/80">
                Live activity · San Francisco
              </span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                Sample activity
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {feed.map((w) => {
                  const Icon = STAGE_META[w.stage].icon;
                  return (
                    <motion.div
                      key={w.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] font-mono text-[10px] font-medium text-foreground/85">
                        {w.tag}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{w.role}</p>
                        <p className="truncate text-xs text-muted-foreground">{w.company}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.1] px-2.5 py-1 text-[11px] text-foreground/80">
                        <Icon className="size-3" />
                        <span className="hidden sm:inline">{STAGE_META[w.stage].label}</span>
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  note,
  live,
}: {
  label: string;
  value: string;
  delta?: string;
  note: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {delta && (
          <span className="flex items-center gap-0.5 rounded-full bg-brand/15 px-1.5 py-0.5 font-mono text-[10px] text-brand">
            <TrendingUp className="size-2.5" />
            {delta}
          </span>
        )}
        {live && (
          <span className="font-mono text-[10px] uppercase tracking-wide text-brand">live</span>
        )}
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground/70">{note}</p>
    </div>
  );
}

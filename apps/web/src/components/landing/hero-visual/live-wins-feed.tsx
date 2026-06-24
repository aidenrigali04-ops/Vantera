"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CalendarCheck, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE } from "@/components/ui/panel";

/**
 * The hero centerpiece — a living "wins" feed instead of a generic product dashboard.
 * Anonymized LinkedIn outcomes stream in (accepted → replied → booked) under a
 * "Live Events in San Francisco" header, with running totals ticking up. Representative
 * sample activity (no real customer data — honesty contract); the motion is what sells it.
 *
 * Swap note: this is a self-contained <HeroVisual>. To try the alternative motion later,
 * drop in `./connection-thread` (ConnectionThread) where Hero renders <LiveWinsFeed />.
 */

type Stage = "accepted" | "replied" | "booked";

interface Win {
  tag: string; // avatar tag — a LinkedIn-ish role glyph
  role: string;
  company: string;
  stage: Stage;
}

// Anonymized roles + company *types* — no fabricated real people (honesty contract).
const POOL: Win[] = [
  { tag: "VP", role: "VP of Engineering", company: "Seed-stage AI startup", stage: "booked" },
  { tag: "HG", role: "Head of Growth", company: "Series B fintech", stage: "replied" },
  { tag: "CR", role: "Chief Revenue Officer", company: "DevTools scale-up", stage: "accepted" },
  { tag: "CT", role: "CTO", company: "Healthtech, 50–200", stage: "replied" },
  { tag: "VP", role: "VP of Sales", company: "Vertical SaaS", stage: "booked" },
  { tag: "HP", role: "Head of Product", company: "Climate startup", stage: "accepted" },
  { tag: "FO", role: "Founder", company: "YC-backed, pre-seed", stage: "replied" },
  { tag: "DR", role: "Director of RevOps", company: "Series C marketplace", stage: "booked" },
  { tag: "VP", role: "VP of Marketing", company: "Cybersecurity, 200+", stage: "accepted" },
  { tag: "HE", role: "Head of Engineering", company: "Fintech infra", stage: "replied" },
];

const STAGE_META: Record<Stage, { label: string; icon: typeof Check }> = {
  accepted: { label: "accepted your invite", icon: Check },
  replied: { label: "replied — interested", icon: CornerUpLeft },
  booked: { label: "booked a call", icon: CalendarCheck },
};

const VISIBLE = 4;
const TICK_MS = 2300;

function row(i: number): Win & { id: number } {
  return { ...POOL[i % POOL.length]!, id: i };
}

export function LiveWinsFeed() {
  // Deterministic initial window (SSR-safe), then it streams on the client.
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
        setPipelineK((p) => p + 6 + (next.id % 5)); // realistic per-meeting pipeline bump
      }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [cursor]);

  return (
    <div className={cn(PANEL_SURFACE, "mx-auto w-full max-w-lg overflow-hidden rounded-3xl p-5 text-left")}>
      {/* Live header — the "Live Events in San Francisco" beat */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/60" />
            <span className="relative inline-flex size-2 rounded-full bg-foreground" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/80">
            Live Events in San Francisco
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          Sample activity
        </span>
      </div>

      {/* The streaming feed */}
      <div className="mt-4 flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {feed.map((w) => {
            const Icon = STAGE_META[w.stage].icon;
            return (
              <motion.div
                key={w.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-mono text-[11px] font-medium text-foreground/85">
                  {w.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{w.role}</p>
                  <p className="truncate text-xs text-muted-foreground">{w.company}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-foreground/80">
                  <Icon className="size-3" />
                  {STAGE_META[w.stage].label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Running results — value made concrete */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-4">
        <Stat label="Meetings booked" value={meetings.toLocaleString()} />
        <Stat label="Pipeline created" value={`$${pipelineK.toLocaleString()}k`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">{label}</span>
    </div>
  );
}

"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── Calendar geometry ───────────────────────────────────────────────────── */
const HOURS = [9, 10, 11, 12, 13, 14]; // 9 AM → 2 PM rows
const ROW = 48; // px per hour
const GUTTER = 44; // px time-label column
const BODY_H = (HOURS.length - 1) * ROW + ROW * 0.45; // grid body height

const DAYS = [
  { label: "Tue", date: 16, today: false },
  { label: "Wed", date: 17, today: true },
  { label: "Thu", date: 18, today: false },
];

type Palette = { bar: string; bg: string; text: string };
const C: Record<string, Palette> = {
  cyan: { bar: "#30cfff", bg: "rgba(48,207,255,0.14)", text: "#0a7ca6" },
  fb: { bar: "#1877f2", bg: "rgba(24,119,242,0.12)", text: "#1559b3" },
  green: { bar: "#1aa45e", bg: "#e7f8ee", text: "#127a46" },
  violet: { bar: "#7c5cff", bg: "#efe9ff", text: "#6539c9" },
  amber: { bar: "#f2a01c", bg: "#fff3e0", text: "#a96a14" },
};

type Ev = {
  id: string;
  day: number; // column index 0..2
  start: number; // decimal hour, grid origin = 9
  duration: number; // hours
  title: string;
  client: string;
  time: string;
  kind: "video" | "place";
  color: Palette;
};

// Authored in reveal order so meetings "land" with a pleasing spatial rhythm.
// Columns never double-book, and every block is ≥1h so the label has room to breathe.
const EVENTS: Ev[] = [
  { id: "e1", day: 0, start: 9.5, duration: 1, title: "Discovery call", client: "Acme", time: "9:30 AM", kind: "video", color: C.cyan },
  { id: "e2", day: 1, start: 10.5, duration: 1, title: "Closing call", client: "Ramp", time: "10:30 AM", kind: "video", color: C.fb },
  { id: "e3", day: 2, start: 11.5, duration: 1, title: "Renewal review", client: "Northwind", time: "11:30 AM", kind: "video", color: C.amber },
  { id: "e4", day: 1, start: 12.5, duration: 1, title: "Product demo", client: "Vercel", time: "12:30 PM", kind: "video", color: C.green },
  { id: "e5", day: 0, start: 12, duration: 1, title: "Intro meeting", client: "Lattice", time: "12:00 PM", kind: "place", color: C.violet },
];

const STEP_MS = 760; // gap between events popping in
const HOLD_MS = 2600; // pause once the week is full before it replays

function hourLabel(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const display = h > 12 ? h - 12 : h;
  return `${display} ${ampm}`;
}

/**
 * Hero graphic — a live Google-Calendar week filling with booked client meetings.
 * Events pop in one by one on a loop (premium spring), reinforcing the product's
 * payoff: qualified outreach turns into meetings on your calendar. Self-contained,
 * honors prefers-reduced-motion, and is decorative (aria-hidden) — the heading
 * carries the page's semantic meaning.
 */
export const HeroCalendar = memo(function HeroCalendar({
  onBook,
  cardRef,
}: {
  /** Fires once each time a meeting books — drives the hero pipeline packet. */
  onBook?: () => void;
  /** Anchors the connector's right end to the calendar card. */
  cardRef?: React.Ref<HTMLDivElement>;
} = {}) {
  const reduce = useReducedMotion();
  // Start at 0 on both server and first client render (useReducedMotion is null on
  // the server) so there's no hydration mismatch; converge after mount below.
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (reduce) {
      // Reduced motion: show the full week, no loop. Deferred a frame so the first
      // client render still matches the server (count 0).
      const raf = requestAnimationFrame(() => {
        if (!cancelled) setCount(EVENTS.length);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setCount(0);
      EVENTS.forEach((_, i) => {
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setCount(i + 1);
            onBook?.();
          }, 420 + i * STEP_MS),
        );
      });
      timers.push(
        setTimeout(() => {
          if (!cancelled) run();
        }, 420 + EVENTS.length * STEP_MS + HOLD_MS),
      );
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduce, onBook]);

  const visible = EVENTS.slice(0, count);

  return (
    <div className="relative mx-auto w-full max-w-[424px]" aria-hidden>
      {/* soft cyan glow lifting the card */}
      <div
        className="pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 -z-10 rounded-[2.25rem] blur-2xl"
        style={{ background: "radial-gradient(60% 75% at 55% 30%, rgba(48,207,255,0.18), transparent 70%)" }}
      />

      <div
        ref={cardRef}
        className="overflow-hidden rounded-[18px] border border-[#E6EAEE] bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(16,24,32,.05), 0 18px 42px -20px rgba(16,24,32,.30)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-[8px] bg-white shadow-[0_1px_2px_rgba(16,24,32,.12)] ring-1 ring-[#EAEEF1]">
              <GoogleCalendarGlyph className="size-[18px]" />
            </span>
            <span className="text-[15.5px] font-semibold tracking-[-0.01em] text-[#0C1620]">
              June 2026
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <motion.span
              key={count}
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(48,207,255,0.12)] px-2.5 py-[5px] text-[11px] font-semibold tabular-nums text-[#0A7CA6]"
            >
              <span className="size-1.5 rounded-full bg-[#30CFFF] shadow-[0_0_8px_rgba(48,207,255,0.9)]" />
              {count} booked
            </motion.span>
            <span className="grid size-6 place-items-center rounded-[7px] text-[#9AA5AD] ring-1 ring-[#EEF1F4]">
              <ChevronLeft className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className="grid size-6 place-items-center rounded-[7px] text-[#9AA5AD] ring-1 ring-[#EEF1F4]">
              <ChevronRight className="size-3.5" strokeWidth={2.4} />
            </span>
          </div>
        </div>

        {/* ── Day header row ─────────────────────────────────────────────── */}
        <div className="flex border-b border-[#EFF2F5] px-2 pb-2">
          <div style={{ width: GUTTER }} className="flex-none" />
          <div className="flex flex-1">
            {DAYS.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9AA5AD]">
                  {d.label}
                </span>
                <span
                  className={
                    d.today
                      ? "grid size-[28px] place-items-center rounded-full bg-[var(--fb)] text-[13.5px] font-semibold tabular-nums text-white shadow-[0_4px_12px_-3px_rgba(24,119,242,0.6)]"
                      : "grid size-[28px] place-items-center text-[13.5px] font-medium tabular-nums text-[#3A444D]"
                  }
                >
                  {d.date}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Grid body ──────────────────────────────────────────────────── */}
        <div className="flex px-2 pb-3 pt-1">
          {/* time gutter */}
          <div className="relative flex-none" style={{ width: GUTTER, height: BODY_H }}>
            {HOURS.map((h, i) => (
              <span
                key={h}
                className="absolute right-2 text-[9.5px] font-medium tabular-nums text-[#AEB6BE]"
                style={{ top: i * ROW - 6 }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {/* day columns + events */}
          <div className="relative flex-1" style={{ height: BODY_H }}>
            {/* horizontal hour lines */}
            {HOURS.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-[#F1F4F6]"
                style={{ top: i * ROW }}
              />
            ))}
            {/* vertical column separators */}
            {[1, 2].map((c) => (
              <div
                key={c}
                className="absolute top-0 w-px bg-[#F4F6F8]"
                style={{ left: `${(c / 3) * 100}%`, height: BODY_H }}
              />
            ))}

            {/* "now" indicator on today's column (Wed), parked in the gap between meetings */}
            <div
              className="absolute z-10 flex items-center"
              style={{ left: "33.3333%", width: "33.3333%", top: (11.9 - 9) * ROW }}
            >
              <span className="-ml-[3px] size-[7px] rounded-full bg-[var(--fb)] shadow-[0_0_0_3px_rgba(24,119,242,0.18)]" />
              <span className="h-[1.5px] flex-1 rounded-full bg-[var(--fb)]" />
            </div>

            {/* events */}
            <AnimatePresence>
              {visible.map((ev, i) => {
                const top = (ev.start - 9) * ROW;
                const height = Math.max(ev.duration * ROW - 5, 38);
                const isLatest = i === visible.length - 1;
                const Icon = ev.kind === "video" ? Video : MapPin;
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, scale: 0.82, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                    transition={{ type: "spring", stiffness: 460, damping: 30, mass: 0.7 }}
                    className="group absolute z-20 overflow-hidden rounded-[10px]"
                    style={{
                      top,
                      height,
                      left: `calc(${(ev.day / 3) * 100}% + 3px)`,
                      width: `calc(${100 / 3}% - 6px)`,
                      background: ev.color.bg,
                      boxShadow: isLatest
                        ? `0 8px 18px -7px ${ev.color.bar}80, inset 3px 0 0 ${ev.color.bar}, inset 0 1px 0 rgba(255,255,255,0.55)`
                        : `inset 3px 0 0 ${ev.color.bar}, inset 0 1px 0 rgba(255,255,255,0.5)`,
                    }}
                  >
                    <div className="flex h-full flex-col justify-center gap-[3px] pl-[10px] pr-[7px]">
                      <span
                        className="truncate text-[11.5px] font-semibold leading-none tracking-[-0.01em]"
                        style={{ color: ev.color.text }}
                      >
                        {ev.client}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[10px] font-medium leading-none text-[#7A858E]">
                        <Icon className="size-[10px] flex-none" strokeWidth={2.2} style={{ color: ev.color.bar }} />
                        <span className="truncate">{ev.time}</span>
                      </span>
                    </div>
                    {/* fresh-booking pulse on the most recent meeting */}
                    {isLatest && (
                      <motion.span
                        className="absolute right-[5px] top-[5px] size-1.5 rounded-full"
                        style={{ background: ev.color.bar }}
                        animate={{ scale: [1, 1.7, 1], opacity: [0.9, 0.2, 0.9] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});

/* Google Calendar app glyph — the familiar "31" tile. Inlined (no brand-icon dep). */
function GoogleCalendarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#fff" d="M5 5h14v14H5z" />
      <path fill="#4285F4" d="M16.5 7.5h-9v9h9z" />
      <path fill="#34A853" d="M16.5 21l4.5-4.5h-4.5z" />
      <path fill="#FBBC04" d="M21 16.5V6a1.5 1.5 0 0 0-1.5-1.5H16.5v3H21z" />
      <path fill="#188038" d="M3 16.5V18a1.5 1.5 0 0 0 1.5 1.5h12V16.5z" />
      <path fill="#1967D2" d="M16.5 4.5h-12A1.5 1.5 0 0 0 3 6v10.5h4.5v-9h9z" />
      <path
        fill="#4285F4"
        d="M9.06 14.3c-.36 0-.66-.1-.9-.31a1.2 1.2 0 0 1-.43-.79l.86-.36c.05.32.26.49.56.49.16 0 .29-.05.39-.14.1-.09.15-.21.15-.35 0-.15-.06-.27-.17-.36-.11-.09-.26-.13-.43-.13h-.33v-.79h.3c.31 0 .53-.14.53-.42 0-.12-.04-.22-.13-.29a.49.49 0 0 0-.33-.11c-.25 0-.42.13-.48.38l-.85-.35c.07-.22.21-.41.43-.57.22-.16.49-.24.81-.24.36 0 .67.1.92.31.25.2.37.47.37.8 0 .35-.16.6-.46.77v.04c.18.07.32.18.44.34.11.16.17.34.17.55 0 .34-.13.61-.39.82-.26.2-.59.31-.99.31zm3.13-3.2-.94.68-.47-.71 1.69-1.22h.65v4.36h-.93z"
      />
    </svg>
  );
}

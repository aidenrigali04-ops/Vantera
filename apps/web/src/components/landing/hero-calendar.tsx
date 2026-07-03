"use client";

import { memo, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";

/* ── Brand hues ──────────────────────────────────────────────────────────────
   Official brand primaries; each event pill derives a calm tint + accent bar from
   its hue. Monochrome brands render as deep slate so they read as a colour, not a
   disabled state. */
const SLATE = "#334155";
const HUE: Record<string, string> = {
  Stripe: "#635BFF", Linear: "#5E6AD2", Webflow: "#4353FF", Figma: "#A259FF",
  Datadog: "#632CA6", Atlassian: "#0052CC", Dropbox: "#0061FF", Okta: "#007DC1",
  Intuit: "#0077C5", Amplitude: "#1E61F0", Intercom: "#1F8DED", Snowflake: "#29B5E8",
  Canva: "#00C4CC", Twilio: "#F22F46", DoorDash: "#FF3008", Airbnb: "#FF5A5F",
  Asana: "#FC636B", Brex: "#FF5C00", HubSpot: "#FF7A59", Ramp: "#C8A951",
  Shopify: "#95BF47", Naver: "#03C75A", Segment: "#52BD94", Scribd: "#1E7B85",
  Zendesk: "#03363D",
  Notion: SLATE, Vercel: SLATE, Uber: SLATE, Plaid: SLATE, Retool: SLATE,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = 17; // Wed, June 17 2026

// June 2026 begins on a Monday (no leading blanks) and has 30 days → one clean 5×7
// grid. Weekends stay open so the month reads calm, not packed. Only a couple of
// pills show per day (+N more), so density is implied rather than overwhelming.
const MONTH_EVENTS: Record<number, string[]> = {
  1: ["Stripe", "Notion", "Figma"],
  2: ["Shopify", "Twilio"],
  3: ["Okta", "Intuit", "Dropbox", "Webflow"],
  4: ["Linear", "Segment"],
  5: ["Atlassian", "Canva", "Ramp"],
  8: ["Datadog", "Brex"],
  9: ["HubSpot", "Naver", "Scribd"],
  10: ["Amplitude", "Intercom"],
  11: ["Airbnb", "Uber", "Plaid"],
  12: ["Snowflake", "Vercel"],
  15: ["Stripe", "Shopify", "Retool"],
  16: ["Linear", "Figma"],
  17: ["Okta", "Intuit", "Naver", "Dropbox", "Stripe"],
  18: ["Notion", "Figma", "Datadog"],
  19: ["Twilio", "Atlassian", "Canva"],
  22: ["Brex", "Ramp"],
  23: ["Segment", "Airbnb", "Intercom"],
  24: ["Amplitude", "Plaid"],
  25: ["Snowflake", "Uber", "Vercel"],
  26: ["HubSpot", "Scribd"],
  29: ["Stripe", "Linear", "Figma"],
  30: ["Datadog", "Shopify"],
};

const TOTAL = Object.values(MONTH_EVENTS).reduce((n, a) => n + a.length, 0); // 59

// 35 cells: June 1–30 then July 1–5 (muted next-month spill) → a filled 5-row grid.
const CELLS = Array.from({ length: 35 }, (_, i) => ({
  key: i,
  date: i < 30 ? i + 1 : i - 29,
  inMonth: i < 30,
  col: i % 7,
}));

// Recent weekly booked totals → the footer sparkline; ends at TOTAL so the two agree.
const PACE = [24, 30, 27, 38, 46, TOTAL];

/**
 * Hero graphic — a calm MONTHLY view of booked client meetings (June 2026). Each day
 * shows a couple of brand-tinted meeting pills with "+N more", today is marked, and a
 * footer sparkline tracks the booking pace — real, instrumented data-viz at the
 * hero-calendar depth without the wall-of-blocks density of a week view. The header
 * pill counts to 59 and the connector pipe gets a gentle packet via onBook. Self-
 * contained, honors prefers-reduced-motion, decorative (aria-hidden).
 */
export const HeroCalendar = memo(function HeroCalendar({
  onBook,
  cardRef,
}: {
  onBook?: () => void;
  cardRef?: React.Ref<HTMLDivElement>;
} = {}) {
  const reduce = useReducedMotion();
  const [booked, setBooked] = useState(0);

  // Deterministic initial ("hidden") so SSR/hydration match; reduced motion snaps in
  // instantly, otherwise a quick staggered spring fills the month.
  const containerV = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.012, delayChildren: reduce ? 0 : 0.15 } },
  };
  const cellV = {
    hidden: { opacity: 0, y: reduce ? 0 : 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.7 },
    },
  };

  // Count the "booked" pill up to 59 (instant under reduced motion).
  useEffect(() => {
    if (reduce) {
      const id = requestAnimationFrame(() => setBooked(TOTAL));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let start = 0;
    const dur = 1500;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setBooked(Math.round(TOTAL * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  // Gentle ongoing packet down the hero connector (no packets under reduced motion).
  useEffect(() => {
    if (reduce || !onBook) return;
    const first = setTimeout(() => onBook(), 900);
    const iv = setInterval(() => onBook(), 2800);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [reduce, onBook]);

  return (
    // Grows ~+1/3 rightward on lg (left edge fixed so the connector stays anchored);
    // capped so it keeps a small right margin and never overflows the viewport.
    <div className="relative w-full lg:w-[calc(50vw_-_58px)] lg:max-w-[680px]" aria-hidden>
      {/* soft cyan glow lifting the card */}
      <div
        className="pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 -z-10 rounded-[2.25rem] blur-2xl"
        style={{ background: "radial-gradient(60% 75% at 55% 30%, rgba(24,119,242,0.18), transparent 70%)" }}
      />

      <div
        ref={cardRef}
        className="overflow-hidden rounded-[18px] border border-[#E6EAEE] bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(16,24,32,.04), 0 10px 26px -12px rgba(16,24,32,.12)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-[8px] bg-white shadow-[0_1px_2px_rgba(16,24,32,.12)] ring-1 ring-[#EAEEF1]">
              <GoogleCalendarGlyph className="size-[18px]" />
            </span>
            <span className="text-[15.5px] font-semibold tracking-[-0.01em] text-[#0C1620]">June 2026</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.12)] px-2.5 py-[5px] text-[11px] font-semibold tabular-nums text-[#1461d1]">
              <span className="size-1.5 rounded-full bg-[#1877f2]" />
              {booked} booked
            </span>
            <span className="grid size-6 place-items-center rounded-[7px] text-[#9AA5AD] ring-1 ring-[#EEF1F4]">
              <ChevronLeft className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className="grid size-6 place-items-center rounded-[7px] text-[#9AA5AD] ring-1 ring-[#EEF1F4]">
              <ChevronRight className="size-3.5" strokeWidth={2.4} />
            </span>
          </div>
        </div>

        {/* ── Weekday header ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-7 border-b border-[#EFF2F5] px-2 pb-2 pt-0.5">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={
                "text-center text-[10px] font-semibold uppercase tracking-[0.08em] " +
                (i >= 5 ? "text-[#C4CBD2]" : "text-[#9AA5AD]")
              }
            >
              {w}
            </div>
          ))}
        </div>

        {/* ── Month grid ─────────────────────────────────────────────────── */}
        <div className="px-2 pt-1.5 pb-2">
          <motion.div
            className="grid grid-cols-7 overflow-hidden rounded-[10px] border-l border-t border-[#F1F4F6]"
            initial="hidden"
            animate="show"
            variants={containerV}
          >
            {CELLS.map((cell) => {
              const events = cell.inMonth ? MONTH_EVENTS[cell.date] ?? [] : [];
              const isToday = cell.inMonth && cell.date === TODAY;
              const isWeekend = cell.col >= 5;
              const shown = events.slice(0, 2);
              const extra = events.length - shown.length;
              return (
                <motion.div
                  key={cell.key}
                  variants={cellV}
                  className={
                    "relative flex min-h-[74px] flex-col border-b border-r border-[#F1F4F6] px-1.5 pb-2 pt-1.5 " +
                    (isToday
                      ? "bg-[rgba(24,119,242,0.045)]"
                      : !cell.inMonth
                        ? "bg-[#FCFCFD]"
                        : isWeekend
                          ? "bg-[#FBFCFD]"
                          : "")
                  }
                >
                  <span
                    className={
                      isToday
                        ? "grid size-[21px] place-items-center rounded-full bg-[var(--fb)] text-[11.5px] font-semibold tabular-nums leading-none text-white shadow-[0_3px_8px_-2px_rgba(24,119,242,0.6)]"
                        : "px-0.5 text-[12px] font-medium tabular-nums leading-none " +
                          (cell.inMonth ? "text-[#3A444D]" : "text-[#C4CBD2]")
                    }
                  >
                    {cell.date}
                  </span>

                  <div className="mt-1.5 flex flex-col gap-[3px]">
                    {shown.map((brand, idx) => (
                      <EventPill key={`${brand}-${idx}`} brand={brand} />
                    ))}
                    {extra > 0 && (
                      <span className="pl-1 text-[9px] font-semibold leading-none text-[var(--ink-4)]">
                        +{extra} more
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── Footer — booking-pace trend ────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 border-t border-[#EFF2F5] px-4 pb-3.5 pt-3">
          <div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#9AA5AD]">
              Booking pace
            </div>
            <div className="mt-1.5">
              <PaceSparkline />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(24,119,242,0.1)] px-2 py-[3px] text-[11px] font-semibold tabular-nums text-[#1461d1]">
              <TrendingUp className="size-3" strokeWidth={2.6} />
              38%
            </span>
            <span className="text-[10px] text-[#9AA5AD]">vs. last month</span>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── One brand-tinted meeting pill in a day cell ─────────────────────────────── */
function EventPill({ brand }: { brand: string }) {
  const hue = HUE[brand] ?? SLATE;
  return (
    <span
      className="flex items-center gap-1.5 overflow-hidden rounded-[4px] py-[2.5px] pl-1 pr-1.5"
      style={{ background: `${hue}1f`, boxShadow: `inset 2px 0 0 ${hue}` }}
    >
      <span className="size-1.5 flex-none rounded-full" style={{ background: hue }} />
      <span className="truncate text-[9.5px] font-semibold leading-none tracking-[-0.01em] text-[#334155]">
        {brand}
      </span>
    </span>
  );
}

/* ── Footer sparkline — a small blue area+line of the recent booking pace. ────── */
function PaceSparkline() {
  const reduce = useReducedMotion();
  const W = 116;
  const H = 34;
  const P = 3;
  const max = Math.max(...PACE);
  const min = Math.min(...PACE);
  const x = (i: number) => P + (i / (PACE.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / (max - min)) * (H - 2 * P);
  const line = PACE.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(PACE.length - 1).toFixed(1)} ${H - P} L${x(0).toFixed(1)} ${H - P} Z`;
  const lastX = x(PACE.length - 1);
  const lastY = y(PACE[PACE.length - 1]);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="vc-pace-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1877f2" stopOpacity="0.2" />
          <stop offset="1" stopColor="#1877f2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#vc-pace-fill)" />
      <motion.path
        d={line}
        fill="none"
        stroke="#1877f2"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 1.1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={lastX} cy={lastY} r="2.6" fill="#1877f2" />
      <circle cx={lastX} cy={lastY} r="5" fill="#1877f2" fillOpacity="0.16" />
    </svg>
  );
}

/* Google Calendar app logo — the official multi-colour "31" mark (vector, no asset dep). */
function GoogleCalendarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <path fill="#fff" d="M152 45.455H48v109.09h104z" />
      <path fill="#EA4335" d="M152 200l48-48h-48z" />
      <path fill="#FBBC04" d="M152 45.455h48V152h-48z" />
      <path fill="#34A853" d="M48 152h104v48H48z" />
      <path fill="#188038" d="M0 152v33.333C0 193.55 6.45 200 14.667 200H48v-48z" />
      <path fill="#1967D2" d="M200 48V14.667C200 6.45 193.55 0 185.333 0H152v48z" />
      <path fill="#4285F4" d="M152 0H14.667C6.45 0 0 6.45 0 14.667V152h48V48h104z" />
      <path
        fill="#4285F4"
        d="M68.514 121.02c-3.99-2.696-6.751-6.632-8.256-11.83l9.02-3.716c.838 3.194 2.301 5.669 4.389 7.424 2.075 1.755 4.603 2.62 7.557 2.62 3.02 0 5.615-.918 7.783-2.753 2.168-1.836 3.259-4.176 3.259-7.006 0-2.897-1.145-5.263-3.432-7.098-2.288-1.835-5.157-2.753-8.583-2.753h-5.213v-8.929h4.68c2.953 0 5.443-.798 7.464-2.394 2.022-1.596 3.033-3.777 3.033-6.552 0-2.474-.905-4.443-2.713-5.92-1.809-1.475-4.097-2.22-6.878-2.22-2.714 0-4.87.719-6.472 2.168-1.601 1.45-2.766 3.23-3.418 5.32l-8.929-3.71c1.078-3.06 3.06-5.766 5.96-8.108 2.9-2.34 6.605-3.518 11.1-3.518 3.326 0 6.32.639 8.968 1.928 2.647 1.29 4.727 3.073 6.226 5.34 1.5 2.28 2.242 4.83 2.242 7.663 0 2.89-.696 5.336-2.088 7.348-1.39 2.011-3.1 3.551-5.13 4.635v.532c2.673 1.117 4.862 2.82 6.585 5.108 1.71 2.288 2.571 5.024 2.571 8.216 0 3.193-.81 6.048-2.432 8.55-1.622 2.5-3.869 4.475-6.71 5.9-2.853 1.43-6.06 2.152-9.622 2.152-4.126.013-7.936-1.17-11.42-3.5zM137.31 78.633l-9.912 7.164-4.965-7.524 17.816-12.85h6.826v60.646h-9.79z"
      />
    </svg>
  );
}

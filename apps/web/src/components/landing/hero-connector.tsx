"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * The plays shown in the conduit's play card — REAL starter-play names, mirroring
 * STARTER_PLAYS in @vantera/agent-brains (packages/agent-brains/src/plays/starter.ts);
 * keep in sync by hand (marketing copy never imports the brains package into the client
 * bundle). Label-only on purpose: no performance numbers here until real ones exist
 * (honesty rule, spec 2026-07-14).
 */
const PLAY_NAMES = ["The trigger opener", "The problem-first note", "The direct ask"];
/** Swap the play label every Nth booking — the "keeps upgrading" beat, kept unhurried. */
const SWAP_EVERY = 3;

type Geo = { sx: number; sy: number; ex: number; ey: number; w: number; h: number; pillBottom: number | null };

type Props = {
  sectionRef: React.RefObject<HTMLElement | null>;
  linkedinRef: React.RefObject<HTMLSpanElement | null>;
  /** the headline's "knows what works" pill — the play chip docks in the band below it */
  pillRef: React.RefObject<HTMLSpanElement | null>;
  calendarRef: React.RefObject<HTMLDivElement | null>;
  /** Increments once per booked meeting — fires one packet down the pipe. */
  bookTick: number;
};

const BEND = 0.42; // bezier control-handle reach as a fraction of the horizontal span

/** Sample the same cubic bezier the stroke draws, for the packet's keyframe path. */
function sampleBezier(g: Geo, n = 22) {
  const dx = (g.ex - g.sx) * BEND;
  const p = [
    [g.sx, g.sy],
    [g.sx + dx, g.sy],
    [g.ex - dx, g.ey],
    [g.ex, g.ey],
  ];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    xs.push(a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0]);
    ys.push(a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]);
  }
  return { xs, ys };
}

/**
 * The "pipeline" — a single hairline conduit drawn from the hero's LinkedIn icon-card
 * to the Google-Calendar mockup, telling the story that LinkedIn is what fills the
 * calendar with booked meetings. Endpoints are measured live (the icon is em-sized to
 * an h1 whose font-size jumps across breakpoints, so the line must be measured, not
 * guessed). One slow gradient flow + one packet per real booking — restraint over a
 * light show. lg+ only; honors prefers-reduced-motion. Decorative (aria-hidden), sits
 * behind the content so it emerges from behind the icon and tucks into the calendar.
 */
export function HeroConnector({ sectionRef, linkedinRef, pillRef, calendarRef, bookTick }: Props) {
  const reduce = useReducedMotion();
  const [geo, setGeo] = useState<Geo | null>(null);
  const rafRef = useRef(0);
  // The play card's label rotates through the real starter plays as bookings flow — the
  // hero's third node: LinkedIn → the proven play (Vera) → the booked calendar.
  const playIdx = reduce ? 0 : Math.floor(bookTick / SWAP_EVERY) % PLAY_NAMES.length;

  useEffect(() => {
    const measure = () => {
      const s = sectionRef.current;
      const a = linkedinRef.current;
      const b = calendarRef.current;
      if (!s || !a || !b) return setGeo(null);
      if (window.innerWidth < 1024) return setGeo(null); // single-column below lg
      const S = s.getBoundingClientRect();
      const A = a.getBoundingClientRect();
      const B = b.getBoundingClientRect();
      const sx = A.right - S.left + 1; // +1 tucks the line under the icon's border
      const sy = A.top - S.top + A.height / 2;
      const ex = B.left - S.left;
      const ey = B.top - S.top + B.height / 2;
      if (ex <= sx + 24) return setGeo(null); // crossed / stacked / nonsensical
      const P = pillRef.current?.getBoundingClientRect() ?? null;
      const pillBottom = P ? P.bottom - S.top : null;
      setGeo({ sx, sy, ex, ey, w: S.width, h: S.height, pillBottom });
    };
    const schedule = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    let alive = true;
    const guarded = () => {
      if (alive) schedule();
    };

    schedule();
    // Poppins is a webfont — the em-sized icon is mismeasured at fallback width until it loads.
    document.fonts?.ready.then(guarded).catch(() => {});
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    if (sectionRef.current) ro.observe(sectionRef.current);
    if (linkedinRef.current) ro.observe(linkedinRef.current);
    const mq = window.matchMedia("(min-width: 1024px)");
    mq.addEventListener("change", schedule);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      mq.removeEventListener("change", schedule);
    };
  }, [sectionRef, linkedinRef, pillRef, calendarRef]);

  // Path + packet keyframes, recomputed only when the measured geometry changes.
  const path = useMemo(() => {
    if (!geo) return null;
    const dx = (geo.ex - geo.sx) * BEND;
    const d = `M ${geo.sx} ${geo.sy} C ${geo.sx + dx} ${geo.sy} ${geo.ex - dx} ${geo.ey} ${geo.ex} ${geo.ey}`;
    return { d, ...sampleBezier(geo) };
  }, [geo]);

  if (!geo || !path) return null;

  const { d, xs, ys } = path;

  return (
    <svg
      width={geo.w}
      height={geo.h}
      className="pointer-events-none absolute inset-0 z-[15] hidden lg:block"
      aria-hidden
      fill="none"
    >
      <defs>
        <linearGradient id="vc-flow-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1877f2" />
          <stop offset="0.55" stopColor="#1877f2" />
          <stop offset="1" stopColor="#1877f2" />
        </linearGradient>
        <filter id="vc-line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="vc-packet-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* soft halo so the hairline reads as a lit conduit, not a stray line */}
      <path d={d} stroke="#1877f2" strokeOpacity={0.16} strokeWidth={7} strokeLinecap="round" filter="url(#vc-line-glow)" />

      {/* static base conduit — always physically touches both anchors */}
      <path d={d} stroke="#1877f2" strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" />

      {/* one slow flow, drifting LinkedIn → calendar */}
      <path
        d={d}
        stroke="url(#vc-flow-grad)"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeDasharray={reduce ? undefined : "10 14"}
        className={reduce ? undefined : "vc-flow-line"}
      />

      {/* ports — the pipe plugs into the LinkedIn icon and into the calendar */}
      <circle cx={geo.sx} cy={geo.sy} r={3.2} fill="#1877f2" />
      <circle cx={geo.ex} cy={geo.ey} r={3} fill="#1877f2" stroke="#fff" strokeWidth={1.5} />

      {/* one luminous packet per booked meeting — drawn BEFORE the play card so each packet
          visibly passes through it (under the card, out the other side) */}
      {!reduce && (
        <motion.circle
          key={`${bookTick}-${Math.round(geo.sx)}-${Math.round(geo.ex)}`}
          r={4}
          fill="#1877f2"
          filter="url(#vc-packet-glow)"
          initial={{ cx: xs[0], cy: ys[0], opacity: 0 }}
          animate={{ cx: xs, cy: ys, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      )}

      {/* The play chip — the conduit's intelligence node: LinkedIn → Vera's proven play →
          the booked calendar. Docked in the MEASURED whitespace band between the headline
          pill and the subhead (never guessed — the band exists at every lg+ width), right-
          anchored toward the calendar port so the pipe visibly threads through it. The
          label rotates through the real starter plays as bookings pass. Label-only: no
          invented stats (honesty rule, spec 2026-07-14). */}
      {(() => {
        if (geo.pillBottom == null) return null;
        const CHIP_W = 292; // fits the longest play name ("The problem-first note") untruncated
        const CHIP_H = 28;
        const cy = geo.pillBottom + 5; // top of the band, 5px under the pill
        const cx = Math.min(geo.ex - 14, geo.w - 24) - CHIP_W; // right edge short of the port
        if (cx < 24 || cy + CHIP_H > geo.ey + 120) return null; // no sane pocket → skip cleanly
        return (
          <foreignObject x={cx} y={cy} width={CHIP_W} height={CHIP_H} className="overflow-visible">
            <div className="flex h-full items-center gap-2 rounded-full border border-[var(--hairline)] bg-white pl-2.5 pr-1 shadow-[var(--shadow-card)]">
              <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
                <span className="absolute inline-flex size-full rounded-full bg-[var(--cyan)]/50 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[var(--cyan)]" />
              </span>
              <span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.13em] text-[var(--ink-4)]">
                Vera&apos;s play
              </span>
              <span className="relative h-[14px] min-w-0 flex-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={playIdx}
                    initial={reduce ? false : { opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -7 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-x-0 truncate text-[10.5px] font-semibold leading-[14px] tracking-[-0.01em] text-[#0C1620]"
                  >
                    {PLAY_NAMES[playIdx]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="shrink-0 rounded-full bg-[var(--cyan-tint)] px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(24,119,242,0.22)]">
                proven
              </span>
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}

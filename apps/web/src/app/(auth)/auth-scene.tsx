"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, MessageCircle } from "lucide-react";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { cn } from "@/lib/utils";

/**
 * The auth page's right-hand panel: what Vantera hands you, after rankbox.xyz's AI
 * search scene. Over the painted sky from the landing showcase, warm LinkedIn replies
 * land one after another: a typing bubble first, then the reply itself with what it
 * turned into ("Meeting booked", "Interested"). The newest sits on top and the stack
 * keeps three, letting the oldest go as the next one starts typing.
 *
 * Sample prospects, purely decorative (aria-hidden). The loop runs only while the panel
 * is on screen, holds while it is hovered, and reduced motion shows a still stack.
 */

type Outcome = "Meeting booked" | "Interested";

type Reply = {
  initials: string;
  name: string;
  role: string;
  tint: string;
  text: string;
  outcome: Outcome;
};

const REPLIES: Reply[] = [
  {
    initials: "RN",
    name: "Rachel Nguyen",
    role: "VP Sales · Northwind",
    tint: "#1877f2",
    text: "Yes, this is exactly what we're fixing. Free Thursday?",
    outcome: "Meeting booked",
  },
  {
    initials: "MF",
    name: "Marcus Feld",
    role: "Head of Growth · Lumen",
    tint: "#5e6ad2",
    text: "What's the link? I'll grab a slot now.",
    outcome: "Meeting booked",
  },
  {
    initials: "AO",
    name: "Aisha Okafor",
    role: "Founder · Brightlane",
    tint: "#0f9d6e",
    text: "Timely. Can you show me how it works?",
    outcome: "Interested",
  },
  {
    initials: "LR",
    name: "Luis Ramos",
    role: "Head of Sales · Meridian",
    tint: "#0c9fce",
    text: "We still prospect by hand and it's eating my week. Pricing for a team of 3?",
    outcome: "Interested",
  },
  {
    initials: "PN",
    name: "Priya Nair",
    role: "COO · Fieldnote",
    tint: "#c2557d",
    text: "Happy to chat after the talk. Wednesday work for you?",
    outcome: "Meeting booked",
  },
];

/** How many replies the stack shows, and the age printed on each, newest first. */
const VISIBLE = 3;
const AGES = ["now", "2m", "7m"];

/* Expo-out: a quick move that spends most of its time settling. */
const SETTLE = [0.16, 1, 0.3, 1] as const;

/** One reply on screen: `key` stays unique when the same reply comes round again. */
type Slot = { key: number; idx: number };

/* What the server paints, and the first frame: two replies already in. */
const FIRST: Slot[] = [
  { key: 1, idx: 1 },
  { key: 0, idx: 0 },
];

/* Reduced motion: a still, full stack. */
const STILL: Slot[] = [
  { key: 2, idx: 2 },
  { key: 1, idx: 1 },
  { key: 0, idx: 0 },
];

/* ---------- the pixel field ---------- */

/* Seeded PRNG (mulberry32): the field is identical on server and client. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Pixels sit on an invisible 24px lattice centred in the panel, so they line up with
   one another; each brightens and fades on its own clock (`hero-pixel` in
   globals.css, which also pins them faint and still under reduced motion). */
const CELL = 24;
const COLS = 32;
const rand = seeded(2026);
const PIXELS = Array.from({ length: 44 }, () => ({
  col: Math.floor(rand() * COLS),
  row: Math.floor(rand() * 44),
  peak: 0.08 + rand() * 0.16,
  duration: 4 + rand() * 5,
  delay: rand() * 7,
  accent: rand() < 0.25,
}));

function Sky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#1563d6]">
      {/* The landing showcase's painted sky, so sign-up continues the picture. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a decorative backdrop at a fixed size; next/image buys nothing here */}
      <img
        src="/landing/painting.webp"
        alt=""
        width={2200}
        height={1400}
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: COLS * CELL }}>
        {PIXELS.map((p, i) => (
          <span
            key={i}
            className={cn("hero-pixel absolute", p.accent ? "bg-[#9cc2ff]" : "bg-white")}
            style={
              {
                left: p.col * CELL + 1,
                top: p.row * CELL + 1,
                width: CELL - 1,
                height: CELL - 1,
                "--pixel-max": p.accent ? p.peak * 1.6 : p.peak,
                "--pixel-dur": `${p.duration.toFixed(1)}s`,
                "--pixel-delay": `${p.delay.toFixed(2)}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- the pieces ---------- */

function Avatar({ reply, className }: { reply: Reply; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: reply.tint }}
    >
      {reply.initials}
    </span>
  );
}

const OUTCOME_STYLE: Record<Outcome, { cls: string; Icon: typeof CalendarCheck }> = {
  "Meeting booked": { cls: "bg-[#e3f5ea] text-[#13824a]", Icon: CalendarCheck },
  Interested: { cls: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]", Icon: MessageCircle },
};

/** What the reply turned into. It pops in a beat after its card lands. */
function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const { cls, Icon } = OUTCOME_STYLE[outcome];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: SETTLE, delay: 0.45 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] font-semibold",
        cls,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} />
      {outcome}
    </motion.span>
  );
}

function ReplyCard({ reply, age, fresh }: { reply: Reply; age: string; fresh: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-4 shadow-[0_18px_40px_-16px_rgba(3,22,70,0.55)] ring-1 transition-[box-shadow] duration-500",
        fresh ? "ring-[rgba(24,119,242,0.35)]" : "ring-black/5",
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar reply={reply} className="size-9 text-[0.72rem]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-[0.88rem] font-semibold text-foreground">{reply.name}</p>
            <span className="ml-auto shrink-0 text-[0.7rem] tabular-nums text-[var(--ink-4)]">
              {age}
            </span>
          </div>
          <p className="truncate text-[0.74rem] text-[var(--ink-3)]">{reply.role}</p>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-2 text-[0.86rem] leading-[1.55] text-foreground/85">
        {reply.text}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <OutcomeChip outcome={reply.outcome} />
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.68rem] font-medium text-[var(--ink-4)]">
          <LinkedinMark className="size-3 text-[#0a66c2]" />
          Reply on LinkedIn
        </span>
      </div>
    </div>
  );
}

/** The "… is typing" bubble that comes before each reply. */
function TypingBubble({ reply }: { reply: Reply }) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-[0_14px_32px_-14px_rgba(3,22,70,0.55)] ring-1 ring-black/5">
      <Avatar reply={reply} className="size-7 text-[0.62rem]" />
      <span className="text-[0.78rem] font-medium text-foreground">
        {reply.name.split(" ")[0]} is typing
      </span>
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-[var(--fb)]"
            animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </span>
    </div>
  );
}

/* ---------- the scene ---------- */

export function AuthScene({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);
  /* Which reply arrives next, and the next unique key. A ref, so a restart (the panel
     scrolling out of view and back) carries on instead of reusing a key on screen. */
  const counter = useRef({ next: 2, key: 2 });
  const reduce = useReducedMotion();
  const [onScreen, setOnScreen] = useState(false);
  const [stack, setStack] = useState<Slot[]>(FIRST);
  const [typing, setTyping] = useState<number | null>(null);

  // Only animate while visible: the panel is hidden below lg, so phones never run it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen || reduce) return;

    let alive = true;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    // Holds the loop while the pointer rests on the panel.
    const hold = async () => {
      while (alive && hovered.current) await wait(200);
    };

    async function run() {
      const c = counter.current;
      await wait(1100);
      while (alive) {
        await hold();
        if (!alive) return;
        // The next sender starts typing; the oldest reply makes room for them.
        setTyping(c.next);
        setStack((s) => s.slice(0, VISIBLE - 1));
        await wait(1600);
        await hold();
        if (!alive) return;
        // The reply lands on top.
        const slot = { key: c.key++, idx: c.next };
        setTyping(null);
        setStack((s) => [slot, ...s].slice(0, VISIBLE));
        c.next = (c.next + 1) % REPLIES.length;
        await wait(3000);
      }
    }

    void run();
    return () => {
      alive = false;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [onScreen, reduce]);

  const shown = reduce ? STILL : stack;
  const typingNow = reduce ? null : typing;

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={ref}
        aria-hidden
        onPointerEnter={() => {
          hovered.current = true;
        }}
        onPointerLeave={() => {
          hovered.current = false;
        }}
        className={cn("relative isolate overflow-hidden", className)}
      >
        <Sky />

        {/* A fixed-height stage, centred, so the panel never re-centres as cards come
            and go: the chips row on top, then room for three replies. */}
        <div className="absolute left-1/2 top-1/2 h-[35rem] w-[min(86%,27rem)] -translate-x-1/2 -translate-y-1/2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-2.5 pr-3 text-[0.78rem] font-medium text-foreground shadow-[0_10px_24px_-12px_rgba(3,22,70,0.5)]">
              <LinkedinMark className="size-3.5 text-[#0a66c2]" />
              Your LinkedIn inbox
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[0.75rem] font-medium text-white ring-1 ring-inset ring-white/30 backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#4ade80] opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#4ade80]" />
              </span>
              Agent live
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false} mode="popLayout">
              {typingNow !== null && (
                <motion.li
                  key={`typing-${typingNow}`}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.45, ease: SETTLE }}
                >
                  <TypingBubble reply={REPLIES[typingNow]} />
                </motion.li>
              )}
              {shown.map((slot, i) => (
                <motion.li
                  key={slot.key}
                  layout
                  initial={{ opacity: 0, y: -18, scale: 0.97, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    y: 14,
                    scale: 0.96,
                    filter: "blur(4px)",
                    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                  }}
                  transition={{ duration: 0.6, ease: SETTLE }}
                >
                  <ReplyCard reply={REPLIES[slot.idx]} age={AGES[i] ?? "8m"} fresh={i === 0} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </MotionConfig>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MoreHorizontal, Search, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkedinMark } from "./brand-glyphs";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Thread = {
  id: string;
  initials: string;
  name: string;
  /** Preview line, prefixed with the sender's first name — LinkedIn's native format. */
  preview: string;
  when: string;
  tint: string; // avatar fill (white initials on top)
  online?: boolean;
  unread?: boolean;
};

/* Warm replies only — every preview is a buying signal, and the first two are the
   exact motives the traffic arrives with (get the booking link, grab a slot).
   Names continue the page's cast (Rachel Nguyen already appears in showcase.tsx). */
const THREADS: Thread[] = [
  {
    id: "rn",
    initials: "RN",
    name: "Rachel Nguyen",
    preview: "Rachel: Confirmed — where's the booking link?",
    when: "2m",
    tint: "#1877f2",
    online: true,
    unread: true,
  },
  {
    id: "mf",
    initials: "MF",
    name: "Marcus Feld",
    preview: "Marcus: What's the link? I'll grab a slot now.",
    when: "14m",
    tint: "#5E6AD2",
    online: true,
    unread: true,
  },
  {
    id: "ao",
    initials: "AO",
    name: "Aisha Okafor",
    preview: "Aisha: Yes, this is timely — Thursday works.",
    when: "1h",
    tint: "#0f9d6e",
    unread: true,
  },
  {
    id: "dp",
    initials: "DP",
    name: "Devon Price",
    preview: "Devon: Booked Tuesday 10:30. See you then.",
    when: "3h",
    tint: "#d97706",
    online: true,
  },
  {
    id: "lr",
    initials: "LR",
    name: "Luis Ramos",
    preview: "Luis: Interested — send over the details.",
    when: "Tue",
    tint: "#0C9FCE",
  },
  {
    id: "pn",
    initials: "PN",
    name: "Priya Nair",
    preview: "Priya: Looping in our VP Ops for the call.",
    when: "Mon",
    tint: "#c2557d",
  },
];

const TICK_MS = 2600;

/* LinkedIn's presence green. */
const PRESENCE = "#01754f";

/**
 * The hero's right-hand visual: a LinkedIn-native Messaging inbox filling with warm
 * replies. Purely decorative (aria-hidden, zero focusable nodes) — the URL form stays
 * the hero's single CTA. A white/blue conic-gradient ring spins around one message
 * card at a time and travels to the next on a fixed beat (framer layoutId slides it);
 * reduced motion pins the ring to the first card, static.
 */
export function HeroConversations({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % THREADS.length), TICK_MS);
    return () => clearInterval(t);
  }, [reduce, paused]);

  return (
    <div
      className={cn(
        "relative w-full lg:ml-auto lg:w-[calc(50vw_-_98px)] lg:max-w-[580px]",
        className,
      )}
      aria-hidden
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* soft white lift so the card reads as floating on the blue slab
          (visible because the hero <section> is isolate) */}
      <div
        className="pointer-events-none absolute -inset-x-6 -bottom-8 -top-5 -z-10 rounded-[2rem] blur-2xl"
        style={{
          background: "radial-gradient(60% 70% at 50% 30%, rgba(255,255,255,0.20), transparent 72%)",
        }}
      />

      <div
        className="overflow-hidden rounded-[18px] border border-white/60 bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.7), 0 2px 6px rgba(3,22,58,.16), 0 34px 64px -26px rgba(3,22,58,.50)",
        }}
      >
        {/* header — LinkedIn Messaging pane: title, search, overflow + compose */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <LinkedinMark className="size-[20px] shrink-0 text-[var(--fb)]" />
          <span className="shrink-0 text-[16.5px] font-semibold tracking-[-0.01em] text-[#0C1620]">
            Messaging
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[6px] bg-[#EDF3F8] px-3 py-[9px]">
            <Search className="size-3.5 shrink-0 text-[#56687a]" strokeWidth={2.2} />
            <span className="truncate text-[12.5px] text-[#56687a]">Search messages</span>
          </div>
          <MoreHorizontal className="size-4 shrink-0 text-[var(--ink-3)]" strokeWidth={2} />
          <SquarePen className="size-4 shrink-0 text-[var(--ink-3)]" strokeWidth={2} />
        </div>

        {/* filter pills — native register; the count pill carries the bookings motive */}
        <div className="flex items-center gap-2 border-b border-[#EFF2F5] px-5 pb-3.5 pt-0.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#01754f] px-3.5 py-[6px] text-[12px] font-semibold text-white">
            Inbox
            <ChevronDown className="size-3" strokeWidth={2.6} />
          </span>
          <span className="rounded-full border border-[rgba(12,16,26,0.28)] px-3.5 py-[5px] text-[12px] font-semibold text-[var(--ink-3)]">
            Unread
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.12)] px-3 py-[6px] text-[12px] font-semibold tabular-nums text-[#1461d1]">
            <span className="size-1.5 rounded-full bg-[#1877f2]" />
            24 booked this week
          </span>
        </div>

        {/* message cards — individual, with the spinning ring on the active one */}
        <div className="flex flex-col gap-2.5 p-4">
          {THREADS.map((t, i) => {
            const on = i === index;
            return (
              <div key={t.id} className="relative">
                {/* white/blue gradient borderline: an oversized conic square spins
                    inside this clipped 1.5px frame; layoutId slides the frame from
                    card to card, one at a time. The mask hollows the frame to just
                    the border band, so mid-flight it's a thin traveling outline —
                    never a filled gradient block (the card only covers it at rest). */}
                {on && (
                  <motion.div
                    layoutId="hc-ring"
                    transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                    className="absolute -inset-[1.5px] overflow-hidden rounded-[14.5px]"
                    style={{
                      padding: 1.5,
                      WebkitMask:
                        "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      maskComposite: "exclude",
                    }}
                  >
                    <div className="absolute left-1/2 top-1/2 aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2">
                      <div
                        className="hc-ring-spin size-full"
                        style={{
                          background:
                            "conic-gradient(from 0deg, #1877f2 0deg, #7db4f8 80deg, #ffffff 150deg, #ffffff 185deg, #7db4f8 250deg, #1877f2 360deg)",
                        }}
                      />
                    </div>
                  </motion.div>
                )}

                <div
                  className={cn(
                    "relative flex items-center gap-3.5 rounded-[13px] border bg-white p-3.5 transition-shadow duration-300",
                    on
                      ? "border-transparent shadow-[0_8px_24px_-10px_rgba(24,119,242,0.45)]"
                      : "border-[var(--hairline)]",
                  )}
                >
                  <span className="relative shrink-0">
                    <span
                      className="grid size-12 place-items-center rounded-full text-[14.5px] font-semibold text-white shadow-[0_2px_6px_rgba(16,24,32,0.18)]"
                      style={{ backgroundColor: t.tint }}
                    >
                      {t.initials}
                    </span>
                    {t.online && (
                      <span
                        className="absolute -bottom-px -right-px size-3.5 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: PRESENCE }}
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-foreground">
                        {t.name}
                      </span>
                      <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-[var(--ink-4)]">
                        {t.when}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 truncate text-[12.5px]",
                        t.unread ? "font-medium text-[var(--ink-2)]" : "text-[var(--ink-3)]",
                      )}
                    >
                      {t.preview}
                    </p>
                  </div>

                  {t.unread && <span className="size-2.5 shrink-0 rounded-full bg-[var(--fb)]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

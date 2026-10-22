"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, ChevronDown, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "./vantera-logo";
import { LinkedinMark } from "./brand-glyphs";

/**
 * The product, at real density: Vantera's Inbox inside the app's top-chrome
 * shell (Today · Approvals · Inbox · Prospects · Playbook). Warm replies sit
 * on the left; the open thread on the right shows the opener the agent wrote,
 * the prospect's reply, and the agent's answer, sent on autopilot.
 *
 * It runs its own loop: a ring travels down the list and the thread pane
 * follows it, one conversation every few seconds. Hovering holds it. `still`
 * (and reduced motion) pins the first thread. Purely decorative: aria-hidden,
 * nothing focusable. Sample data.
 */

type Tag = "Interested" | "Question" | "Booked";

type Thread = {
  initials: string;
  name: string;
  role: string;
  tint: string;
  fit: number;
  tag: Tag;
  when: string;
  signal: string;
  opener: string;
  reply: string;
  answer: string;
};

const THREADS: Thread[] = [
  {
    initials: "RN",
    name: "Rachel Nguyen",
    role: "VP Sales · Northwind",
    tint: "#1877f2",
    fit: 94,
    tag: "Interested",
    when: "2m",
    signal: "Posted about rebuilding pipeline · 3d",
    opener:
      "Hi Rachel, your post on rebuilding pipeline after the reorg stuck with me. We help teams like Northwind book first meetings from LinkedIn without adding SDRs. Worth a quick look?",
    reply: "Confirmed. Where's the booking link?",
    answer:
      "Here's my calendar. Tuesday 10:30 or Wednesday 2:00 both work on our side, and I'll send the invite as soon as you pick.",
  },
  {
    initials: "MF",
    name: "Marcus Feld",
    role: "Head of Growth · Lumen",
    tint: "#5e6ad2",
    fit: 91,
    tag: "Interested",
    when: "14m",
    signal: "Hiring two SDRs · 6d",
    opener:
      "Marcus, saw Lumen is hiring two SDRs. Teams at that stage usually hit a ramp gap first. Happy to share how two of them closed it?",
    reply: "What's the link? I'll grab a slot now.",
    answer: "Great. Here's my calendar; Thursday morning is wide open if that suits.",
  },
  {
    initials: "AO",
    name: "Aisha Okafor",
    role: "Founder · Brightlane",
    tint: "#0f9d6e",
    fit: 89,
    tag: "Interested",
    when: "1h",
    signal: "Raised a seed round · 2w",
    opener:
      "Congrats on the seed, Aisha. Founders at your stage tell us outbound is the first thing that slips. We keep it running in minutes a day.",
    reply: "Yes, this is timely. Thursday works.",
    answer: "Thursday it is. Does 11:00 or 3:00 your time suit you better?",
  },
  {
    initials: "LR",
    name: "Luis Ramos",
    role: "Head of Sales · Meridian",
    tint: "#0c9fce",
    fit: 88,
    tag: "Question",
    when: "Tue",
    signal: "Hired a first AE · 9d",
    opener:
      "Congrats on the first AE hire, Luis. Most teams hit a hand-off gap right at that stage. Happy to share what worked for two teams like yours.",
    reply: "Interested. What does pricing look like for a team of 3?",
    answer:
      "Happy to walk you through it. Most teams your size start on Starter. Want the breakdown before a call?",
  },
  {
    initials: "DP",
    name: "Devon Price",
    role: "Sales Director · Orbital",
    tint: "#d97706",
    fit: 87,
    tag: "Booked",
    when: "3h",
    signal: "Engaged with an outbound post · 4d",
    opener:
      "Devon, your comment on outbound tooling was spot on. We built Vantera so every message is read before it sends. Open to comparing notes?",
    reply: "Booked Tuesday 10:30. See you then.",
    answer: "See you Tuesday, Devon. I'll bring the two examples we talked about.",
  },
  {
    initials: "PN",
    name: "Priya Nair",
    role: "COO · Fieldnote",
    tint: "#c2557d",
    fit: 90,
    tag: "Interested",
    when: "Mon",
    signal: "Expanding to a second market · 1w",
    opener:
      "Priya, congrats on the second market. Opening a new region usually means a cold pipeline. We help teams warm it up from LinkedIn.",
    reply: "Looping in our VP Ops for the call.",
    answer: "Thanks, Priya. I'll add them to the invite. Does the same time still work?",
  },
];

const TICK_MS = 3400;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TAG_STYLE: Record<Tag, string> = {
  Interested: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
  Question: "bg-[#fdf3dc] text-[#9a6a00]",
  Booked: "bg-[#e3f5ea] text-[#13824a]",
};

const NAV = ["Today", "Approvals", "Inbox", "Prospects", "Playbook"];

function Avatar({ t, size = "md" }: { t: Thread; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        size === "md" ? "size-9 text-[12px]" : "size-8 text-[11px]",
      )}
      style={{ backgroundColor: t.tint }}
    >
      {t.initials}
    </span>
  );
}

export function AppReplica({ still = false, className }: { still?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const ringId = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const moving = !still && !reduce;

  useEffect(() => {
    if (!moving || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % THREADS.length), TICK_MS);
    return () => clearInterval(t);
  }, [moving, paused]);

  const active = THREADS[index];

  return (
    <div
      aria-hidden
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className={cn(
        "select-none overflow-hidden rounded-[14px] border border-white/70 bg-[#f7f8fa] text-left shadow-[0_2px_6px_rgba(3,22,58,0.16),0_40px_80px_-32px_rgba(3,22,58,0.55)]",
        className,
      )}
    >
      {/* top chrome band — the app's real shell */}
      <div className="flex h-14 items-center gap-3 border-b border-[var(--hairline)] bg-white px-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--fb)]">
          <VanteraLogo className="size-[18px] text-white" />
        </span>
        <span className="hidden items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink-2)] sm:inline-flex">
          Northwind
          <ChevronDown className="size-3 text-[var(--ink-4)]" strokeWidth={2.4} />
        </span>
        <span className="mx-auto hidden items-center gap-0.5 rounded-full border border-[var(--hairline)] bg-[#f4f6f9] p-1 md:flex">
          {NAV.map((n) => (
            <span
              key={n}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium",
                n === "Inbox"
                  ? "bg-white text-[var(--fb)] shadow-[0_1px_2px_rgba(12,16,26,0.08)]"
                  : "text-[var(--ink-3)]",
              )}
            >
              {n}
            </span>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-1.5 md:ml-0">
          {[Search, Bell, Settings].map((Icon, i) => (
            <span
              key={i}
              className="hidden size-8 place-items-center rounded-lg border border-[var(--hairline)] bg-white text-[var(--ink-3)] sm:grid"
            >
              <Icon className="size-3.5" strokeWidth={2} />
            </span>
          ))}
          <span className="grid size-8 place-items-center rounded-full bg-[#e8ebf0] text-[11px] font-semibold text-[var(--ink-2)]">
            JK
          </span>
        </span>
      </div>

      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Inbox</p>
          <p className="mt-0.5 text-[12px] text-[var(--ink-4)]">Replies sorted warm first</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[var(--ink-3)] sm:inline-flex">
            <span className="size-1.5 rounded-full bg-[#13a05a]" />
            Agent live
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cyan-tint)] px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-[var(--cyan-strong)]">
            24 booked this week
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-5 pb-5 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        {/* thread list */}
        <div className="rounded-xl border border-[var(--hairline)] bg-white">
          <div className="flex items-center gap-1 border-b border-[var(--hairline)] px-3 py-2">
            {["All", "Interested", "Questions", "Booked"].map((f, i) => (
              <span
                key={f}
                className={cn(
                  "rounded-md px-2 py-1 text-[11.5px] font-medium",
                  i === 0 ? "bg-[#f1f3f6] text-foreground" : "text-[var(--ink-4)]",
                )}
              >
                {f}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1 p-2">
            {THREADS.map((t, i) => {
              const on = i === index;
              return (
                <div key={t.name} className="relative">
                  {/* the travelling ring: an oversized conic square spins inside
                      a clipped 1.5px frame; layoutId slides the frame from row
                      to row. The mask hollows it to just the border band. */}
                  {on && (
                    <motion.div
                      layoutId={ringId}
                      transition={{ duration: moving ? 0.45 : 0, ease: EASE }}
                      className="absolute -inset-px overflow-hidden rounded-[11px]"
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
                          className={cn("size-full", moving && "hc-ring-spin")}
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
                      "relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors duration-300",
                      on ? "bg-[#f5f9ff]" : "bg-white",
                    )}
                  >
                    <Avatar t={t} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-foreground">
                          {t.name}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-px text-[10px] font-semibold",
                            TAG_STYLE[t.tag],
                          )}
                        >
                          {t.tag}
                        </span>
                        <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-[var(--ink-4)]">
                          {t.when}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] text-[var(--ink-3)]">{t.reply}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* open thread */}
        <div className="relative hidden min-h-[392px] overflow-hidden rounded-xl border border-[var(--hairline)] bg-white md:block">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.name}
              initial={moving ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={moving ? { opacity: 0, y: -6 } : undefined}
              transition={{ duration: 0.28, ease: EASE }}
              className="flex h-full flex-col"
            >
              <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
                <Avatar t={active} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{active.name}</p>
                  <p className="truncate text-[11px] text-[var(--ink-4)]">{active.role}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--cyan-tint)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--cyan-strong)]">
                  {active.fit} fit
                </span>
                <LinkedinMark className="size-4 shrink-0 text-[var(--fb)]" />
              </div>

              <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[#fbfcfe] px-2 py-0.5 text-[10.5px] font-medium text-[var(--ink-3)]">
                  <span className="size-1 rounded-full bg-[var(--fb)]" />
                  {active.signal}
                </span>
                {/* the agent's opener */}
                <div className="ml-auto max-w-[86%] rounded-[12px] rounded-br-[4px] bg-[#eef4fe] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
                  {active.opener}
                </div>
                <div className="max-w-[80%] rounded-[12px] rounded-bl-[4px] bg-[#f1f3f6] px-3 py-2 text-[11.5px] leading-relaxed text-foreground">
                  {active.reply}
                </div>

                {/* the agent's answer, sent on autopilot */}
                <div className="mt-auto flex flex-col items-end gap-1.5">
                  <div className="max-w-[86%] rounded-[12px] rounded-br-[4px] bg-[var(--fb)] px-3 py-2 text-[11.5px] leading-relaxed text-white">
                    {active.answer}
                  </div>
                  <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--cyan-strong)]">
                    <Sparkles className="size-3" strokeWidth={2.4} />
                    Replied on autopilot · just now
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

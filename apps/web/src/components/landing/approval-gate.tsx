"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, MousePointer2, Pencil, X } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { ProductFrame } from "./product-frame";
import { FrameGlow, Mark, SectionIntro } from "./section-intro";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * S2 · The approval gate (02/05) — "Is this going to spam people in my name?"
 * The category's open lane: nobody sells control on the second screen. Split 7/5 with
 * a live Approvals embed cycling approve → edit → decline (2,800ms per state, pauses
 * on hover/touch, reduced-motion pins state one). The closing line states the truth
 * of the product's send modes: review is the default; full-auto is opt-in and flagged
 * drafts still route back to review (rule 08).
 */

type Stage = "approve" | "edit" | "decline";
const STAGES: Stage[] = ["approve", "edit", "decline"];
const STAGE_MS = 2800;

const CARDS: Record<
  Stage,
  { initials: string; name: string; role: string; fit: number; signal: string; draft: React.ReactNode }
> = {
  approve: {
    initials: "MC",
    name: "Maya Chen",
    role: "Head of Growth · Northwind",
    fit: 91,
    signal: "Posted about pipeline pain · 3d",
    draft: (
      <>
        Hi Maya — your post on building repeatable pipeline without an SDR is exactly the problem we
        work on. Worth a short chat?
      </>
    ),
  },
  edit: {
    initials: "LR",
    name: "Luis Ramos",
    role: "Head of Sales · Meridian",
    fit: 88,
    signal: "Hiring first AE · 9d",
    draft: (
      <>
        Hi Luis — congrats on the first AE hire. Most teams hit a{" "}
        <motion.span
          initial={{ backgroundColor: "rgba(24,119,242,0)" }}
          animate={{ backgroundColor: "rgba(24,119,242,0.14)" }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="rounded-[3px] px-0.5"
        >
          hand-off gap
        </motion.span>{" "}
        right at that stage — happy to share what worked for two teams like yours.
      </>
    ),
  },
  decline: {
    initials: "PB",
    name: "Piotr Novak",
    role: "Ops Manager · Cadence",
    fit: 72,
    signal: "Engaged with outbound content · 2w",
    draft: (
      <>Hi Piotr — saw your comment on outbound tooling. We help teams book more from LinkedIn…</>
    ),
  },
};

const STAGE_META: Record<Stage, { label: string; hint: string }> = {
  approve: { label: "Approved · sends inside today's pacing window", hint: "Approve" },
  edit: { label: "Edited inline · your words, then approved", hint: "Edit" },
  decline: { label: "Declined · never sends, logged with a reason", hint: "Decline" },
};

function ApprovalsEmbed({ paused }: { paused: boolean }) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>("approve");

  useEffect(() => {
    if (reduce || paused) return;
    const t = setInterval(() => {
      setStage((s) => STAGES[(STAGES.indexOf(s) + 1) % STAGES.length]);
    }, STAGE_MS);
    return () => clearInterval(t);
  }, [reduce, paused]);

  const c = CARDS[stage];
  const meta = STAGE_META[stage];

  return (
    <div aria-hidden>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {/* prospect strip */}
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] text-[12px] font-bold text-[#475569]">
              {c.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-foreground">{c.name}</p>
              <p className="truncate text-[11.5px] text-[var(--ink-4)]">{c.role}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--cyan-tint)] px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
              {c.fit} fit
            </span>
          </div>

          {/* evidence chip */}
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[#fbfcfe] px-2.5 py-1 text-[10.5px] font-medium text-[var(--ink-3)]">
              <span className="size-1 rounded-full bg-[var(--cyan)]" />
              {c.signal}
            </span>
          </div>

          {/* the draft */}
          <div
            className={cn(
              "mt-3 rounded-xl border p-3.5 transition-colors",
              stage === "edit"
                ? "border-[var(--cyan-line)] bg-[rgba(24,119,242,0.04)]"
                : "border-[var(--hairline)] bg-[#f6faff]",
            )}
          >
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{c.draft}</p>
          </div>

          {/* outcome line */}
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 1.4, duration: 0.3 }}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[var(--cyan-strong)]"
          >
            <span className="size-1.5 rounded-full bg-[var(--cyan)]" />
            {meta.label}
          </motion.p>
        </motion.div>
      </AnimatePresence>

      {/* action bar — the real queue's three actions; active one highlighted */}
      <div className="mt-4 flex items-center gap-1.5 border-t border-[var(--hairline)] pt-3.5">
        {(
          [
            { key: "approve", icon: Check, label: "Approve" },
            { key: "edit", icon: Pencil, label: "Edit" },
            { key: "decline", icon: X, label: "Decline" },
          ] as const
        ).map((a) => (
          <span
            key={a.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-semibold transition-all duration-300",
              stage === a.key
                ? "bg-[var(--fb-strong)] text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.5)]"
                : "border border-[var(--hairline)] bg-white text-[var(--ink-3)]",
            )}
          >
            <a.icon className="size-3" strokeWidth={2.6} />
            {a.label}
          </span>
        ))}
        <span className="ml-auto text-[10.5px] tabular-nums text-[var(--ink-4)]">1 of 3</span>
      </div>
    </div>
  );
}

export function ApprovalGate() {
  const [paused, setPaused] = useState(false);

  return (
    <section id="approvals" className="relative bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionIntro
          index="02"
          label="Approvals"
          title={
            <>
              An SDR that shows you every message <Mark>first</Mark>.
            </>
          }
          lead="Vantera drafts. Nothing goes out that you didn't read."
        />

        <div className="mt-10 rounded-[28px] bg-[#F6FAFF] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* LEFT — the live Approvals embed, sitting on a queue deck + blue pool */}
          <Reveal>
            <RevealItem
              className="relative pt-4"
              onPointerEnter={() => setPaused(true)}
              onPointerLeave={() => setPaused(false)}
            >
              <FrameGlow />
              {/* two card edges peeking out above the frame — the rest of the queue */}
              <div
                aria-hidden
                className="absolute inset-x-7 top-0 h-10 rounded-t-2xl border border-b-0 border-[var(--hairline)] bg-white/60"
              />
              <div
                aria-hidden
                className="absolute inset-x-3.5 top-2 h-10 rounded-t-2xl border border-b-0 border-[var(--hairline)] bg-white/85"
              />
              <div className="relative">
                {/* the concept's floating cursor — the "this is live product" cue */}
                <MousePointer2
                  aria-hidden
                  className="absolute bottom-9 right-8 z-10 size-6 -rotate-12 text-[var(--fb)] drop-shadow-[0_3px_6px_rgba(3,22,58,0.35)]"
                  fill="currentColor"
                  strokeWidth={1}
                />
                <ProductFrame
                  label="Approvals · 3 to review"
                  meta={
                    paused ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                        Paused
                      </span>
                    ) : undefined
                  }
                >
                  <ApprovalsEmbed paused={paused} />
                </ProductFrame>
              </div>
            </RevealItem>
          </Reveal>

          {/* RIGHT — the argument */}
          <div>
            <Reveal className="flex flex-col gap-5">
              {[
                {
                  icon: Check,
                  head: "Approve",
                  text: "One click — it sends at a safe, human pace.",
                },
                {
                  icon: Pencil,
                  head: "Edit",
                  text: "Rewrite inline — the words that send are yours.",
                },
                {
                  icon: X,
                  head: "Decline",
                  text: "What misses never sends.",
                },
              ].map((b) => (
                <RevealItem key={b.head} className="flex items-start gap-3.5">
                  {/* keycap — the review queue's three actions as physical keys */}
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[var(--hairline)] bg-white text-[var(--cyan-strong)] shadow-[0_2px_0_var(--hairline),var(--shadow-sm)]">
                    <b.icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
                    <span className="font-semibold text-foreground">{b.head}.</span> {b.text}
                  </p>
                </RevealItem>
              ))}
            </Reveal>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6 }}
              className="mt-8 border-t border-[var(--hairline)] pt-6 text-[15.5px] font-medium leading-relaxed text-foreground"
            >
              Review is the default. Full-auto is opt-in — anything off routes back to you.
            </motion.p>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

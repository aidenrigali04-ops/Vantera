"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Pencil, SkipForward, Sparkles } from "lucide-react";
import { LandingHeading } from "@/components/landing/heading";
import { INSET_CARD_SHADOW, StatusDot } from "@/components/landing/viz";
import type { ReviewDraft, ReviewShowcaseContent } from "./types";
import { cn } from "@/lib/utils";

type Status = "pending" | "approved" | "skipped";

/**
 * Interactive review queue — the product surface a rep lives in, made real. The left rail
 * lists drafted messages (fit-scored); selecting one opens the detail pane with the
 * in-market signal that triggered it, the ai_insights behind it, the drafted message, and
 * Approve / Edit / Skip. Approving or skipping advances to the next pending draft. Fully
 * client-side and deterministic on first paint (first draft selected, all pending).
 */
export function ReviewQueueShowcase({ content }: { content: ReviewShowcaseContent }) {
  const reduce = useReducedMotion();
  const drafts = content.drafts;
  const [selected, setSelected] = useState(0);
  const [statuses, setStatuses] = useState<Status[]>(() => drafts.map(() => "pending"));
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});

  const pending = statuses.filter((s) => s === "pending").length;
  const approved = statuses.filter((s) => s === "approved").length;

  function advance(from: number) {
    const next = drafts.findIndex((_, i) => i !== from && statuses[i] === "pending");
    if (next !== -1) setSelected(next);
  }
  function setStatus(i: number, s: Status) {
    setStatuses((prev) => prev.map((p, idx) => (idx === i ? s : p)));
    setEditing(false);
    advance(i);
  }

  const draft = drafts[selected];
  const message = edits[selected] ?? draft.message;

  return (
    <section id="review" className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-[20px] border border-[#E6EAEE] bg-white"
          style={{ boxShadow: INSET_CARD_SHADOW }}
        >
          {/* header */}
          <div className="flex items-center gap-3 border-b border-[#EFF2F5] px-5 py-3.5">
            <span className="grid size-7 place-items-center rounded-[8px] bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
              <Sparkles className="size-[15px]" strokeWidth={2} />
            </span>
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#0C1620]">Review queue</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-tint)] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                <StatusDot size="sm" pulse />
                {pending} pending
              </span>
              {approved > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eafaf0] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#1a9e4b]">
                  <Check className="size-3" strokeWidth={2.8} />
                  {approved} approved
                </span>
              )}
            </span>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,296px)_1fr]">
            {/* LEFT — draft list */}
            <div className="border-b border-[#EFF2F5] p-2.5 lg:border-b-0 lg:border-r">
              <div className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1.5 lg:overflow-visible">
                {drafts.map((d, i) => (
                  <DraftRow
                    key={d.name}
                    draft={d}
                    status={statuses[i]}
                    active={i === selected}
                    onClick={() => {
                      setSelected(i);
                      setEditing(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT — detail pane */}
            <div className="p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* prospect header */}
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-11 flex-none place-items-center rounded-full text-[13px] font-bold leading-none text-white shadow-[0_2px_6px_rgba(16,24,32,0.18)]"
                      style={{ background: draft.tint }}
                    >
                      {draft.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#0F172A]">
                        {draft.name}
                      </div>
                      <div className="truncate text-[12.5px] text-[#64748B]">
                        {draft.role} · {draft.company}
                      </div>
                    </div>
                    <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[var(--cyan-tint)] px-2.5 py-1 text-[12px] font-bold tabular-nums text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                      {draft.fit} fit
                    </span>
                  </div>

                  {/* in-market signal */}
                  <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[#FBFCFD] px-3.5 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusDot size="sm" pulse />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                        In-market signal
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-snug text-[#475569]">{draft.signal}</p>
                  </div>

                  {/* ai_insights chips */}
                  <div className="mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                      Why this lead
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {draft.insights.map((ins) => (
                        <span
                          key={ins.label}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-2.5 py-1 text-[11.5px] shadow-[var(--shadow-sm)]"
                        >
                          <span className="font-semibold uppercase tracking-[0.04em] text-[var(--cyan-strong)]">
                            {ins.label}
                          </span>
                          <span className="text-[var(--ink-3)]">{ins.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* drafted message */}
                  <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                        Drafted message
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eafaf0] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#1a9e4b]">
                        <Check className="size-2.5" strokeWidth={3} />
                        reads human
                      </span>
                    </div>
                    {editing ? (
                      <textarea
                        value={message}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [selected]: e.target.value }))}
                        rows={4}
                        className="w-full resize-none rounded-lg border border-[var(--cyan-line)] bg-white px-3 py-2 text-[13px] leading-relaxed text-[#0F172A] outline-none focus:border-[var(--fb)] focus:shadow-[0_0_0_3px_rgba(24,119,242,0.14)]"
                      />
                    ) : (
                      <p className="text-[13.5px] leading-relaxed text-[#334155]">{message}</p>
                    )}
                  </div>

                  {/* actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setStatus(selected, "approved")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_12px_-6px_rgba(24,119,242,0.5)] transition-all hover:bg-[#1461d1] active:scale-[0.98]"
                    >
                      <Check className="size-3.5" strokeWidth={2.6} />
                      Approve &amp; send
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing((e) => !e)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                        editing
                          ? "border-[var(--cyan-line)] bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
                          : "border-[var(--hairline)] bg-white text-[var(--ink-2)] hover:border-[var(--cyan-line)]",
                      )}
                    >
                      <Pencil className="size-3.5" strokeWidth={2.2} />
                      {editing ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(selected, "skipped")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
                    >
                      <SkipForward className="size-3.5" strokeWidth={2.2} />
                      Skip
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <p className="mx-auto mt-6 max-w-xl text-center text-[13px] text-[var(--ink-4)]">
          Try it — approve, edit, or skip a draft. In the product, nothing sends until you do.
        </p>
      </div>
    </section>
  );
}

function DraftRow({
  draft,
  status,
  active,
  onClick,
}: {
  draft: ReviewDraft;
  status: Status;
  active: boolean;
  onClick: () => void;
}) {
  const done = status !== "pending";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[220px] flex-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all lg:min-w-0",
        active
          ? "bg-[var(--cyan-tint)] ring-1 ring-inset ring-[var(--cyan-line)]"
          : "ring-1 ring-inset ring-transparent hover:bg-[var(--tint)]",
      )}
    >
      <span
        className={cn(
          "grid size-8 flex-none place-items-center rounded-full text-[11px] font-bold leading-none text-white shadow-[0_1px_2px_rgba(16,24,32,0.18)]",
          done && "opacity-45",
        )}
        style={{ background: draft.tint }}
      >
        {draft.initials}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span
          className={cn(
            "block truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[#0F172A]",
            done && "text-[var(--ink-4)] line-through decoration-[var(--ink-4)]/40",
          )}
        >
          {draft.name}
        </span>
        <span className="block truncate text-[10.5px] text-[#64748B]">{draft.role}</span>
      </span>
      {status === "approved" ? (
        <span className="grid size-5 flex-none place-items-center rounded-full bg-[#eafaf0] text-[#1a9e4b]">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : status === "skipped" ? (
        <SkipForward className="size-3.5 flex-none text-[var(--ink-4)]" strokeWidth={2.2} />
      ) : (
        <span className="flex-none rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
          {draft.fit}
        </span>
      )}
    </button>
  );
}

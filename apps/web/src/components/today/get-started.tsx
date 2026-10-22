"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PANEL } from "@/components/app/surface";
import type { Checklist, ChecklistStep } from "@/lib/today/checklist";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "./buttons";

/**
 * Today's Get Started rail (UX-1). A full card until two required steps are done, then a
 * progress pill ("2 of 4 set up") that expands in place. "Dismiss" appears only at 4 of 4
 * and hides the checklist for good. Every step is a link to the one place it gets done.
 */
export function GetStarted({
  checklist,
  onDismiss,
  className,
}: {
  checklist: NonNullable<Checklist>;
  onDismiss: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { done, total, collapsed, dismissable, steps } = checklist;
  const progress = `${done} of ${total} set up`;

  const dismiss = dismissable ? (
    <button
      type="button"
      onClick={onDismiss}
      className={cn("rounded-[var(--r-btn)] px-2 py-1 text-[13px] font-medium text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)]", FOCUS_RING)}
    >
      Dismiss
    </button>
  ) : null;

  if (collapsed && !open) {
    return (
      <div className={cn("flex items-center justify-between gap-2", className)} data-copilot="today-get-started">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-medium text-[var(--ink-mid)] transition-colors hover:text-[var(--ink)]",
            FOCUS_RING
          )}
        >
          <ProgressDots done={done} total={total} />
          <span className="font-data tabular-nums">{progress}</span>
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
        {dismiss}
      </div>
    );
  }

  return (
    <section className={cn(PANEL, "p-5", className)} aria-labelledby="get-started-title" data-copilot="today-get-started">
      <div className="flex items-center justify-between gap-3">
        <h2 id="get-started-title" className="text-sm font-semibold text-[var(--ink)]">
          Get started
        </h2>
        {collapsed ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-expanded
            className={cn("font-data rounded-[var(--r-btn)] px-1 text-[12px] tabular-nums text-[var(--ink-dim)] hover:text-[var(--ink)]", FOCUS_RING)}
          >
            {progress}
          </button>
        ) : (
          <span className="font-data text-[12px] tabular-nums text-[var(--ink-dim)]">{progress}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1 rounded-full", i < done ? "bg-[var(--ink)]" : "bg-[var(--line)]")} />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-1">
        {steps.map((s) => (
          <StepRow key={s.key} step={s} />
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <p className="text-[12px] leading-4 text-[var(--ink-dim)]">Nothing is sent without your approval.</p>
        {dismiss}
      </div>
    </section>
  );
}

function StepRow({ step }: { step: ChecklistStep }) {
  return (
    <li>
      <Link
        href={step.href}
        className={cn(
          "-mx-2 flex items-center gap-3 rounded-[var(--r-btn)] px-2 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]",
          FOCUS_RING
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            step.done ? "bg-[var(--ink)] text-[var(--surface)]" : "border border-[var(--line-strong)]"
          )}
        >
          {step.done && <Check className="size-3" strokeWidth={2.5} />}
        </span>
        <span className={cn("min-w-0 flex-1 truncate", step.done ? "text-[var(--ink-dim)]" : "font-medium text-[var(--ink)]")}>
          {step.label}
          <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
        </span>
        {step.optional && <span className="shrink-0 text-[12px] text-[var(--ink-dim)]">Optional</span>}
      </Link>
    </li>
  );
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  return (
    <span aria-hidden className="flex items-center gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i < done ? "bg-[var(--ink)]" : "bg-[var(--line-strong)]")} />
      ))}
    </span>
  );
}

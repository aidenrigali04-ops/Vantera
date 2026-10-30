"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueRow } from "@/lib/today/rows";
import { TierGlyph } from "@/components/lead-why-now";

/** The prospect strip: initials, name, score + tier, when the draft was written, context, close. */
export function PeekHeader({ row, onClose }: { row: QueueRow; onClose: () => void }) {
  const drafted = row.drafted === "now" ? "just now" : `${row.drafted} ago`;
  return (
    <header className="flex items-start gap-3 px-6 pt-6 pb-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-btn)] bg-[var(--surface-2)] font-mono text-[13px] font-semibold text-[var(--ink-mid)]">
        {row.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[16px] font-semibold text-[var(--ink)]">{row.name}</h2>
          {row.score !== null && (
            <span
              title={row.rationale ?? undefined}
              className={cn(
                "inline-flex h-6 items-center rounded-[var(--r-chip)] px-2 font-mono text-[12px] font-semibold",
                row.score >= 90 ? "bg-[var(--acc-tint)] text-[var(--acc-ink)]" : row.score >= 80 ? "bg-[var(--surface-2)] text-[var(--ink)]" : "bg-[var(--surface-2)] text-[var(--ink-mid)]"
              )}
            >
              {row.score}
            </span>
          )}
          <TierGlyph score={row.score} />
          <span className="shrink-0 font-mono text-[12px] text-[var(--ink-dim)]" title="When the draft was written">
            {drafted}
          </span>
        </div>
        <p className="truncate text-[13px] text-[var(--ink-dim)]">{row.context}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </header>
  );
}

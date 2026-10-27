"use client";

import { forwardRef } from "react";
import { chipDetail, type ChipDot, type ChipState } from "@/lib/engine/chip-state";
import { useUntil } from "@/lib/use-until";
import { cn } from "@/lib/utils";
import { CHROME_FOCUS, CHROME_MOTION, CHROME_PILL } from "./tile";

/** The dot glyph by tone: ● running, ! attention, ● stopped (danger), ◌ paused (hollow ring). */
export function ChipDotGlyph({ dot, className }: { dot: ChipDot; className?: string }) {
  if (dot === "attention") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full bg-[var(--attention-tint)] font-mono text-[10px] font-bold leading-none text-[var(--attention)]",
          className
        )}
      >
        !
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        dot === "running" && "bg-[var(--positive)]",
        dot === "stopped" && "bg-[var(--danger)]",
        dot === "paused" && "ring-[1.5px] ring-inset ring-[var(--ink-dim)]",
        className
      )}
    />
  );
}

/** The chip's detail, re-ticked every 60s when it is a "next run …" countdown. */
export function useChipDetail(chip: ChipState): string | null {
  const until = useUntil(chip.nextRunAt, chip.untilLabel ?? "");
  return chipDetail(chip, until);
}

export type StatusChipProps = {
  chip: ChipState;
  expanded: boolean;
  controls?: string;
  /** `compact` = the mobile top bar: dot + label only, no pill chrome. */
  variant?: "band" | "compact";
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
};

/**
 * The run-state chip (UX-2 Task 9): what the engine is doing right now. A button — clicking it
 * opens the engine popover. In the 64px band it is a `CHROME_PILL`; the label truncates and
 * the detail drops below `2xl`, and below `xl` only the dot shows (the label stays the
 * accessible name) so it never collides with the centered nav.
 */
export const StatusChip = forwardRef<HTMLButtonElement, StatusChipProps>(function StatusChip(
  { chip, expanded, controls, variant = "band", onClick, onKeyDown },
  ref
) {
  const detail = useChipDetail(chip);
  const name = detail ? `${chip.label} · ${detail}` : chip.label;

  if (variant === "compact") {
    return (
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={controls}
        aria-label={`Engine: ${name}`}
        title={chip.nextRunTitle ?? name}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-8 min-w-0 shrink items-center gap-1.5 rounded-[var(--r-btn)] px-1.5 text-[13px] font-medium text-[var(--ink-mid)] hover:bg-[var(--surface-2)]",
          CHROME_MOTION,
          CHROME_FOCUS
        )}
      >
        <ChipDotGlyph dot={chip.dot} />
        <span className="truncate">{chip.label}</span>
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={`Engine: ${name}`}
      title={chip.nextRunTitle ?? name}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        CHROME_PILL,
        "min-w-0 gap-2 px-2.5 text-left text-[13px] hover:bg-[var(--surface-2)] hover:ring-[var(--line-strong)]",
        CHROME_MOTION,
        CHROME_FOCUS,
        expanded && "ring-[var(--line-strong)]"
      )}
    >
      <ChipDotGlyph dot={chip.dot} />
      <span className="hidden min-w-0 items-baseline gap-1.5 xl:flex">
        <span className="max-w-[18ch] truncate font-medium text-[var(--ink-2)]">{chip.label}</span>
        {detail && (
          <span className="hidden max-w-[24ch] truncate tabular-nums text-[var(--ink-dim)] 2xl:inline">
            {detail}
          </span>
        )}
      </span>
    </button>
  );
});

"use client";

import { X } from "lucide-react";
import { REJECT_REASON_ORDER, REJECT_REASONS, type RejectReason } from "../work-card/reject-reasons";

/** The reject mode's reason-chip row (reasons sourced from `work-card/reject-reasons.ts`) + cancel. */
export function RejectReasons({ locked, onReject, onCancel }: { locked: boolean; onReject: (reason: RejectReason) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {REJECT_REASON_ORDER.map((r) => (
        <button key={r} type="button" disabled={locked} onClick={() => onReject(r)} className="inline-flex h-8 items-center rounded-[var(--r-pill)] px-3 text-[13px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
          {REJECT_REASONS[r]}
        </button>
      ))}
      <button type="button" onClick={onCancel} aria-label="Cancel" className="ml-auto grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] hover:bg-[var(--surface-2)]">
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

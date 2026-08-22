"use client";

import { ArrowRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { REJECT_REASON_ORDER, REJECT_REASONS, type RejectReason } from "./reject-reasons";

/**
 * The three hover actions on a Queue row (blueprint §6.8.1). There is deliberately NO
 * Approve here: approving means the draft was read, and the row shows only its opening
 * line — Review opens the peek, where Approve lives.
 */
export function RowActions({
  onLater,
  onReject,
  onReview,
}: {
  onLater: () => void;
  onReject: () => void;
  onReview: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <ActionTile label="Later" onClick={onLater}>
        <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
      </ActionTile>
      <ActionTile label="Reject" onClick={onReject}>
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </ActionTile>
      <ActionTile label="Review" onClick={onReview} ink>
        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </ActionTile>
    </div>
  );
}

function ActionTile({
  label,
  onClick,
  ink = false,
  children,
}: {
  label: string;
  onClick: () => void;
  ink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[var(--r-btn)] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        ink
          ? "bg-[var(--ink)] text-[var(--ink-fg)] hover:bg-[#1f1f23]"
          : "bg-[var(--surface)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Reject in place: the row's own cells become four reason chips. No modal, one tap to
 * finish, and a `×` to back out — the reason is what teaches the engine, so asking for it
 * must cost less than skipping it.
 */
export function RejectReasonPicker({ onPick, onCancel }: { onPick: (r: RejectReason) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[13px] text-[var(--ink-dim)]">Why?</span>
      {REJECT_REASON_ORDER.map((reason) => (
        <button
          key={reason}
          type="button"
          autoFocus={reason === REJECT_REASON_ORDER[0]}
          onClick={(e) => {
            e.stopPropagation();
            onPick(reason);
          }}
          className="inline-flex h-7 items-center rounded-[var(--r-pill)] px-2.5 text-[13px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          {REJECT_REASONS[reason]}
        </button>
      ))}
      <button
        type="button"
        aria-label="Cancel"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="grid size-6 shrink-0 place-items-center rounded-[var(--r-btn)] text-[var(--ink-dim)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

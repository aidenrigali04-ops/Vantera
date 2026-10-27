"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, MoreHorizontal, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { RejectReason } from "../work-card/reject-reasons";
import { RejectReasons } from "./reject-reasons";
import type { Inflight, PeekMode } from "./types";

/** The 5s toast with Undo every queue removal carries (approve / reject). */
export function undoToast(message: string, onUndo: () => void): void {
  toast(message, { duration: 5000, action: { label: "Undo", onClick: onUndo } });
}

/**
 * The peek's action bar: Approve / Edit / Fix (only when the draft carries style flags) /
 * Reject, the pane-only overflow (Decline & never contact, confirmed), and ← → through the
 * list. In reject mode the bar is the reason-chip row instead.
 */
export function PeekFooter({
  name,
  mode,
  doing,
  hasStyleFlags,
  onApprove,
  onEdit,
  onFix,
  onStartReject,
  onReject,
  onCancelReject,
  onSuppress,
  moreOpen,
  onMoreOpen,
  onPrev,
  onNext,
}: {
  /** the prospect's name, for the decline confirmation */
  name: string;
  mode: PeekMode;
  /** the call in flight for this draft, if any */
  doing: Inflight | undefined;
  hasStyleFlags: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onFix: () => void;
  onStartReject: () => void;
  onReject: (reason: RejectReason) => void;
  onCancelReject: () => void;
  /** pane only: shows the overflow with "Decline & never contact" */
  onSuppress?: () => void;
  moreOpen: boolean;
  onMoreOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  /** null when there is no previous / next draft */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const locked = doing !== undefined;
  return (
    <footer className="border-t border-[var(--line)] px-6 py-4">
      {mode === "reject" ? (
        <RejectReasons locked={locked} onReject={onReject} onCancel={onCancelReject} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-copilot="approve-draft" onClick={onApprove} disabled={locked || mode === "edit"} className="inline-flex h-10 items-center gap-2 rounded-[var(--r-btn)] bg-[var(--acc)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--acc-ink)] disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
            {doing === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={1.75} />}
            Approve <kbd className="ml-1 rounded bg-[rgb(255_255_255/0.16)] px-1.5 font-mono text-[11px]">A</kbd>
          </button>
          <button type="button" onClick={onEdit} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40">
            <PenLine className="size-4" strokeWidth={1.75} /> Edit <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">E</kbd>
          </button>
          {hasStyleFlags && (
            <button type="button" data-copilot="fix-draft" onClick={onFix} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40">
              <Sparkles className="size-4" strokeWidth={1.75} /> Fix
            </button>
          )}
          <button type="button" onClick={onStartReject} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink-mid)] hover:bg-[var(--surface-2)] disabled:opacity-40">
            Reject <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">R</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {onSuppress && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onMoreOpen((o) => !o)}
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className="grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]"
                >
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </button>
                {/* kept mounted (hidden) so the confirm dialog's state survives the menu closing */}
                <div role="menu" className={cn("absolute right-0 bottom-full z-20 mb-2 w-56 rounded-[var(--r-square)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-card)]", !moreOpen && "hidden")}>
                  <ConfirmDialog
                    title="Decline and never contact?"
                    description={`${name} is removed from the queue and added to your do-not-contact list. No agent will reach out to them again.`}
                    confirmLabel="Decline & never contact"
                    destructive
                    onConfirm={onSuppress}
                    trigger={(open) => (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={locked}
                        onClick={() => {
                          onMoreOpen(false);
                          open();
                        }}
                        className="flex h-9 w-full items-center rounded-[var(--r-btn)] px-3 text-left text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                      >
                        Decline &amp; never contact
                      </button>
                    )}
                  />
                </div>
              </div>
            )}
            <button type="button" disabled={!onPrev} onClick={() => onPrev?.()} aria-label="Previous draft" className="grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-30">
              <ArrowLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button type="button" disabled={!onNext} onClick={() => onNext?.()} aria-label="Next draft" className="grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-30">
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}

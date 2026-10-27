"use client";

import { useEffect, useRef, useState } from "react";
import type { QueueRow } from "@/lib/today/rows";
import { parseStyleFlags } from "./style-flags";
import { DraftBody, Evidence } from "./draft-peek/draft-body";
import { PeekFooter } from "./draft-peek/peek-footer";
import { PeekHeader } from "./draft-peek/peek-header";
import { SteerBox } from "./draft-peek/steer-box";
import type { Outcome, PeekMode } from "./draft-peek/types";
import { useDraftActions } from "./draft-peek/use-draft-actions";
import { usePeekKeys } from "./draft-peek/use-peek-keys";

/**
 * DraftPeek (blueprint §6.12) — where approval happens. Rows show the opening line; the peek
 * shows the draft as it will land on LinkedIn, the evidence, and the schedule, so "Approve"
 * always means "read".
 *
 * Variants:
 * - `sheet` (Today, default): right-side sheet over an overlay, focus moved in and restored,
 *   Esc leaves a mode or closes.
 * - `pane` (Approvals): renders inside the caller's grid cell — no overlay, no fixed
 *   positioning, no focus move, not modal; Esc only leaves edit / reject / steer.
 *
 * Keys (`draft-peek/use-peek-keys.ts`): A approve · E edit · G regenerate with the current
 * steer note (first-touch drafts) · R reject · ← → move through the list. Approve is
 * optimistic: the caller collapses the row and the next draft loads; the toast carries a 5s Undo.
 *
 * This file is the composition root: UI state + layout. Server calls and the per-draft
 * in-flight model live in `draft-peek/use-draft-actions.ts`.
 */
export function DraftPeek({
  rows,
  openId,
  onClose,
  onNavigate,
  onRemoved,
  variant = "sheet",
  onSuppress,
}: {
  rows: QueueRow[];
  openId: string | null;
  onClose: () => void;
  /** move to another draft in the list (updates ?draft=) */
  onNavigate: (id: string) => void;
  /** the row left the queue — the page collapses it */
  onRemoved: (id: string, outcome: Outcome) => void;
  variant?: "sheet" | "pane";
  /** pane only: "Decline & never contact" (suppression) in the footer overflow */
  onSuppress?: (id: string) => Promise<{ error?: string }>;
}) {
  const index = rows.findIndex((r) => r.id === openId);
  const row = index >= 0 ? rows[index]! : null;
  const isSheet = variant === "sheet";

  const [mode, setMode] = useState<PeekMode>("read");
  const [editBody, setEditBody] = useState("");
  const [steer, setSteer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const steerRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Today remounts the sheet with `key={openDraftId}`; the pane stays mounted across rows, so
  // per-draft UI state resets when the open row changes (render-time reset, no stale frame).
  const [shownId, setShownId] = useState<string | null>(row?.id ?? null);
  if ((row?.id ?? null) !== shownId) {
    setShownId(row?.id ?? null);
    setMode("read");
    setSteer("");
    setError(null);
    setMoreOpen(false);
  }

  const actions = useDraftActions({ row, rows, openId, mode, setMode, editBody, setEditBody, steer, setError, onRemoved, onNavigate, onClose, onSuppress });
  const { current, doing } = actions;

  // sheet only: remember the opener, focus the sheet, restore on close
  useEffect(() => {
    if (!isSheet || !row) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => sheetRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prev = index > 0 ? rows[index - 1] : undefined;
  const next = rows[index + 1];

  usePeekKeys(row !== null, {
    approve: () => void actions.approve(),
    edit: actions.startEdit,
    regenerate: () => void actions.regenerate(),
    reject: actions.startReject,
    next: () => next && onNavigate(next.id),
    prev: () => prev && onNavigate(prev.id),
    // Esc cascade: leave a mode → blur the steer box → close the overflow → close the sheet
    escape: (target) => {
      if (mode !== "read") setMode("read");
      else if (target && target === steerRef.current) steerRef.current.blur();
      else if (moreOpen) setMoreOpen(false);
      else if (isSheet) onClose();
      else return false;
      return true;
    },
  });

  if (!row || !current) return null;

  const content = (
    <>
      <PeekHeader row={row} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <Evidence items={row.evidence} />

        <section>
          <p className="mb-2 text-[12px] font-medium text-[var(--ink-dim)]">
            <span className="font-mono">{row.step}</span> · LinkedIn
          </p>
          <DraftBody
            row={row}
            body={current.body}
            styleFlags={parseStyleFlags(current.styleFlags)}
            mode={mode}
            doing={doing}
            editBody={editBody}
            onEditBody={setEditBody}
            onSave={() => void actions.saveEdit()}
            onCancelEdit={() => setMode("read")}
          />
          <SteerBox
            id={row.id}
            steer={steer}
            onSteer={setSteer}
            onRegenerate={() => void actions.regenerate()}
            offReason={actions.regenOff}
            locked={actions.locked}
            regenerating={doing === "regenerate"}
            steerRef={steerRef}
          />
          <p className="mt-4 text-[13px] text-[var(--ink-mid)]">
            {row.sends.held
              ? `Held until ${row.sends.sender ?? "the sender"} is back — nothing is lost.`
              : `Will send ${row.sends.label} (pacing)${row.sends.sender ? ` via ${row.sends.sender}` : ""}.`}
          </p>
        </section>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>

      <PeekFooter
        name={row.name}
        mode={mode}
        doing={doing}
        hasStyleFlags={Boolean(current.styleFlags)}
        onApprove={() => void actions.approve()}
        onEdit={actions.startEdit}
        onFix={() => void actions.fix()}
        onStartReject={actions.startReject}
        onReject={(r) => void actions.reject(r)}
        onCancelReject={() => setMode("read")}
        onSuppress={onSuppress ? () => void actions.suppress() : undefined}
        moreOpen={moreOpen}
        onMoreOpen={setMoreOpen}
        onPrev={prev ? () => onNavigate(prev.id) : null}
        onNext={next ? () => onNavigate(next.id) : null}
      />
    </>
  );

  if (!isSheet) {
    return (
      <section aria-label={`Draft for ${row.name}`} className="flex h-full min-h-0 w-full flex-col bg-[var(--surface)]">
        {content}
      </section>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgb(11_11_13/0.2)] transition-opacity duration-200" onClick={onClose} aria-hidden />
      <aside
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Draft for ${row.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)] outline-none 2xl:max-w-[560px] motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200"
      >
        {content}
      </aside>
    </>
  );
}

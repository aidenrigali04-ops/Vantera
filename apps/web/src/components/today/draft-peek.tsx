"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, MoreHorizontal, PenLine, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseStyleFlags } from "./style-flags";
import { DraftPreview } from "./draft-preview";
import { applyIfCurrent, nextAfterRemoval, type AfterRemoval } from "./peek-result";
import { REJECT_REASON_ORDER, REJECT_REASONS, type RejectReason } from "./work-card/reject-reasons";
import type { QueueRow } from "@/lib/today/rows";
import { regenerateOffReason } from "@/lib/copy/regenerable";
import { fixDraft, regenerateDraft, saveDraftEdit, type RegenerateResult, type ReviewActionState } from "@/app/(app)/approvals/actions";
import { trackFirstDraftApproved } from "@/lib/analytics/activation";
import { approveFromToday, rejectDraftWithReason, undoApproveDraft, undoRejectDraft } from "@/app/(app)/today/actions";
import { TierGlyph } from "@/components/lead-why-now";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
 * Keys: A approve · E edit · G regenerate with the current steer note (first-touch drafts) ·
 * R reject · ← → move through the list. Approve is optimistic: the caller collapses the row
 * and the next draft loads; the toast carries a 5s Undo.
 */

/** Mirrors STEER_MAX_CHARS in @vantera/agent-brains (copy/steer) — local so this client file
 *  never pulls the brain package into the browser bundle. The server slices to the same cap. */
const STEER_MAX = 280;

/** a thrown action (network drop) reads as an error result, so in-flight state always clears */
const failed = (): { error: string } => ({ error: "Something went wrong. Try again." });

type Outcome = "approved" | "rejected" | "suppressed";
type DraftText = { body: string; styleFlags: string | null };
type Inflight = "approve" | "reject" | "suppress" | "save" | "regenerate" | "fix";

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

  // Text the server returned for a draft (save / fix / regenerate), keyed by send id — the
  // row props are never mutated; the list is re-fetched on the next navigation/refresh.
  const [texts, setTexts] = useState<Record<string, DraftText>>({});
  const [mode, setMode] = useState<"read" | "edit" | "reject">("read");
  const [editBody, setEditBody] = useState("");
  const [steer, setSteer] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Per-draft in-flight work, keyed by send id. A slow rewrite on one draft never locks the
  // others: every gate below reads THIS draft's entry, never a shared transition.
  const [inflight, setInflight] = useState<Record<string, Inflight>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const steerRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Live values for async results (Review Focus 1: drop a late result for another draft).
  const openIdRef = useRef(openId);
  const rowsRef = useRef(rows);
  useEffect(() => {
    openIdRef.current = openId;
    rowsRef.current = rows;
  }, [openId, rows]);

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

  const current = useMemo<DraftText | null>(
    () => (row ? (texts[row.id] ?? { body: row.body, styleFlags: row.styleFlags }) : null),
    [row, texts]
  );
  const regenOff = row ? regenerateOffReason(row) : null;
  const canRegenerate = row !== null && regenOff === null;
  const doing: Inflight | undefined = row ? inflight[row.id] : undefined;
  /** this draft has a call in flight — every action on it waits */
  const locked = doing !== undefined;
  /** this draft is being rewritten (regenerate / fix) — the skeleton shows */
  const busy = doing === "regenerate" || doing === "fix";

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

  const begin = useCallback((id: string, kind: Inflight) => setInflight((prev) => ({ ...prev, [id]: kind })), []);
  const end = useCallback(
    (id: string) =>
      setInflight((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      }),
    []
  );

  /**
   * Where to go once `doneId` leaves the queue — computed BEFORE the server call, so it never
   * depends on whether the revalidated list commits before the await returns.
   */
  const planNext = useCallback(
    (doneId: string) =>
      nextAfterRemoval(
        rowsRef.current.map((r) => r.id),
        doneId,
        openIdRef.current
      ),
    []
  );

  /** apply a planned step, only if `doneId` is still the open draft */
  const goNext = useCallback(
    (doneId: string, step: AfterRemoval | null) => {
      if (!step || !applyIfCurrent(openIdRef.current, { sendId: doneId })) return;
      if (step.kind === "open") onNavigate(step.id);
      else onClose();
    },
    [onNavigate, onClose]
  );

  /** an error for `id` shows only while `id` is still the open draft */
  const errorFor = useCallback((id: string, message: string) => {
    if (applyIfCurrent(openIdRef.current, { sendId: id })) setError(message);
  }, []);

  const store = useCallback((sendId: string, t: DraftText) => setTexts((prev) => ({ ...prev, [sendId]: t })), []);

  const approve = useCallback(async () => {
    if (!row || locked || mode === "edit") return;
    const id = row.id;
    const sends = row.sends.held ? "held until the sender is back" : `sends ${row.sends.label}`;
    const step = planNext(id);
    begin(id, "approve");
    const res = await approveFromToday(id).catch(failed);
    end(id);
    if (res.error) {
      errorFor(id, res.error);
      return;
    }
    // The approval happened server-side whatever the owner is looking at now, so the row always
    // collapses and the Undo toast always shows; only the navigation is guarded.
    trackFirstDraftApproved();
    onRemoved(id, "approved");
    toast(`Approved · ${sends}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          void undoApproveDraft(id);
        },
      },
    });
    goNext(id, step);
  }, [row, locked, mode, begin, end, errorFor, onRemoved, planNext, goNext]);

  const reject = useCallback(
    async (reason: RejectReason) => {
      if (!row || locked) return;
      const id = row.id;
      const step = planNext(id);
      begin(id, "reject");
      const res = await rejectDraftWithReason(id, reason).catch(failed);
      end(id);
      if (res.error) {
        errorFor(id, res.error);
        return;
      }
      onRemoved(id, "rejected");
      toast("Rejected", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            void undoRejectDraft(id);
          },
        },
      });
      goNext(id, step);
    },
    [row, locked, begin, end, errorFor, onRemoved, planNext, goNext]
  );

  const suppress = useCallback(async () => {
    if (!row || locked || !onSuppress) return;
    const id = row.id;
    const step = planNext(id);
    begin(id, "suppress");
    const res = await onSuppress(id).catch(failed);
    end(id);
    if (res.error) {
      errorFor(id, res.error);
      return;
    }
    onRemoved(id, "suppressed");
    toast("Declined · they won't be contacted again");
    goNext(id, step);
  }, [row, locked, onSuppress, begin, end, errorFor, onRemoved, planNext, goNext]);

  const startEdit = useCallback(() => {
    if (!current || locked) return;
    setEditBody(current.body);
    setError(null);
    setMode("edit");
  }, [current, locked]);

  const startReject = useCallback(() => {
    if (locked) return;
    setMode("reject");
  }, [locked]);

  const saveEdit = useCallback(async () => {
    if (!row || locked) return;
    const id = row.id;
    const fd = new FormData();
    fd.set("sendId", id);
    fd.set("channel", row.channel);
    fd.set("body", editBody);
    begin(id, "save");
    const res: ReviewActionState = await saveDraftEdit({}, fd).catch(failed);
    end(id);
    const live = applyIfCurrent(openIdRef.current, { sendId: id, ...res });
    if (!live) return;
    if (live.error) {
      setError(live.error);
      return;
    }
    store(id, { body: live.body ?? editBody, styleFlags: live.styleFlags ?? null });
    setMode("read");
    toast("Saved");
  }, [row, locked, editBody, begin, end, store]);

  const fix = useCallback(async () => {
    if (!row || locked || !current?.styleFlags) return;
    const id = row.id;
    const fd = new FormData();
    fd.set("sendId", id);
    setError(null);
    begin(id, "fix");
    const res: ReviewActionState = await fixDraft({}, fd).catch(failed);
    end(id);
    const live = applyIfCurrent(openIdRef.current, { sendId: id, ...res });
    if (!live) return;
    if (live.error) {
      setError(live.error);
      return;
    }
    if (live.body === undefined) {
      toast("Nothing to fix on this draft.");
      return;
    }
    store(id, { body: live.body, styleFlags: live.styleFlags ?? null });
    toast(live.notice ?? "Cleaned up — give it a read, then approve.");
  }, [row, locked, current, begin, end, store]);

  const regenerate = useCallback(async () => {
    if (!row || locked) return;
    if (!canRegenerate) {
      setError(regenOff ?? "Only first-touch drafts can be regenerated.");
      return;
    }
    const id = row.id;
    const note = steer.trim().slice(0, STEER_MAX);
    setError(null);
    setMode("read");
    begin(id, "regenerate");
    const res: RegenerateResult = await regenerateDraft(id, note).catch(failed);
    end(id);
    const live = applyIfCurrent(openIdRef.current, { sendId: id, ...res });
    if (!live) return;
    if (live.error || live.body === undefined) {
      setError(live.error ?? "Couldn't regenerate right now. Try again.");
      return;
    }
    store(id, { body: live.body, styleFlags: live.styleFlags ?? null });
    toast("New draft ready — give it a read.");
  }, [row, locked, canRegenerate, regenOff, steer, begin, end, store]);

  // keyboard
  useEffect(() => {
    if (!row) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      // a confirmation dialog owns the keyboard while it is open; tabs and selects own their keys
      if (target?.closest?.('[role="alertdialog"], [role="tab"]')) return;
      if (target?.tagName === "SELECT") return;
      const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
      if (e.key === "Escape") {
        if (mode !== "read") {
          e.preventDefault();
          setMode("read");
        } else if (target && target === steerRef.current) {
          e.preventDefault();
          steerRef.current.blur();
        } else if (moreOpen) {
          e.preventDefault();
          setMoreOpen(false);
        } else if (isSheet) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          void approve();
          break;
        case "e":
          e.preventDefault();
          startEdit();
          break;
        case "g":
          e.preventDefault();
          void regenerate();
          break;
        case "r":
          e.preventDefault();
          startReject();
          break;
        case "arrowright": {
          const n = rows[index + 1];
          if (n) onNavigate(n.id);
          break;
        }
        case "arrowleft": {
          const p = rows[index - 1];
          if (p) onNavigate(p.id);
          break;
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, rows, index, mode, moreOpen, isSheet, approve, startEdit, startReject, regenerate, onClose, onNavigate]);

  if (!row || !current) return null;

  const editOver = editBody.length > row.charLimit;
  const styleFlags = parseStyleFlags(current.styleFlags);
  const drafted = row.drafted === "now" ? "just now" : `${row.drafted} ago`;

  const content = (
    <>
      {/* prospect strip */}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {/* evidence */}
        {row.evidence.length > 0 && (
          <section className="mb-5">
            <p className="mb-2 text-[12px] font-medium text-[var(--ink-dim)]">Why now</p>
            <ul className="flex flex-col gap-1.5">
              {row.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] leading-snug text-[var(--ink)]">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--ink-dim)]" aria-hidden />
                  <span className="min-w-0">
                    {e.text}
                    {e.href && (
                      <a href={e.href} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[12px] font-medium text-[var(--acc)] hover:underline">
                        source <ExternalLink className="size-3" strokeWidth={1.75} />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* the draft */}
        <section>
          <p className="mb-2 text-[12px] font-medium text-[var(--ink-dim)]">
            <span className="font-mono">{row.step}</span> · LinkedIn
          </p>
          {busy ? (
            <div role="status" aria-busy="true" aria-label={doing === "fix" ? "Fixing the draft" : "Rewriting the draft"} className="flex flex-col gap-2.5 rounded-[var(--r-square)] bg-[var(--surface-2)] p-4">
              {["w-full", "w-11/12", "w-4/5", "w-2/3"].map((w) => (
                <span key={w} className={cn("h-3 rounded-full bg-[var(--line)] motion-safe:animate-pulse", w)} />
              ))}
            </div>
          ) : mode === "edit" ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={7}
                autoFocus
                aria-label="Edit the draft"
                className="w-full resize-y rounded-[var(--r-square)] border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-[14px] leading-[1.55] text-[var(--ink)] outline-none focus:shadow-[var(--focus-ring)]"
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void saveEdit()} disabled={locked || editOver || !editBody.trim()} className="inline-flex h-9 items-center gap-2 rounded-[var(--r-btn)] bg-[var(--acc)] px-4 text-[14px] font-semibold text-white disabled:opacity-40">
                  {doing === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={1.75} />} Save
                </button>
                <button type="button" onClick={() => setMode("read")} className="inline-flex h-9 items-center rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
                  Cancel
                </button>
                <span className={cn("ml-auto font-mono text-[12px]", editOver ? "text-[var(--danger)]" : "text-[var(--ink-dim)]")}>
                  {editBody.length}/{row.charLimit}
                </span>
              </div>
            </div>
          ) : (
            <DraftPreview body={current.body} stage={row.step} charLimit={row.charLimit} />
          )}
          {styleFlags.length > 0 && !busy && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {styleFlags.map((f) => (
                <span
                  key={f.label + (f.detail ?? "")}
                  title={f.detail ?? undefined}
                  className="inline-flex h-6 items-center rounded-[var(--r-chip)] bg-[var(--attention-tint)] px-2 text-[11px] font-medium text-[var(--attention)]"
                >
                  {f.label}
                </span>
              ))}
            </div>
          )}

          {/* steer + regenerate */}
          <div className="mt-4" title={regenOff ?? undefined}>
            <label htmlFor={`steer-${row.id}`} className="mb-1.5 block text-[12px] font-medium text-[var(--ink-dim)]">
              Steer a rewrite (optional)
            </label>
            <textarea
              id={`steer-${row.id}`}
              ref={steerRef}
              value={steer}
              onChange={(e) => setSteer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void regenerate();
                }
              }}
              maxLength={STEER_MAX}
              rows={2}
              disabled={!canRegenerate}
              placeholder="Make it shorter, lead with the hiring signal…"
              className="w-full resize-none rounded-[var(--r-square)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] focus:shadow-[var(--focus-ring)] disabled:opacity-50"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void regenerate()}
                disabled={!canRegenerate || locked}
                title={regenOff ?? undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[13px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40"
              >
                {doing === "regenerate" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" strokeWidth={1.75} />}
                Regenerate <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">G</kbd>
              </button>
              <span className="ml-auto font-mono text-[11px] text-[var(--ink-dim)]">
                {steer.length}/{STEER_MAX}
              </span>
            </div>
          </div>

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

      {/* action bar */}
      <footer className="border-t border-[var(--line)] px-6 py-4">
        {mode === "reject" ? (
          <div className="flex flex-wrap items-center gap-2">
            {REJECT_REASON_ORDER.map((r) => (
              <button key={r} type="button" disabled={locked} onClick={() => void reject(r)} className="inline-flex h-8 items-center rounded-[var(--r-pill)] px-3 text-[13px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
                {REJECT_REASONS[r]}
              </button>
            ))}
            <button type="button" onClick={() => setMode("read")} aria-label="Cancel" className="ml-auto grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] hover:bg-[var(--surface-2)]">
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-copilot="approve-draft" onClick={() => void approve()} disabled={locked || mode === "edit"} className="inline-flex h-10 items-center gap-2 rounded-[var(--r-btn)] bg-[var(--acc)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--acc-ink)] disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
              {doing === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={1.75} />}
              Approve <kbd className="ml-1 rounded bg-[rgb(255_255_255/0.16)] px-1.5 font-mono text-[11px]">A</kbd>
            </button>
            <button type="button" onClick={startEdit} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40">
              <PenLine className="size-4" strokeWidth={1.75} /> Edit <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">E</kbd>
            </button>
            {current.styleFlags && (
              <button type="button" data-copilot="fix-draft" onClick={() => void fix()} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40">
                <Sparkles className="size-4" strokeWidth={1.75} /> Fix
              </button>
            )}
            <button type="button" onClick={startReject} disabled={locked} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink-mid)] hover:bg-[var(--surface-2)] disabled:opacity-40">
              Reject <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">R</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              {onSuppress && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((o) => !o)}
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
                      description={`${row.name} is removed from the queue and added to your do-not-contact list. No agent will reach out to them again.`}
                      confirmLabel="Decline & never contact"
                      destructive
                      onConfirm={() => void suppress()}
                      trigger={(open) => (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={locked}
                          onClick={() => {
                            setMoreOpen(false);
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
              <button type="button" disabled={index <= 0} onClick={() => rows[index - 1] && onNavigate(rows[index - 1]!.id)} aria-label="Previous draft" className="grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-30">
                <ArrowLeft className="size-4" strokeWidth={1.75} />
              </button>
              <button type="button" disabled={index >= rows.length - 1} onClick={() => rows[index + 1] && onNavigate(rows[index + 1]!.id)} aria-label="Next draft" className="grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-30">
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </footer>
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

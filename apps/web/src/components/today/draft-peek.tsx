"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, PenLine, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseStyleFlags } from "./style-flags";
import type { QueueRow } from "@/lib/today/rows";
import { fixDraft, saveDraftEdit, type ReviewActionState } from "@/app/(app)/approvals/actions";
import { approveFromToday, rejectDraftWithReason, undoApproveDraft, undoRejectDraft, type RejectReason } from "@/app/(app)/today/actions";

/**
 * DraftPeek (blueprint §6.12) — the right-side sheet where approval happens. Rows show
 * the opening line; the peek shows the draft, the evidence, and the schedule, so
 * "Approve" always means "read". Same shell as the prospect side-peek: 480px (560 at ≥1536),
 * full height under the chrome, left hairline, focus trapped, Esc closes and returns focus.
 *
 * Keys: A approve · E edit · G fix (one targeted AI edit of a flagged draft) · R reject ·
 * ← → move through the list without closing. Approve is optimistic: the caller collapses the
 * row and the next draft loads; the toast carries a 5s Undo.
 */

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  wrong_person: "Wrong person",
  bad_timing: "Bad timing",
  weak_message: "Weak message",
  other: "Other",
};

export function DraftPeek({
  rows,
  openId,
  onClose,
  onNavigate,
  onRemoved,
}: {
  rows: QueueRow[];
  openId: string | null;
  onClose: () => void;
  /** move to another draft in the list (updates ?draft=) */
  onNavigate: (id: string) => void;
  /** the row left the queue (approved / rejected) — the page collapses it */
  onRemoved: (id: string, outcome: "approved" | "rejected") => void;
}) {
  const index = rows.findIndex((r) => r.id === openId);
  const row = index >= 0 ? rows[index]! : null;
  const [mode, setMode] = useState<"read" | "edit" | "reject">("read");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheetRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [body, setBody] = useState(row?.body ?? "");

  // No reset effect: the page mounts this with `key={openDraftId}`, so opening another
  // draft REMOUNTS the peek and every piece of state starts fresh from that row's props.
  // (Resetting state in an effect would render the stale draft for one frame first.)

  // focus management: remember the opener, focus the sheet, restore on close
  useEffect(() => {
    if (!row) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => sheetRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = useCallback(() => {
    const next = rows[index + 1] ?? rows[index - 1];
    if (next) onNavigate(next.id);
    else onClose();
  }, [rows, index, onNavigate, onClose]);

  const approve = useCallback(() => {
    if (!row || pending) return;
    const id = row.id;
    const sends = row.sends.held ? "held until the sender is back" : `sends ${row.sends.label}`;
    start(async () => {
      const res = await approveFromToday(id);
      if (res.error) {
        setError(res.error);
        return;
      }
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
      goNext();
    });
  }, [row, pending, onRemoved, goNext]);

  const reject = useCallback(
    (reason: RejectReason) => {
      if (!row || pending) return;
      const id = row.id;
      start(async () => {
        const res = await rejectDraftWithReason(id, reason);
        if (res.error) {
          setError(res.error);
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
        goNext();
      });
    },
    [row, pending, onRemoved, goNext]
  );

  const saveEdit = useCallback(() => {
    if (!row || pending) return;
    const fd = new FormData();
    fd.set("sendId", row.id);
    fd.set("channel", row.channel);
    fd.set("body", body);
    start(async () => {
      const res: ReviewActionState = await saveDraftEdit({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      row.body = body; // the list is re-fetched on the next navigation; keep the peek honest now
      setMode("read");
      toast("Saved");
    });
  }, [row, pending, body]);

  const fix = useCallback(() => {
    if (!row || pending || !row.styleFlags) return;
    const fd = new FormData();
    fd.set("sendId", row.id);
    start(async () => {
      const res: ReviewActionState & { notice?: string } = await fixDraft({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast(res.notice ?? "Cleaned up — give it a read, then approve.");
    });
  }, [row, pending]);

  // keyboard
  useEffect(() => {
    if (!row) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        if (mode !== "read") setMode("read");
        else onClose();
        return;
      }
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          approve();
          break;
        case "e":
          e.preventDefault();
          setMode("edit");
          break;
        case "g":
          e.preventDefault();
          fix();
          break;
        case "r":
          e.preventDefault();
          setMode("reject");
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
  }, [row, rows, index, mode, approve, fix, onClose, onNavigate]);

  if (!row) return null;

  const chars = body.length;
  const over = chars > row.charLimit;
  const styleFlags = parseStyleFlags(row.styleFlags);

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
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-medium text-[var(--ink-dim)]">
                <span className="font-mono">{row.step}</span> · LinkedIn
              </p>
              <p className={cn("font-mono text-[12px]", over ? "text-[var(--danger)]" : "text-[var(--ink-dim)]")}>
                {chars}/{row.charLimit}
              </p>
            </div>
            {mode === "edit" ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={7}
                  autoFocus
                  className="w-full resize-y rounded-[var(--r-square)] border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-[14px] leading-[1.55] text-[var(--ink)] outline-none focus:shadow-[var(--focus-ring)]"
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={saveEdit} disabled={pending || over || !body.trim()} className="inline-flex h-9 items-center gap-2 rounded-[var(--r-btn)] bg-[var(--ink)] px-4 text-[14px] font-medium text-[var(--ink-fg)] disabled:opacity-40">
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={1.75} />} Save
                  </button>
                  <button type="button" onClick={() => { setBody(row.body); setMode("read"); }} className="inline-flex h-9 items-center rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--r-square)] bg-[var(--surface-2)] p-4 text-[14px] leading-[1.55] whitespace-pre-wrap text-[var(--ink)]">{body}</div>
            )}
            {styleFlags.length > 0 && (
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
            <p className="mt-3 text-[13px] text-[var(--ink-mid)]">
              {row.sends.held
                ? `Held until ${row.sends.sender ?? "the sender"} is back — nothing is lost.`
                : `Will send ${row.sends.label} (pacing)${row.sends.sender ? ` via ${row.sends.sender}` : ""}.`}
            </p>
          </section>

          {error && <p className="mt-4 text-[13px] text-[var(--danger)]">{error}</p>}
        </div>

        {/* action bar */}
        <footer className="border-t border-[var(--line)] px-6 py-4">
          {mode === "reject" ? (
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(REJECT_REASON_LABELS) as RejectReason[]).map((r) => (
                <button key={r} type="button" disabled={pending} onClick={() => reject(r)} className="inline-flex h-8 items-center rounded-[var(--r-pill)] px-3 text-[13px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
                  {REJECT_REASON_LABELS[r]}
                </button>
              ))}
              <button type="button" onClick={() => setMode("read")} aria-label="Cancel" className="ml-auto grid size-8 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] hover:bg-[var(--surface-2)]">
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={approve} disabled={pending || mode === "edit"} className="inline-flex h-10 items-center gap-2 rounded-[var(--r-btn)] bg-[var(--ink)] px-4 text-[14px] font-medium text-[var(--ink-fg)] transition-colors hover:bg-[#1f1f23] disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={1.75} />}
                Approve <kbd className="ml-1 rounded bg-[rgb(255_255_255/0.16)] px-1.5 font-mono text-[11px]">A</kbd>
              </button>
              <button type="button" onClick={() => setMode("edit")} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
                <PenLine className="size-4" strokeWidth={1.75} /> Edit <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">E</kbd>
              </button>
              {row.styleFlags && (
                <button type="button" onClick={fix} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40">
                  <Sparkles className="size-4" strokeWidth={1.75} /> Fix <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">G</kbd>
                </button>
              )}
              <button type="button" onClick={() => setMode("reject")} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink-mid)] hover:bg-[var(--surface-2)]">
                Reject <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">R</kbd>
              </button>
              <div className="ml-auto flex items-center gap-1">
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
      </aside>
    </>
  );
}

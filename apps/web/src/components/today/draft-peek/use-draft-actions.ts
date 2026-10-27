"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { QueueRow } from "@/lib/today/rows";
import { regenerateOffReason } from "@/lib/copy/regenerable";
import { fixDraft, regenerateDraft, saveDraftEdit, type RegenerateResult, type ReviewActionState } from "@/app/(app)/approvals/actions";
import { trackFirstDraftApproved } from "@/lib/analytics/activation";
import { approveFromToday, rejectDraftWithReason, undoApproveDraft, undoRejectDraft } from "@/app/(app)/today/actions";
import { applyIfCurrent, nextAfterRemoval } from "../peek-result";
import type { RejectReason } from "../work-card/reject-reasons";
import { undoToast } from "./toasts";
import { settleRemoval } from "./settle";
import { steerNote } from "./steer-box";
import { failed, type DraftText, type Inflight, type Outcome, type PeekMode } from "./types";

/**
 * The peek's server calls (approve / reject / suppress / save / fix / regenerate) and the
 * per-draft in-flight model. In-flight work is keyed by send id: a slow rewrite on one draft
 * never locks the others — every gate reads THIS draft's entry. Late results for a draft that
 * is no longer open are dropped (`applyIfCurrent`, Review Focus 1).
 */
export function useDraftActions({
  row,
  rows,
  openId,
  mode,
  setMode,
  editBody,
  setEditBody,
  steer,
  setError,
  onRemoved,
  onNavigate,
  onClose,
  onSuppress,
}: {
  row: QueueRow | null;
  rows: QueueRow[];
  openId: string | null;
  mode: PeekMode;
  setMode: (m: PeekMode) => void;
  editBody: string;
  setEditBody: (b: string) => void;
  steer: string;
  setError: (e: string | null) => void;
  onRemoved: (id: string, outcome: Outcome) => void;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onSuppress?: (id: string) => Promise<{ error?: string }>;
}) {
  // Text the server returned for a draft (save / fix / regenerate), keyed by send id — the
  // row props are never mutated; the list is re-fetched on the next navigation/refresh.
  const [texts, setTexts] = useState<Record<string, DraftText>>({});
  const [inflight, setInflight] = useState<Record<string, Inflight>>({});

  // Live values for async results (drop a late result for another draft).
  const openIdRef = useRef(openId);
  const rowsRef = useRef(rows);
  useEffect(() => {
    openIdRef.current = openId;
    rowsRef.current = rows;
  }, [openId, rows]);

  const current = useMemo<DraftText | null>(() => (row ? (texts[row.id] ?? { body: row.body, styleFlags: row.styleFlags }) : null), [row, texts]);
  const regenOff = row ? regenerateOffReason(row) : null;
  const canRegenerate = row !== null && regenOff === null;
  const doing: Inflight | undefined = row ? inflight[row.id] : undefined;
  /** this draft has a call in flight — every action on it waits */
  const locked = doing !== undefined;

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
  const store = useCallback((sendId: string, t: DraftText) => setTexts((prev) => ({ ...prev, [sendId]: t })), []);

  /**
   * Run a queue removal. The next step is computed BEFORE the server call, so it never depends
   * on whether the revalidated list commits before the await returns.
   */
  const remove = useCallback(
    async (id: string, kind: Inflight, outcome: Outcome, call: () => Promise<{ error?: string }>, announce: () => void) => {
      const step = nextAfterRemoval(
        rowsRef.current.map((r) => r.id),
        id,
        openIdRef.current
      );
      begin(id, kind);
      const res = await call().catch(failed);
      end(id);
      settleRemoval(id, res, step, {
        currentId: openIdRef.current,
        onError: setError,
        onRemoved: () => onRemoved(id, outcome),
        announce,
        onNavigate,
        onClose,
      });
    },
    [begin, end, setError, onRemoved, onNavigate, onClose]
  );

  const approve = useCallback(async () => {
    if (!row || locked || mode === "edit") return;
    const id = row.id;
    const sends = row.sends.held ? "held until the sender is back" : `sends ${row.sends.label}`;
    await remove(id, "approve", "approved", () => approveFromToday(id), () => {
      trackFirstDraftApproved();
      undoToast(`Approved · ${sends}`, () => void undoApproveDraft(id));
    });
  }, [row, locked, mode, remove]);

  const reject = useCallback(
    async (reason: RejectReason) => {
      if (!row || locked) return;
      const id = row.id;
      await remove(id, "reject", "rejected", () => rejectDraftWithReason(id, reason), () => undoToast("Rejected", () => void undoRejectDraft(id)));
    },
    [row, locked, remove]
  );

  const suppress = useCallback(async () => {
    if (!row || locked || !onSuppress) return;
    const id = row.id;
    await remove(id, "suppress", "suppressed", () => onSuppress(id), () => void toast("Declined · they won't be contacted again"));
  }, [row, locked, onSuppress, remove]);

  const startEdit = useCallback(() => {
    if (!current || locked) return;
    setEditBody(current.body);
    setError(null);
    setMode("edit");
  }, [current, locked, setEditBody, setError, setMode]);

  const startReject = useCallback(() => {
    if (locked) return;
    setMode("reject");
  }, [locked, setMode]);

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
    if (live.error) return setError(live.error);
    store(id, { body: live.body ?? editBody, styleFlags: live.styleFlags ?? null });
    setMode("read");
    toast("Saved");
  }, [row, locked, editBody, begin, end, store, setError, setMode]);

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
    if (live.error) return setError(live.error);
    if (live.body === undefined) return void toast("Nothing to fix on this draft.");
    store(id, { body: live.body, styleFlags: live.styleFlags ?? null });
    toast(live.notice ?? "Cleaned up — give it a read, then approve.");
  }, [row, locked, current, begin, end, store, setError]);

  const regenerate = useCallback(async () => {
    if (!row || locked) return;
    if (!canRegenerate) return setError(regenOff ?? "Only first-touch drafts can be regenerated.");
    const id = row.id;
    const note = steerNote(steer);
    setError(null);
    setMode("read");
    begin(id, "regenerate");
    const res: RegenerateResult = await regenerateDraft(id, note).catch(failed);
    end(id);
    const live = applyIfCurrent(openIdRef.current, { sendId: id, ...res });
    if (!live) return;
    if (live.error || live.body === undefined) return setError(live.error ?? "Couldn't regenerate right now. Try again.");
    store(id, { body: live.body, styleFlags: live.styleFlags ?? null });
    toast("New draft ready — give it a read.");
  }, [row, locked, canRegenerate, regenOff, steer, begin, end, store, setError, setMode]);

  return { current, doing, locked, regenOff, approve, reject, suppress, startEdit, startReject, saveEdit, fix, regenerate };
}

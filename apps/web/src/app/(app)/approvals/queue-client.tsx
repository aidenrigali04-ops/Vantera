"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PANEL } from "@/components/app/surface";
import { QueueList } from "@/components/today/work-card/queue-list";
import { DraftPeek } from "@/components/today/draft-peek";
import type { QueueRow } from "@/lib/today/rows";
import type { ActionTileSpec } from "@/lib/today/tiles";
import { resumeEngine } from "@/app/(app)/engine-actions";
import { declineAndSuppress } from "./actions";
import { BlockersStack } from "./blockers-stack";
import { ModeSwitch, type SendModeChoice } from "./mode-switch";
import { reconcileRemoved, resolveOpenDraft, rowsKey } from "./queue-nav";

const KEYS: Array<[string, string]> = [
  ["A", "Approve"],
  ["E", "Edit"],
  ["G", "Regenerate with your steer note"],
  ["R", "Reject with a reason"],
  ["← →", "Previous / next draft"],
  ["Esc", "Leave edit, reject, or steer"],
  ["?", "Show or hide these keys"],
];

/**
 * The interactive shell of Approvals' Queue: the list on the left, the open draft on the
 * right. `?draft=` is the URL state (deep-linkable from Today); with none the first row
 * opens. Rows leave optimistically on approve / reject / decline — the peek itself moves on
 * to the next draft, so this shell only marks rows removed.
 */
export function QueueClient({
  rows,
  total,
  capped,
  page,
  per,
  blockers,
  sendMode,
  campaignId,
  draftParam,
  emptyState,
}: {
  rows: QueueRow[];
  total: number;
  capped: boolean;
  page: number;
  per: number;
  blockers: ActionTileSpec[];
  sendMode: "automatic" | "review" | "manual" | null;
  campaignId: string | null;
  draftParam: string | null;
  /** the server-rendered empty state (only when the page loaded empty) */
  emptyState: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  // the pane's × closes the draft until the owner picks another one
  const [closed, setClosed] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [optimisticMode, setOptimisticMode] = useState<SendModeChoice | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  // the optimistic send mode holds until the server's mode changes under it
  const [syncedMode, setSyncedMode] = useState(sendMode);
  if (syncedMode !== sendMode) {
    setSyncedMode(sendMode);
    setOptimisticMode(null);
  }

  // Every action revalidates /approvals, so a changed row set is server truth: drop removed ids
  // the server no longer returns (an Undo that brings one back shows it again) and reopen the
  // pane (render-time reset, no stale frame). Keyed by the row ids, not the array reference:
  // a same-rows re-render (e.g. the × updating ?draft) must not reopen the pane it just closed.
  const key = rowsKey(rows);
  const [syncedKey, setSyncedKey] = useState(key);
  if (syncedKey !== key) {
    setSyncedKey(key);
    setRemoved((prev) => reconcileRemoved(prev, rows.map((r) => r.id)));
    setClosed(false);
  }

  const visible = useMemo(() => rows.filter((r) => !removed.has(r.id)), [rows, removed]);
  const openId = closed
    ? null
    : resolveOpenDraft(
        rows.map((r) => r.id),
        draftParam,
        removed
      );

  const hrefFor = useCallback(
    (draft: string | null) => {
      const sp = new URLSearchParams();
      if (page > 1) sp.set("page", String(page));
      if (draft) sp.set("draft", draft);
      const qs = sp.toString();
      return qs ? `/approvals?${qs}` : "/approvals";
    },
    [page]
  );

  const onOpen = useCallback(
    (id: string) => {
      setClosed(false);
      router.replace(hrefFor(id), { scroll: false });
    },
    [router, hrefFor]
  );

  const onClose = useCallback(() => {
    setClosed(true);
    router.replace(hrefFor(null), { scroll: false });
  }, [router, hrefFor]);

  // the peek navigates to the next draft itself; here the row only leaves the list
  // a tapped row below lg: the pane sits under the list, so bring it into view
  const onTap = useCallback(
    (id: string) => {
      onOpen(id);
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        requestAnimationFrame(() => paneRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      }
    },
    [onOpen]
  );

  const onRemoved = useCallback((id: string) => {
    setRemoved((prev) => new Set(prev).add(id));
  }, []);

  const onSuppress = useCallback(async (id: string) => {
    const fd = new FormData();
    fd.set("sendId", id);
    const res = await declineAndSuppress({}, fd);
    return { error: res.error };
  }, []);

  const onResume = useCallback(() => {
    startTransition(async () => {
      const res = await resumeEngine();
      if (res.error) toast(res.error);
      else {
        toast("Engine resumed");
        router.refresh();
      }
    });
  }, [router]);

  // the last row on this page left: fetch the next page (or the caught-up state)
  const drained = rows.length > 0 && visible.length === 0;
  useEffect(() => {
    if (drained) router.refresh();
  }, [drained, router]);

  // ? toggles the key map (never while typing or inside a dialog)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Esc always closes the key map — checked before `defaultPrevented`, because the pane's
      // DraftPeek binds its keydown first and claims Esc to leave edit / reject mode.
      if (e.key === "Escape") {
        setShowKeys(false);
        return;
      }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[role="alertdialog"]')) return;
      const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT" || target.isContentEditable);
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        setShowKeys((s) => !s);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // only ids the current rows still contain count as pending removals (never double-subtract)
  const shownTotal = Math.max(0, total - rows.filter((r) => removed.has(r.id)).length);
  const totalPages = Math.max(1, Math.ceil(total / per));
  const review = (optimisticMode ?? (sendMode === "automatic" ? "automatic" : "review")) !== "automatic";

  const controls = (
    <>
      {review && <p className="text-[13px] text-[var(--ink-mid)]">Nothing is sent without your approval.</p>}
      <BlockersStack blockers={blockers} onResume={onResume} />
      <ModeSwitch sendMode={sendMode} campaignId={campaignId} optimistic={optimisticMode} onOptimistic={setOptimisticMode} />
    </>
  );

  if (visible.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex max-w-[380px] flex-col gap-4">{controls}</div>
        {drained || !emptyState ? (
          <div className={cn(PANEL, "px-6 py-10 text-center text-[14px] text-[var(--ink-dim)]")}>Queue&apos;s clear. Loading what&apos;s next…</div>
        ) : (
          emptyState
        )}
        {page > 1 && (
          <Link className="text-[13px] text-[var(--ink-mid)] underline underline-offset-2" href="/approvals">
            Back to the first page
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
      {/* left: trust line · blockers · mode · the list · pages */}
      <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
        {controls}
        <div className={cn(PANEL, "px-4 py-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto")}>
          <QueueList rows={visible} activeId={openId} onOpen={onTap} interactive={false} />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 text-[13px] text-[var(--ink-dim)]">
          <span>
            {totalPages > 1 ? (
              <>
                Page <span className="font-mono">{page}</span> of <span className="font-mono">{totalPages}</span> ·{" "}
              </>
            ) : null}
            <span className="font-mono">{capped ? "500+" : shownTotal}</span> draft{!capped && shownTotal === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-3">
            {page > 1 && (
              <Link className="text-[var(--ink-mid)] underline underline-offset-2" href={page === 2 ? "/approvals" : `/approvals?page=${page - 1}`}>
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link className="text-[var(--ink-mid)] underline underline-offset-2" href={`/approvals?page=${page + 1}`}>
                Next
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowKeys((s) => !s)}
              aria-expanded={showKeys}
              aria-controls="approvals-keys"
              className="inline-flex h-6 items-center gap-1 rounded-[var(--r-chip)] px-1.5 text-[var(--ink-dim)] ring-1 ring-[var(--line)] hover:text-[var(--ink)]"
            >
              Keys <kbd className="font-mono text-[11px]">?</kbd>
            </button>
          </span>
        </div>
        {showKeys && (
          <dl id="approvals-keys" className={cn(PANEL, "grid shrink-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-[13px]")}>
            {KEYS.map(([k, label]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="font-mono text-[12px] font-semibold text-[var(--ink)]">{k}</kbd>
                </dt>
                <dd className="text-[var(--ink-mid)]">{label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* right: the open draft */}
      <div ref={paneRef} className={cn(PANEL, "flex min-h-[480px] min-w-0 scroll-mt-4 flex-col overflow-hidden lg:min-h-0")}>
        {openId ? (
          <DraftPeek
            variant="pane"
            rows={visible}
            openId={openId}
            onClose={onClose}
            onNavigate={onOpen}
            onRemoved={onRemoved}
            onSuppress={onSuppress}
          />
        ) : (
          <div className="grid flex-1 place-items-center px-6 py-10 text-center text-[14px] text-[var(--ink-dim)]">
            Pick a draft from the list to read it before you approve.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TodayView, QueueRow } from "@/lib/today/rows";
import { resumeEngine } from "@/app/(app)/engine-actions";
import { dismissAsk, markTodayViewed, rejectDraftWithReason, undoRejectDraft, type RejectReason } from "./actions";
import { BannerSlot, Greeting, StatRow, ActionTileRow, Wash, TodayPageFrame } from "@/components/today";
import { WorkCard } from "@/components/today/work-card";
import { DraftPeek } from "@/components/today/draft-peek";

type Tab = "queue" | "replies" | "activity";

const LATER_KEY = "vantera:today:later";

function readLater(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(LATER_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function writeLater(ids: string[]) {
  try {
    sessionStorage.setItem(LATER_KEY, JSON.stringify(ids));
  } catch {
    /* private mode etc. — Later simply won't persist across reloads */
  }
}

/**
 * The interactive shell of Today: URL-driven tab + peek state, the session-only "Later"
 * ordering, optimistic row removal after approve/reject, the resume action, and the
 * visit stamp. Everything else is the server-rendered view.
 */
export function TodayClient({ view, tab, openDraftId }: { view: TodayView; tab: Tab; openDraftId: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [later, setLater] = useState<string[]>([]);

  // Visit stamp — after render, never during (the next "Since {time}" reads it).
  useEffect(() => {
    void markTodayViewed();
  }, []);
  // sessionStorage is browser-only, so the first paint must match the server ([]), then the
  // stored order arrives. Deferred into a transition so it never cascades a synchronous
  // re-render out of the effect.
  useEffect(() => {
    const stored = readLater();
    if (stored.length > 0) startTransition(() => setLater(stored));
  }, []);

  const queueRows: QueueRow[] = useMemo(() => {
    const live = view.queue.rows.filter((r) => !removed.has(r.id));
    const deferred = new Set(later);
    return [...live.filter((r) => !deferred.has(r.id)), ...live.filter((r) => deferred.has(r.id))];
  }, [view.queue.rows, removed, later]);

  const setUrl = useCallback(
    (next: { tab?: Tab; draft?: string | null }) => {
      const sp = new URLSearchParams();
      const t = next.tab ?? tab;
      if (t !== view.defaultTab) sp.set("tab", t);
      const d = next.draft === undefined ? openDraftId : next.draft;
      if (d) sp.set("draft", d);
      const qs = sp.toString();
      router.replace(qs ? `/today?${qs}` : "/today", { scroll: false });
    },
    [router, tab, openDraftId, view.defaultTab]
  );

  const onOpenDraft = useCallback((id: string) => setUrl({ draft: id }), [setUrl]);
  const onClosePeek = useCallback(() => setUrl({ draft: null }), [setUrl]);

  const onLater = useCallback(
    (id: string) => {
      const next = [...later.filter((x) => x !== id), id];
      setLater(next);
      writeLater(next);
      toast("Moved to later", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            const undone = next.filter((x) => x !== id);
            setLater(undone);
            writeLater(undone);
          },
        },
      });
    },
    [later]
  );

  const onRemoved = useCallback((id: string) => {
    setRemoved((prev) => new Set(prev).add(id));
  }, []);

  const onReject = useCallback(
    async (id: string, reason: RejectReason) => {
      const res = await rejectDraftWithReason(id, reason);
      if (res.error) {
        toast(res.error);
        return;
      }
      onRemoved(id);
      toast("Rejected", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            void undoRejectDraft(id).then(() => {
              setRemoved((prev) => {
                const n = new Set(prev);
                n.delete(id);
                return n;
              });
              router.refresh();
            });
          },
        },
      });
    },
    [onRemoved, router]
  );

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

  const onDismiss = useCallback(
    (kind: string) => {
      startTransition(async () => {
        await dismissAsk(kind);
        router.refresh();
      });
    },
    [router]
  );

  const emptyTiles = view.paused
    ? "Nothing needs you right now. The engine is paused — resume it from the workspace menu."
    : view.nextRunLabel
      ? `Nothing needs you right now. Next drafts are expected around ‹${view.nextRunLabel}›.`
      : "Nothing needs you right now.";

  return (
    <TodayPageFrame>
      <Wash />
      <div className="relative">
        <BannerSlot banner={view.banner} className="mb-7" />
        <Greeting greeting={view.greeting} sentence={view.sentence} primary={view.primary} glyph={primaryGlyph(view.primary)} onResume={onResume} />
        <StatRow stats={view.stats} className="mt-7" />
        <ActionTileRow tiles={view.tiles} onDismiss={onDismiss} onResume={onResume} emptyText={emptyTiles} className="mt-12" />
        <WorkCard
          view={{ ...view, queue: { ...view.queue, rows: queueRows, total: Math.max(0, view.queue.total - removed.size) } }}
          tab={tab}
          onOpenDraft={onOpenDraft}
          onLater={onLater}
          onReject={onReject}
          onResume={onResume}
        />
        <DraftPeek key={openDraftId ?? "closed"} rows={queueRows} openId={openDraftId} onClose={onClosePeek} onNavigate={onOpenDraft} onRemoved={(id) => onRemoved(id)} />
      </div>
    </TodayPageFrame>
  );
}

function primaryGlyph(p: TodayView["primary"]): "queue" | "inbox" | "reconnect" | "payment" | "resume" {
  if (!p) return "queue";
  if (p.inline === "resume") return "resume";
  if (p.href.startsWith("/inbox")) return "inbox";
  if (p.href.startsWith("/settings/billing")) return "payment";
  if (p.href.startsWith("/settings/senders")) return "reconnect";
  return "queue";
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SEGMENT_TRACK, segmentClass } from "@/components/app/surface";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateSendMode } from "@/app/(app)/playbook/actions";

export type SendModeChoice = "automatic" | "review";
type Mode = SendModeChoice;

/**
 * Autopilot | Review — the Outreach agent's send mode, switchable where the drafts are.
 * Turning Autopilot on is the most consequential control here, so it confirms (same copy as
 * the playbook card); switching back to Review is one click. `manual` / unset read as Review.
 */
export function ModeSwitch({
  sendMode,
  campaignId,
  optimistic,
  onOptimistic,
}: {
  sendMode: "automatic" | "review" | "manual" | null;
  campaignId: string | null;
  /** the caller-owned optimistic mode (the trust line follows it); null = server value */
  optimistic: Mode | null;
  onOptimistic: (mode: Mode | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // optimistic: the segment moves at once; a failed write snaps it back
  const setOptimistic = onOptimistic;
  const server: Mode = sendMode === "automatic" ? "automatic" : "review";
  const current = optimistic ?? server;

  if (!campaignId) return null;

  const switchTo = (next: Mode) => {
    if (next === current || pending) return;
    setOptimistic(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("campaignId", campaignId);
      fd.set("sendMode", next);
      const res = await updateSendMode({}, fd).catch(() => ({ error: "Something went wrong. Try again." }));
      if (res.error) {
        setOptimistic(null);
        toast.error(res.error);
        return;
      }
      toast(next === "automatic" ? "Autopilot on · clean drafts send on their own" : "Review on · every draft waits for you");
      // the optimistic value holds until the refreshed server mode arrives (the caller resets it)
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-[var(--ink-dim)]" id="send-mode-label">
        Send mode
      </span>
      <div role="group" aria-labelledby="send-mode-label" className={cn(SEGMENT_TRACK, pending && "opacity-70")}>
        <ConfirmDialog
          title="Send automatically?"
          description="Clean drafts go out on their own within your safety limits. Anything the style check flags still waits for you in Approvals. You can switch back anytime."
          confirmLabel="Turn on automatic sending"
          onConfirm={() => switchTo("automatic")}
          trigger={(open) => (
            <button
              type="button"
              aria-pressed={current === "automatic"}
              disabled={pending}
              onClick={() => current !== "automatic" && open()}
              className={segmentClass(current === "automatic")}
            >
              Autopilot
            </button>
          )}
        />
        <button
          type="button"
          aria-pressed={current === "review"}
          disabled={pending}
          onClick={() => switchTo("review")}
          className={segmentClass(current === "review")}
        >
          Review
        </button>
      </div>
    </div>
  );
}

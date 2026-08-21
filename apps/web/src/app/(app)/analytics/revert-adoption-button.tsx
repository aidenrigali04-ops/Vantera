"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { revertAdoption } from "./optimize-actions";

/**
 * R2: reverting an adopted play is a real strategy change — it confirms, shows pending,
 * and announces the outcome (the old form was one silent click with zero feedback).
 */
export function RevertAdoptionButton({ experimentId }: { experimentId: string }) {
  const [pending, start] = useTransition();

  return (
    <ConfirmDialog
      title="Revert to the previous approach?"
      description="New drafts go back to the approach used before this adoption. Messages already written keep the play that wrote them, and Vera keeps testing from here."
      confirmLabel="Revert"
      onConfirm={() =>
        start(async () => {
          const fd = new FormData();
          fd.set("id", experimentId);
          await revertAdoption(fd);
          toast.success("Reverted — new drafts use the previous approach.");
        })
      }
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          disabled={pending}
          className="mt-3 inline-flex items-center rounded-lg border border-[var(--hairline)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
        >
          {pending ? "Reverting…" : "Revert to the previous approach"}
        </button>
      )}
    />
  );
}

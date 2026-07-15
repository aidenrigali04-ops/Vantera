"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveAllClean } from "./actions";

/** P1 bulk approve: one click for every CLEAN draft — flagged copy still needs human eyes.
 *  R1b: the outcome toasts, so the queue emptying isn't the only signal. */
export function BulkApprove({ cleanCount }: { cleanCount: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (cleanCount === 0) return null;
  return (
    <form
      action={(fd) => {
        setPending(true);
        setError(null);
        void approveAllClean({}, fd)
          .then((res) => {
            if (res.error) {
              setError(res.error);
              toast.error(res.error);
            } else {
              toast.success(
                res.notice ?? `Approved ${cleanCount} clean draft${cleanCount === 1 ? "" : "s"} — queued to send.`
              );
            }
          })
          .finally(() => setPending(false));
      }}
      className="flex items-center gap-2"
    >
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <CheckCheck className="size-4" />
        {pending ? "Approving…" : `Approve all clean (${cleanCount})`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

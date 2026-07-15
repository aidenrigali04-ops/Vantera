"use client";

import { useActionState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveAllClean, type ReviewActionState } from "./actions";

/** P1 bulk approve: one click for every CLEAN draft — flagged copy still needs human eyes. */
export function BulkApprove({ cleanCount }: { cleanCount: number }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(approveAllClean, {});
  if (cleanCount === 0) return null;
  return (
    <form action={action} className="flex items-center gap-2">
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <CheckCheck className="size-4" />
        {pending ? "Approving…" : `Approve all clean (${cleanCount})`}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

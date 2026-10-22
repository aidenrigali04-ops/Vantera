"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setLeadFit, type FitState } from "@/app/(app)/prospects/fit-actions";
import type { FitVerdict } from "@/lib/learning/fit";

/** ML-4: "Good fit" / "Not a fit" on any prospect — teaches the agent who you want to talk to. */
export function LeadFitControls({ leadId, verdict }: { leadId: string; verdict: FitVerdict | null }) {
  const [state, action, pending] = useActionState<FitState, FormData>(setLeadFit, { verdict });
  const current = state.verdict === undefined ? verdict : state.verdict;

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">Is this who you want?</p>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        {current ? (
          <>
            <span className="text-sm">
              {current === "good_fit"
                ? "Marked a good fit — your agent looks for more like this."
                : "Marked not a fit — excluded from outreach, and your agent avoids people like this."}
            </span>
            <Button type="submit" name="verdict" value="clear" size="sm" variant="ghost" disabled={pending}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" name="verdict" value="good_fit" size="sm" variant="outline" disabled={pending}>
              Good fit
            </Button>
            <Button type="submit" name="verdict" value="not_fit" size="sm" variant="outline" disabled={pending}>
              Not a fit
            </Button>
          </>
        )}
      </form>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </section>
  );
}

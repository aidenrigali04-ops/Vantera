"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { setLeadFit, type FitState } from "@/app/(app)/prospects/fit-actions";
import { FIT_REASON_MAX, type FitVerdict } from "@/lib/learning/fit";

/** ML-4: "Good fit" / "Not a fit" on any prospect — teaches the agent who you want to talk to.
 *  "Not a fit" asks for an optional one-line reason first (`askReason` opens that step directly —
 *  the peek's footer button uses it). */
export function LeadFitControls({
  leadId,
  verdict,
  reason = null,
  askReason = false,
}: {
  leadId: string;
  verdict: FitVerdict | null;
  /** the saved "why not a fit" note, shown with the verdict */
  reason?: string | null;
  askReason?: boolean;
}) {
  const [state, action, pending] = useActionState<FitState, FormData>(setLeadFit, { verdict });
  const [asking, setAsking] = useState(askReason);
  const [savedReason, setSavedReason] = useState(reason);
  const current = state.verdict === undefined ? verdict : state.verdict;

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Is this who you want?</p>
      <form
        action={(fd) => {
          const v = fd.get("verdict");
          if (v === "not_fit") setSavedReason(String(fd.get("reason") ?? "").trim() || null);
          if (v === "clear") setSavedReason(null);
          setAsking(false);
          return action(fd);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="leadId" value={leadId} />
        {current ? (
          <>
            <span className="text-sm">
              {current === "good_fit"
                ? "Marked a good fit — your agent looks for more like this."
                : "Marked not a fit — excluded from outreach, and your agent avoids people like this."}
              {current === "not_fit" && savedReason && (
                <span className="mt-1 block text-xs text-muted-foreground">Reason: {savedReason}</span>
              )}
            </span>
            <Button type="submit" name="verdict" value="clear" size="sm" variant="ghost" disabled={pending}>
              Undo
            </Button>
          </>
        ) : asking ? (
          <div className="w-full space-y-2">
            <input
              type="text"
              name="reason"
              maxLength={FIT_REASON_MAX}
              autoFocus
              placeholder="Why not? (optional) — e.g. too small a team"
              aria-label="Why this prospect is not a fit"
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm placeholder:text-muted-foreground/60 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" name="verdict" value="not_fit" size="sm" disabled={pending}>
                Mark not a fit
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button type="submit" name="verdict" value="good_fit" size="sm" variant="outline" disabled={pending}>
              Good fit
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setAsking(true)}>
              Not a fit
            </Button>
          </>
        )}
      </form>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </section>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  markClosedWon,
  pushLeadToCrm,
  type LeadCrmActionState,
} from "@/app/(app)/leads/crm-actions";

// Close-tracking + CRM push controls on the lead profile. Marking closed-won auto-pushes to
// any destination with auto-push on; once closed, a manual "Push to CRM" re-pushes on demand.
export function LeadCrmControls({ leadId, status }: { leadId: string; status: string }) {
  const converted = status === "converted";
  const [closeState, closeAction, closing] = useActionState<LeadCrmActionState, FormData>(
    markClosedWon,
    {}
  );
  const [pushState, pushAction, pushing] = useActionState<LeadCrmActionState, FormData>(
    pushLeadToCrm,
    {}
  );

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">Deal &amp; CRM</p>
      {!converted ? (
        <form action={closeAction} className="space-y-2">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="flex gap-2">
            <Input
              name="dealValue"
              inputMode="decimal"
              placeholder="Deal value, e.g. 12000"
              className="h-9"
              aria-label="Deal value in dollars"
            />
            <Button type="submit" size="sm" disabled={closing} className="shrink-0">
              {closing ? "Saving…" : "Mark closed-won"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Marks the deal won and pushes it to any CRM with auto-push on.
          </p>
          {closeState.success && <p className="text-xs text-muted-foreground">{closeState.success}</p>}
          {closeState.error && <p className="text-xs text-destructive">{closeState.error}</p>}
        </form>
      ) : (
        <form action={pushAction} className="space-y-2">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Closed-won</span>
            <Button type="submit" size="sm" variant="outline" disabled={pushing} className="shrink-0">
              {pushing ? "Pushing…" : "Push to CRM"}
            </Button>
          </div>
          {pushState.success && <p className="text-xs text-muted-foreground">{pushState.success}</p>}
          {pushState.error && <p className="text-xs text-destructive">{pushState.error}</p>}
        </form>
      )}
    </section>
  );
}

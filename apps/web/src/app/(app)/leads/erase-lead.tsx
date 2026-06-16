"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { eraseLead } from "./gdpr-actions";

/** GDPR erasure control for the lead drawer: reveal → confirm → erase. Admin-only (server-enforced). */
export function EraseLead({ leadId, onErased }: { leadId: string; onErased: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-destructive"
      >
        Erase this prospect (GDPR)
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-xs text-muted-foreground">
        Permanently erase this prospect and all of their data. Their email and LinkedIn are added to
        your suppression list so they&rsquo;re never contacted again. This can&rsquo;t be undone.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await eraseLead(leadId);
              if (res.error) setError(res.error);
              else onErased();
            })
          }
        >
          {pending ? "Erasing…" : "Erase permanently"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

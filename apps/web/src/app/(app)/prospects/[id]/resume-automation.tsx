"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resumeAutomation } from "../reply-actions";

/** Hand a taken-over thread back to Vera — the paused note's one-click way out. */
export function ResumeAutomation({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <p className="text-xs text-muted-foreground">Vera has the thread again — follow-ups resume.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-muted-foreground">
        You&apos;re driving this thread — automation is paused until you hand it back.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resumeAutomation(leadId);
            if (r.error) setError(r.error);
            else setDone(true);
          })
        }
      >
        {pending ? "Resuming…" : "Resume automation"}
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

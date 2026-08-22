"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAgentNow } from "./actions";

/**
 * T4: verify-your-config-now instead of waiting a cadence cycle. The run is the same
 * task the cron fires (same per-account serialization) — this only moves it up.
 */
export function RunNowButton({ agentId }: { agentId: string }) {
  const [busy, setBusy] = useState(false);

  const submit = (fd: FormData) => {
    setBusy(true);
    runAgentNow(fd)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Run started — results land here in a few minutes.");
      })
      .finally(() => setBusy(false));
  };

  return (
    <form action={submit}>
      <input type="hidden" name="agentId" value={agentId} />
      <Button type="submit" variant="ghost" size="sm" disabled={busy}>
        <Play className="size-4" /> {busy ? "Starting…" : "Run now"}
      </Button>
    </form>
  );
}

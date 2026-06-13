"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "./accept-actions";

export function AcceptButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    startTransition(async () => {
      setError(null);
      const result = await acceptInvite(token);
      if (result?.error) setError(result.error);
      // on success acceptInvite calls redirect("/dashboard") — no explicit handling needed
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleAccept} disabled={isPending} className="w-full">
        {isPending ? "Joining workspace…" : "Accept invitation"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

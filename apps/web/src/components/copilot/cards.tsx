"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// --- ConfirmationCard ---

interface ConfirmationCardProps {
  summary: string;
  onApprove: () => void;
  onDecline: () => void;
}

export function ConfirmationCard({ summary, onApprove, onDecline }: ConfirmationCardProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm space-y-3">
      <p className="text-foreground">{summary}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="ghost" onClick={onDecline}>
          Decline
        </Button>
      </div>
    </div>
  );
}

// --- OutcomeCard ---

interface OutcomeCardProps {
  summary: string;
  deepLink?: string;
  undoable: boolean;
  onUndo?: () => void;
}

export function OutcomeCard({ summary, deepLink, undoable, onUndo }: OutcomeCardProps) {
  const [canUndo, setCanUndo] = useState(undoable);

  useEffect(() => {
    if (!undoable) return;
    const timer = setTimeout(() => setCanUndo(false), 30_000);
    return () => clearTimeout(timer);
  }, [undoable]);

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm space-y-2">
      <p className="text-foreground">{summary}</p>
      <div className="flex gap-2 flex-wrap">
        {deepLink && (
          <Button size="sm" variant="outline" asChild>
            <Link href={deepLink}>View</Link>
          </Button>
        )}
        {canUndo && onUndo && (
          <Button size="sm" variant="ghost" onClick={onUndo}>
            Undo
          </Button>
        )}
      </div>
    </div>
  );
}

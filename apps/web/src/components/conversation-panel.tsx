"use client";

import { useState } from "react";
import { ConversationThread, Composer } from "@/components/conversation";
import { mergePendingTurns, type PendingSend } from "@/lib/conversation-merge";
import type { ThreadTurn } from "@/lib/conversations";

/**
 * R1d: thread + composer with optimistic echo — your queued reply appears in the thread
 * instantly (marked "Sending…") instead of silently vanishing into the send queue. Layout
 * stays with the caller via the two wrapper classNames (inbox panes vs. lead-brief column).
 */
export function ConversationPanel({
  leadId,
  turns,
  initialDraft = "",
  draftSource = null,
  threadClassName,
  composerClassName,
}: {
  leadId: string;
  turns: ThreadTurn[];
  initialDraft?: string;
  draftSource?: string | null;
  threadClassName?: string;
  composerClassName?: string;
}) {
  const [pendingSends, setPendingSends] = useState<PendingSend[]>([]);
  const merged = mergePendingTurns(turns, pendingSends);

  return (
    <>
      <div className={threadClassName}>
        <ConversationThread turns={merged} />
      </div>
      <div className={composerClassName}>
        <Composer
          leadId={leadId}
          initialDraft={initialDraft}
          draftSource={draftSource}
          onQueued={(text) =>
            setPendingSends((prev) => [...prev, { text, at: new Date().toISOString() }])
          }
        />
      </div>
    </>
  );
}

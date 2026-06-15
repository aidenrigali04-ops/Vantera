"use client";

import { useState, useTransition } from "react";
import { Bot, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendManualReply, delegateToAgent, type ReplyState } from "./reply-actions";

/**
 * Reply pause/handoff: the lead replied and the sequence paused. The user can
 * respond themselves or let the agent handle it (stubbed). The choice is the
 * point — respond yourself OR delegate, never a silent dead end.
 */
export function ReplyHandoff({
  leadId,
  channel,
}: {
  leadId: string;
  channel: "email" | "linkedin";
}) {
  const [body, setBody] = useState("");
  const [state, setState] = useState<ReplyState | null>(null);
  const [pending, start] = useTransition();

  function respond() {
    start(async () => setState(await sendManualReply(leadId, channel, body)));
  }
  function delegate() {
    start(async () => setState(await delegateToAgent(leadId)));
  }

  if (state?.sent) {
    return (
      <p className="flex items-center gap-2 text-xs text-foreground">
        <CheckCircle2 className="size-3.5" aria-hidden /> Reply queued — it&apos;ll send shortly.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Reply on ${channel === "linkedin" ? "LinkedIn" : "email"}…`}
        rows={3}
        className="text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={respond} disabled={pending || !body.trim()}>
          <Send className="size-4" /> Send reply
        </Button>
        <Button size="sm" variant="outline" onClick={delegate} disabled={pending}>
          <Bot className="size-4" /> Let agent handle
        </Button>
      </div>
      {state?.error && <p className="text-xs text-muted-foreground">{state.error}</p>}
    </div>
  );
}

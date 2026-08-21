"use client";

import { useState, useTransition } from "react";
import { Bot, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendManualReply, resumeAutomation, delegateToAgent, type ReplyState } from "./reply-actions";

/**
 * Reply pause/handoff: the lead replied and the sequence paused. The user can
 * respond themselves or let the agent handle it (stubbed). The choice is the
 * point — respond yourself OR delegate, never a silent dead end.
 *
 * Once the user sends a manual reply the thread is human-driven (`paused`): the agent stands
 * down and never messages on top of them. The pause is shown here with a one-click Resume so it
 * is visible and reversible — a taken-over thread is never a silent dead end for automation.
 */
export function ReplyHandoff({
  leadId,
  channel,
  queuedBody = null,
  paused = false,
}: {
  leadId: string;
  channel: "email" | "linkedin";
  /** A reply already queued/in-flight for this lead (server-derived). Without it the queued
   *  state lived only in client state — a reload brought the compose box back with no trace,
   *  and re-sending the "lost" reply delivered a duplicate to the prospect. */
  queuedBody?: string | null;
  /** The lead's sequence run is paused_reply — a human took the thread over. Surfaces the
   *  "you're handling this · Resume automation" control. */
  paused?: boolean;
}) {
  const [body, setBody] = useState("");
  const [state, setState] = useState<ReplyState | null>(null);
  const [resumed, setResumed] = useState(false);
  const [pending, start] = useTransition();

  function respond() {
    start(async () => setState(await sendManualReply(leadId, channel, body)));
  }
  function delegate() {
    start(async () => setState(await delegateToAgent(leadId)));
  }
  function resume() {
    start(async () => {
      const r = await resumeAutomation(leadId);
      if (r.sent) setResumed(true);
      else setState(r);
    });
  }

  // A manual reply this session (state.sent) OR the takeover this reply caused (paused) keeps the
  // agent stood down. Show the resume control in either case — but not once the user has resumed.
  const takenOver = (paused || state?.sent) && !resumed;

  const composer =
    state?.sent || queuedBody ? (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-xs text-foreground">
          <CheckCircle2 className="size-3.5" aria-hidden /> Reply queued — it&apos;ll send shortly.
        </p>
        {(state?.sent ? body.trim() : queuedBody) && (
          <p className="border-l-2 border-[var(--hairline)] pl-2 text-xs text-muted-foreground lg:line-clamp-3">
            {state?.sent ? body.trim() : queuedBody}
          </p>
        )}
      </div>
    ) : (
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

  return (
    <div className="space-y-3">
      {composer}
      {takenOver && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--hairline)] bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            You&apos;re handling this thread — automation is paused.
          </p>
          <Button size="sm" variant="ghost" onClick={resume} disabled={pending}>
            Resume automation
          </Button>
        </div>
      )}
      {resumed && (
        <p className="text-xs text-muted-foreground">
          Automation resumed — the agent will follow up if they go quiet.
        </p>
      )}
    </div>
  );
}

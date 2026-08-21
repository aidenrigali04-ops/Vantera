"use client";

import { useState, useTransition } from "react";
import { Bot, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ThreadTurn } from "@/lib/conversations";
import { sendManualReply, draftWithVera, delegateToAgent } from "@/app/(app)/leads/reply-actions";

/**
 * The conversation cockpit's shared surface (L2): the full two-way thread + a composer that
 * opens pre-drafted. Used by /inbox and the lead page — one component so they can't drift.
 */

const CLASS_CHIP: Record<string, string> = {
  interested: "bg-[var(--positive)]/10 text-[var(--positive)]",
  not_interested: "bg-foreground/[0.06] text-muted-foreground",
};

export function ConversationThread({ turns }: { turns: ThreadTurn[] }) {
  if (turns.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No messages yet — write the first one below, or let Vera open.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {turns.map((t, i) => (
        <li key={i} className={cn("flex", t.role === "agent" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              t.role === "agent"
                ? "bg-[var(--cyan-tint)] text-foreground"
                : "bg-foreground/[0.05] text-foreground"
            )}
          >
            <p className="whitespace-pre-wrap">{t.text}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
              {t.role === "agent" ? (
                <span className="inline-flex items-center gap-1">
                  {t.manual ? <UserRound className="size-3" /> : <Bot className="size-3" />}
                  {t.manual ? "You" : "Vera"}
                </span>
              ) : (
                <span>Them</span>
              )}
              {t.playLabel && <span className="italic">play: {t.playLabel}</span>}
              {t.classification && CLASS_CHIP[t.classification] !== undefined && (
                <span className={cn("rounded-full px-1.5 py-0.5", CLASS_CHIP[t.classification])}>
                  {t.classification.replace("_", " ")}
                </span>
              )}
              {t.pending ? (
                <span className="font-medium text-[var(--cyan-strong)]">Sending…</span>
              ) : (
                <span>{new Date(t.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Composer({
  leadId,
  initialDraft = "",
  draftSource = null,
  onQueued,
}: {
  leadId: string;
  /** a queued agent draft, when one exists — "pre-drafted, one click to send" */
  initialDraft?: string;
  draftSource?: string | null;
  /** R1d: notifies the thread so the sent message echoes immediately */
  onQueued?: (text: string) => void;
}) {
  const [body, setBody] = useState(initialDraft);
  const [note, setNote] = useState<string | null>(
    initialDraft ? (draftSource ?? "Vera drafted this — edit or send.") : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your message…"
        rows={4}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const sentText = body;
              const res = await sendManualReply(leadId, "linkedin", sentText);
              if (res.error) setError(res.error);
              else {
                setBody("");
                setNote("Queued — it sends through the normal pacing.");
                onQueued?.(sentText);
              }
            })
          }
        >
          {pending ? "Working…" : "Send"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await draftWithVera(leadId);
              if (res.error) setError(res.error);
              else {
                setBody(res.message ?? "");
                setNote(
                  res.flagged
                    ? "Vera drafted this, but flagged its own style — give it a once-over."
                    : "Vera drafted this — edit or send."
                );
              }
            })
          }
        >
          <Sparkles className="size-3.5" /> Draft with Vera
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await delegateToAgent(leadId);
              if (res.error) setError(res.error);
              else setNote("Vera has the thread — the reply is queued and follow-ups resume.");
            })
          }
        >
          Let Vera handle it
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

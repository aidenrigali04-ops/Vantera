import { AlertTriangle, MessageSquare, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";

export type ProcessedSend = {
  id: string;
  body: string | null;
  status: string;
  error: string | null;
  linkedin_stage: "invite" | "message" | null;
  created_at: string;
};

export type ConversationReply = {
  id: string;
  body: string | null;
  classification: string | null;
  received_at: string;
};

export interface ProcessedConversationGroup {
  lead: LeadProfile | null;
  sends: ProcessedSend[];
  replies: ConversationReply[];
}

// Post-review lifecycle (rule 08). "sent" is the win state for transparency — it's proof the
// agent actually messaged on the user's behalf, which is the whole point of this log.
const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  canceled: "Canceled",
  suppressed: "Suppressed",
};

const REPLY_LABELS: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  neutral: "Neutral",
  out_of_office: "Out of office",
  bounce: "Bounce",
  unsubscribe: "Unsubscribe",
  other: "Reply",
};

const statusVariant = (status: string): "default" | "secondary" | "destructive" =>
  status === "failed" ? "destructive" : status === "sent" ? "default" : "secondary";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Invite is dispatched before its follow-up; replies slot in by arrival time. A merged,
// time-ordered timeline reads as one conversation thread.
const STAGE_ORDER: Record<string, number> = { invite: 0, message: 1 };

type TimelineItem =
  | { kind: "out"; at: number; tiebreak: number; send: ProcessedSend }
  | { kind: "in"; at: number; tiebreak: number; reply: ConversationReply };

function buildTimeline(sends: ProcessedSend[], replies: ConversationReply[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...sends.map((s) => ({
      kind: "out" as const,
      at: Date.parse(s.created_at),
      tiebreak: STAGE_ORDER[s.linkedin_stage ?? "message"] ?? 1,
      send: s,
    })),
    ...replies.map((r) => ({
      kind: "in" as const,
      at: Date.parse(r.received_at),
      tiebreak: 9,
      reply: r,
    })),
  ];
  return items.sort((a, b) => a.at - b.at || a.tiebreak - b.tiebreak);
}

/** One outbound message bubble — the actual copy the agent sent on the user's behalf. */
function OutboundBubble({ send }: { send: ProcessedSend }) {
  const isInvite = send.linkedin_stage === "invite";
  const failed = send.status === "failed";
  return (
    <div className="ml-auto max-w-[85%] space-y-1.5">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {isInvite ? "Connection request" : "Message"} · your agent
        </span>
        <Badge variant={statusVariant(send.status)} className="shrink-0">
          {STATUS_LABELS[send.status] ?? send.status}
        </Badge>
      </div>
      <div
        className={`rounded-2xl rounded-tr-sm border px-3.5 py-2.5 text-sm ${
          failed
            ? "border-destructive/40 bg-destructive/5"
            : "border-primary/30 bg-primary/[0.07]"
        }`}
      >
        {isInvite ? (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <UserPlus className="size-3.5 shrink-0" />
            Sent as a connection request (LinkedIn invites go without a note).
          </p>
        ) : send.body ? (
          <p className="whitespace-pre-wrap">{send.body}</p>
        ) : (
          <p className="text-muted-foreground">No copy recorded.</p>
        )}
        {failed && send.error && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {send.error}
          </p>
        )}
      </div>
    </div>
  );
}

/** One inbound reply bubble — the prospect's actual response, with its classification. */
function InboundBubble({ reply, name }: { reply: ConversationReply; name: string }) {
  return (
    <div className="mr-auto max-w-[85%] space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{name}</span>
        {reply.classification && (
          <Badge
            variant={reply.classification === "interested" ? "default" : "secondary"}
            className="shrink-0"
          >
            {REPLY_LABELS[reply.classification] ?? "Reply"}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{fmtDate(reply.received_at)}</span>
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/40 px-3.5 py-2.5 text-sm">
        {reply.body ? (
          <p className="whitespace-pre-wrap">{reply.body}</p>
        ) : (
          <p className="text-muted-foreground">(no message content)</p>
        )}
      </div>
    </div>
  );
}

/**
 * One prospect's full outreach conversation — every message the agent sent on the user's
 * behalf (the copy itself, not just a status) interleaved with the prospect's replies.
 * This is the transparency surface for always-approve users, who never see drafts in the
 * Queue: the Processed log is the only place they can read what actually went out.
 */
export function ProcessedConversation({
  group,
  defaultOpen = false,
}: {
  group: ProcessedConversationGroup;
  defaultOpen?: boolean;
}) {
  const { lead, sends, replies } = group;
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown prospect";
  const firstName = lead?.first_name || "Prospect";
  const context = [lead?.title, lead?.company_name].filter(Boolean).join(" · ");
  const timeline = buildTimeline(sends, replies);
  const latest = sends.find((s) => s.status === "sent") ?? sends[sends.length - 1];

  return (
    <Panel className="overflow-hidden p-0">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.02]">
          <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {name}
              {lead?.company_name ? <span className="text-muted-foreground"> · {lead.company_name}</span> : ""}
            </p>
            {context && <p className="truncate text-sm text-muted-foreground">{context}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {replies.length > 0 && (
              <span className="inline-flex items-center gap-1 text-foreground/70" title="Replies received">
                <MessageSquare className="size-3.5" />
                {replies.length}
              </span>
            )}
            {latest && (
              <Badge variant={statusVariant(latest.status)}>
                {STATUS_LABELS[latest.status] ?? latest.status}
              </Badge>
            )}
          </div>
        </summary>

        <div className="space-y-4 border-t border-border px-4 py-4">
          {lead && (
            <LeadProfileLink
              lead={lead}
              className="text-left text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              View full prospect profile →
            </LeadProfileLink>
          )}
          <div className="space-y-4">
            {timeline.map((item) =>
              item.kind === "out" ? (
                <OutboundBubble key={item.send.id} send={item.send} />
              ) : (
                <InboundBubble key={item.reply.id} reply={item.reply} name={firstName} />
              )
            )}
          </div>
        </div>
      </details>
    </Panel>
  );
}

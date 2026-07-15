import Link from "next/link";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { type LeadProfile } from "@/components/lead-profile";
import { BulkApprove } from "./bulk-approve";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import { type DraftRow } from "./draft-card";
import { ProspectReviewCard, type ProspectGroup } from "./prospect-review-card";
import {
  ProcessedConversation,
  type ProcessedConversationGroup,
  type ProcessedSend,
  type ConversationReply,
} from "./processed-conversation";

/** Group queue drafts by prospect, preserving the rows' (created_at) order. */
function groupByProspect(rows: DraftRow[]): ProspectGroup[] {
  const groups: ProspectGroup[] = [];
  const index = new Map<string, number>();
  for (const d of rows) {
    const key = d.leads?.id ?? `none-${d.id}`;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, groups.length);
      groups.push({ lead: d.leads, drafts: [d] });
    } else {
      groups[at]!.drafts.push(d);
    }
  }
  return groups;
}

/**
 * Group processed sends by prospect (first-seen order = most recent activity first), then
 * attach each prospect's replies. The Processed tab thereby reads as a conversation log:
 * always-approve users never see drafts in the Queue, so this is the only surface where they
 * can read the actual copy the agent sent on their behalf — and the prospect's responses.
 */
function groupProcessed(rows: ProcessedSendRow[], repliesByLead: Map<string, ConversationReply[]>) {
  const groups: ProcessedConversationGroup[] = [];
  const index = new Map<string, number>();
  for (const r of rows) {
    const leadId = r.leads?.id ?? null;
    const key = leadId ?? `none-${r.id}`;
    const send: ProcessedSend = {
      id: r.id,
      body: r.body,
      status: r.status,
      error: r.error,
      linkedin_stage: r.linkedin_stage,
      created_at: r.created_at,
    };
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, groups.length);
      groups.push({
        lead: r.leads,
        sends: [send],
        replies: leadId ? repliesByLead.get(leadId) ?? [] : [],
      });
    } else {
      groups[at]!.sends.push(send);
    }
  }
  return groups;
}

const VIEWS = ["queue", "processed"] as const;

// post-approve lifecycle statuses (rule 08): everything past the review gate
const PROCESSED_STATUSES = [
  "approved",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "canceled",
  "suppressed",
] as const;

type ProcessedSendRow = {
  id: string;
  channel: "linkedin";
  body: string | null;
  status: string;
  error: string | null;
  linkedin_stage: "invite" | "message" | null;
  created_at: string;
  leads: LeadProfile | null;
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view = VIEWS.includes(rawView as (typeof VIEWS)[number])
    ? (rawView as (typeof VIEWS)[number])
    : "queue";
  const supabase = await createClient();

  const select = `id, channel, subject, body, style_flags, linkedin_stage, status, error, created_at, leads(${LEAD_PROFILE_FIELDS})`;

  let query = supabase
    .from("scheduled_sends")
    .select(select, { count: "exact" })
    .order("created_at", { ascending: view === "queue" })
    .limit(50);
  query =
    view === "queue"
      ? query.eq("status", "pending_review")
      : query.in("status", PROCESSED_STATUSES as unknown as string[]);
  const { data: rows, count } = await query;

  const groups = view === "queue" ? groupByProspect((rows ?? []) as unknown as DraftRow[]) : [];

  // Processed tab: pull the prospects' replies (RLS-scoped) so the log reads as a real
  // conversation — the agent's copy and the prospect's responses, not just statuses.
  let processedGroups: ProcessedConversationGroup[] = [];
  if (view === "processed" && rows && rows.length > 0) {
    const processedRows = rows as unknown as ProcessedSendRow[];
    const leadIds = Array.from(
      new Set(processedRows.map((r) => r.leads?.id).filter((id): id is string => Boolean(id)))
    );
    const repliesByLead = new Map<string, ConversationReply[]>();
    if (leadIds.length > 0) {
      const { data: replyRows } = await supabase
        .from("replies")
        .select("id, body, classification, received_at, lead_id")
        .in("lead_id", leadIds)
        .order("received_at", { ascending: true });
      for (const reply of (replyRows ?? []) as Array<ConversationReply & { lead_id: string }>) {
        const list = repliesByLead.get(reply.lead_id) ?? [];
        list.push({
          id: reply.id,
          body: reply.body,
          classification: reply.classification,
          received_at: reply.received_at,
        });
        repliesByLead.set(reply.lead_id, list);
      }
    }
    processedGroups = groupProcessed(processedRows, repliesByLead);
  }

  const withChannel = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    return `/review?${sp.toString()}`;
  };

  return (
    // One-screen on desktop: header + view tabs pinned; the queue scrolls in its own region.
    <div className="mx-auto flex w-full max-w-3xl flex-col lg:h-[calc(100dvh-3rem)]">
      <div className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-5">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {view === "queue"
            ? `${count ?? 0} draft${count === 1 ? "" : "s"} across ${groups.length} prospect${
                groups.length === 1 ? "" : "s"
              } waiting. Nothing sends without your approval.`
            : `${count ?? 0} message${count === 1 ? "" : "s"} past review — approved, scheduled, sent, or stopped.`}
        </p>
        </div>
        {view === "queue" && (
          <BulkApprove cleanCount={(rows ?? []).filter((r) => !r.style_flags).length} />
        )}
      </div>

      <div className="mb-5 shrink-0">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-1 text-sm">
          {VIEWS.map((v) => {
            const isActive = view === v;
            return (
              <Link
                key={v}
                href={withChannel(v === "queue" ? {} : { view: v })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-lg px-3 py-1.5 font-medium transition-colors",
                  isActive
                    ? "bg-white text-foreground shadow-[var(--shadow-sm)] ring-1 ring-[var(--hairline)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "queue" ? "Queue" : "Processed"}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 lg:overflow-y-auto">

      {!rows || rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 border-dashed py-10 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <h2 className="font-heading text-base font-semibold">
            {view === "queue" ? "Queue's clear" : "Nothing processed yet"}
          </h2>
          <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
            {view === "queue" ? (
              <>
                When your Outreach Agent drafts messages for qualified leads, every one lands here
                for your sign-off first. Check{" "}
                <Link href="/agents" className="underline underline-offset-2">
                  your agents
                </Link>{" "}
                are live.
              </>
            ) : (
              "Approved drafts schedule at a human-like pace, then send. They'll show up here with their status."
            )}
          </p>
        </Panel>
      ) : view === "queue" ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <ProspectReviewCard
              key={g.lead?.id ?? g.drafts[0]!.id}
              group={g}
              defaultOpen={groups.length === 1}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {processedGroups.map((g, i) => (
            <ProcessedConversation
              key={g.lead?.id ?? g.sends[0]!.id}
              group={g}
              defaultOpen={processedGroups.length === 1 || i === 0}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

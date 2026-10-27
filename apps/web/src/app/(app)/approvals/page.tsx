import Link from "next/link";
import { CheckCircle2, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orThrow } from "@/lib/supabase/guard";
import { Panel } from "@/components/ui/panel";
import { PageHeader, SEGMENT_TRACK, segmentClass } from "@/components/app/surface";
import { type LeadProfile } from "@/components/lead-profile";
import { BulkApprove } from "./bulk-approve";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import { loadQueuePage } from "@/lib/today/queue-page";
import { QueueClient } from "./queue-client";
import {
  ProcessedConversation,
  type ProcessedConversationGroup,
  type ProcessedSend,
  type ConversationReply,
} from "./processed-conversation";

export const metadata = { title: "Approvals" };

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
  searchParams: Promise<{ view?: string; page?: string; draft?: string }>;
}) {
  const { view: rawView, page: rawPage, draft: rawDraft } = await searchParams;
  const view = VIEWS.includes(rawView as (typeof VIEWS)[number])
    ? (rawView as (typeof VIEWS)[number])
    : "queue";
  // R4: real pagination — the old hard .limit(50) made drafts 51+ unreachable while the
  // header still counted them.
  const PER = 50;
  const page = Math.max(1, Number(rawPage) || 1);
  const supabase = await createClient();

  return view === "queue"
    ? queueView(supabase, page, PER, typeof rawDraft === "string" && rawDraft ? rawDraft : null)
    : processedView(supabase, page, PER);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function ViewTabs({ view }: { view: (typeof VIEWS)[number] }) {
  return (
    <div className="mb-5 shrink-0">
      <div className={SEGMENT_TRACK}>
        {VIEWS.map((v) => {
          const isActive = view === v;
          return (
            <Link
              key={v}
              href={v === "queue" ? "/approvals" : `/approvals?view=${v}`}
              aria-current={isActive ? "page" : undefined}
              className={segmentClass(isActive)}
            >
              {v === "queue" ? "Queue" : "Processed"}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Queue: the shared queue rows, two panes — the list and the open draft. */
async function queueView(supabase: Supabase, page: number, per: number, draft: string | null) {
  const q = await loadQueuePage(supabase, { page, per });

  // An empty queue after real reviews is a finish line, not a blank page: it gets its own
  // "all caught up" state with the next places to go (only read when the queue is empty).
  let emptyState: React.ReactNode = null;
  if (q.rows.length === 0) {
    const { count: reviewed } = await supabase
      .from("scheduled_sends")
      .select("id", { count: "exact", head: true })
      .neq("status", "pending_review");
    emptyState = (reviewed ?? 0) > 0 ? <CaughtUp /> : <EmptyPanel view="queue" />;
  }

  const count = q.capped ? "500+" : String(q.total);
  return (
    // One-screen on desktop: header + view tabs pinned; the list and the draft scroll inside.
    <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:min-h-0 lg:flex-1">
      <PageHeader
        className="mb-5"
        title="Approvals"
        subtitle={`${count} draft${q.total === 1 && !q.capped ? "" : "s"} waiting. Read each one, then approve, edit, or reject.`}
      >
        <BulkApprove cleanCount={q.rows.filter((r) => !r.styleFlags).length} />
      </PageHeader>
      <ViewTabs view="queue" />
      <QueueClient
        key={page}
        rows={q.rows}
        total={q.total}
        capped={q.capped}
        page={page}
        per={per}
        blockers={q.blockers}
        sendMode={q.sendMode}
        campaignId={q.campaignId}
        draftParam={draft}
        emptyState={emptyState}
      />
    </div>
  );
}

/** Processed: the conversation log past approval (unchanged). */
async function processedView(supabase: Supabase, page: number, PER: number) {
  const view = "processed" as const;
  const from = (page - 1) * PER;
  const select = `id, channel, subject, body, style_flags, linkedin_stage, status, error, created_at, leads(${LEAD_PROFILE_FIELDS})`;

  const res = await supabase
    .from("scheduled_sends")
    .select(select, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PER - 1)
    .in("status", PROCESSED_STATUSES as unknown as string[]);
  const rows = orThrow(res, "Approvals");
  const count = res.count;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER));

  // Processed tab: pull the prospects' replies (RLS-scoped) so the log reads as a real
  // conversation — the agent's copy and the prospect's responses, not just statuses.
  let processedGroups: ProcessedConversationGroup[] = [];
  if (rows && rows.length > 0) {
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

  return (
    // One-screen on desktop: header + view tabs pinned; the log scrolls in its own region.
    <div className="mx-auto flex w-full max-w-3xl flex-col lg:min-h-0 lg:flex-1">
      <PageHeader
        className="mb-5"
        title="Approvals"
        subtitle={`${count ?? 0} message${count === 1 ? "" : "s"} past approval — approved, scheduled, sent, or stopped.`}
      />
      <ViewTabs view={view} />

      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {!rows || rows.length === 0 ? (
          <EmptyPanel view={view} />
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {count} messages
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Link className="underline underline-offset-2" href={pageHref(view, page - 1)}>
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link className="underline underline-offset-2" href={pageHref(view, page + 1)}>
                  Next
                </Link>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CaughtUp() {
  return (
    <Panel className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-[var(--positive-tint)] text-[var(--positive)]">
        <CheckCircle2 className="size-5" strokeWidth={2} />
      </span>
      <h2 className="font-heading text-base font-semibold">You&apos;re all caught up</h2>
      <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
        Everything you approved sends at a human pace. New drafts land here as more prospects
        qualify.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Link
          href="/inbox"
          className="rounded-[var(--r-btn)] bg-[var(--ink)] px-3.5 py-2 text-sm font-medium text-[var(--ink-fg)] transition-opacity hover:opacity-90"
        >
          Check the Inbox
        </Link>
        <Link
          href="/approvals?view=processed"
          className="rounded-[var(--r-btn)] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
        >
          See what&apos;s sending
        </Link>
      </div>
    </Panel>
  );
}

function EmptyPanel({ view }: { view: (typeof VIEWS)[number] }) {
  return (
    <Panel className="flex flex-col items-center gap-3 border-dashed py-10 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-[#d5efdf] text-[#13824a]">
        <Inbox className="size-5" strokeWidth={2} />
      </span>
      <h2 className="font-heading text-base font-semibold">
        {view === "queue" ? "Queue's clear" : "Nothing processed yet"}
      </h2>
      <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
        {view === "queue" ? (
          <>
            When your Outreach Agent drafts messages for qualified prospects, every one lands here
            for your sign-off first. Check{" "}
            <Link href="/playbook" className="underline underline-offset-2">
              your playbook
            </Link>{" "}
            is live.
          </>
        ) : (
          "Approved drafts schedule at a human-like pace, then send. They'll show up here with their status."
        )}
      </p>
    </Panel>
  );
}

/** R4: /approvals URLs with view + page preserved. */
function pageHref(view: string, page: number): string {
  const sp = new URLSearchParams();
  if (view !== "queue") sp.set("view", view);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/approvals?${s}` : "/approvals";
}

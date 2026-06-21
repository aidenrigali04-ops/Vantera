import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import { type DraftRow } from "./draft-card";
import { ProspectReviewCard, type ProspectGroup } from "./prospect-review-card";

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

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  canceled: "Canceled",
  suppressed: "Suppressed",
};

type ProcessedRow = {
  id: string;
  channel: "linkedin";
  subject: string | null;
  status: string;
  error: string | null;
  linkedin_stage: "invite" | "message" | null;
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

  const withChannel = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    return `/review?${sp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Eyebrow>Your sign-off</Eyebrow>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {view === "queue"
            ? `${count ?? 0} draft${count === 1 ? "" : "s"} across ${groups.length} prospect${
                groups.length === 1 ? "" : "s"
              } waiting. Nothing sends without your approval.`
            : `${count ?? 0} message${count === 1 ? "" : "s"} past review — approved, scheduled, sent, or stopped.`}
        </p>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={withChannel(v === "queue" ? {} : { view: v })}
            className={`rounded-full border px-3 py-1 capitalize ${
              view === v ? "border-primary bg-primary/10 font-medium" : "border-border"
            }`}
          >
            {v === "queue" ? "Queue" : "Processed"}
          </Link>
        ))}
      </div>

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
        <div className="overflow-hidden rounded-lg border border-border">
          {(rows as unknown as ProcessedRow[]).map((r) => {
            const name =
              [r.leads?.first_name, r.leads?.last_name].filter(Boolean).join(" ") ||
              "Unknown prospect";
            const failed = r.status === "failed";
            return (
              <div key={r.id} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <MessageSquare className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <LeadProfileLink
                    lead={r.leads}
                    className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                  >
                    {name}
                    {r.leads?.company_name ? ` · ${r.leads.company_name}` : ""}
                  </LeadProfileLink>
                  {r.subject && <p className="truncate text-xs text-muted-foreground">{r.subject}</p>}
                  {failed && r.error && (
                    <p className="mt-1 text-xs text-destructive">{r.error}</p>
                  )}
                </div>
                {r.linkedin_stage && (
                  <Badge variant="secondary">
                    {r.linkedin_stage === "invite" ? "Invite" : "Follow-up"}
                  </Badge>
                )}
                <Badge variant={failed ? "destructive" : r.status === "sent" ? "default" : "secondary"}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

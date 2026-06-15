import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { shapePipeline } from "../pipeline/queries";
import {
  buildRevenueSeries,
  computeRevenueSnapshot,
} from "@/lib/revenue";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import type { LeadProfile } from "@/components/lead-profile";
import { DashboardView, type AgentRow, type ReplyRow } from "./dashboard-view";
import type { Prospect } from "./prospect-panel";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// Relative-time labels are formatted here on the server and passed to the client
// view as static strings — keeps Date.now() out of the client render (no hydration
// mismatch).
function timeUntil(iso: string | null): string {
  if (!iso) return "within ~15 min";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ~${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ~${hrs}h`;
  return `in ~${Math.round(hrs / 24)}d`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "no runs yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type AgentRowRaw = {
  id: string;
  kind: string;
  name: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
};

type ReplyRowRaw = {
  id: string;
  channel: "email" | "linkedin";
  body: string | null;
  received_at: string;
  lead_id: string;
  leads: LeadProfile | null;
};

export default async function DashboardPage() {
  const { user, account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const weekAgo = isoDaysAgo(7);

  // RLS scopes every query to this account (rule 02) — no account id is passed.
  const leadCount = (statuses?: string[]) => {
    let q = supabase.from("leads").select("id", { count: "exact", head: true });
    if (statuses) q = q.in("status", statuses);
    return q;
  };

  const [
    { data: agents },
    totalRes,
    qualifiedRes,
    outreachRes,
    repliedRes,
    repliedOnlyRes,
    convertedRes,
    draftsRes,
    interestedRes,
    { data: recentReplies },
    { data: mailboxes },
    { data: linkedinAccounts },
    { data: weekSends },
    repliesWeekRes,
    { data: prospects },
    { data: convertedDates },
    crmActiveRes,
  ] = await Promise.all([
    supabase
      .from("agents")
      .select("id, kind, name, status, last_run_at, next_run_at")
      .order("created_at", { ascending: true })
      .returns<AgentRowRaw[]>(),
    leadCount(),
    leadCount(["qualified", "enriched"]),
    leadCount(["in_campaign"]),
    leadCount(["replied", "converted"]),
    leadCount(["replied"]),
    leadCount(["converted"]),
    supabase
      .from("scheduled_sends")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("classification", "interested"),
    supabase
      .from("replies")
      .select(`id, channel, body, received_at, lead_id, leads(${LEAD_PROFILE_FIELDS})`)
      .eq("classification", "interested")
      .order("received_at", { ascending: false })
      .limit(4)
      .returns<ReplyRowRaw[]>(),
    supabase.from("mailboxes").select("status"),
    supabase.from("linkedin_accounts").select("status"),
    supabase.from("outreach_sends").select("channel").gte("sent_at", weekAgo),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .gte("received_at", weekAgo),
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, title, company_name, company_domain, company_size, industry, location, tech_stack, status, ai_score, ai_rationale, ai_insights, email, email_status, phone, phone_status, linkedin_url"
      )
      .in("status", ["qualified", "enriched", "in_campaign", "replied", "converted"])
      .order("ai_score", { ascending: false, nullsFirst: false })
      .limit(6)
      .returns<Prospect[]>(),
    // Closed-revenue history: conversion dates (updated_at) of converted leads.
    supabase
      .from("leads")
      .select("updated_at")
      .eq("status", "converted")
      .order("updated_at", { ascending: true })
      .returns<{ updated_at: string }[]>(),
    // Active CRM connections — drives the just-in-time "connect your CRM" nudge.
    supabase
      .from("crm_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const total = totalRes.count ?? 0;
  const qualified = qualifiedRes.count ?? 0;
  const inOutreach = outreachRes.count ?? 0;
  const replied = repliedRes.count ?? 0;
  const converted = convertedRes.count ?? 0;
  const drafts = draftsRes.count ?? 0;
  const interested = interestedRes.count ?? 0;
  const repliedOnly = repliedOnlyRes.count ?? 0;

  // Revenue snapshot: real counts × the account's value per client (Settings).
  const pipelineLeads = qualified + inOutreach + repliedOnly;
  const revenue = computeRevenueSnapshot({
    convertedClients: converted,
    pipeline: { qualified, inOutreach, replied: repliedOnly },
    avgDealValueCents: account.avg_deal_value_cents,
    goalCents: account.revenue_goal_cents,
  });
  const revenueSeries = buildRevenueSeries({
    conversionDates: (convertedDates ?? []).map((r) => r.updated_at),
    avgDealValueCents: account.avg_deal_value_cents,
    expectedPipelineCents: revenue.expectedCents,
    days: 30,
  });

  const agentRowsRaw = agents ?? [];
  const scout = agentRowsRaw.find((a) => a.kind === "scout") ?? null;
  const liveAgents = agentRowsRaw.filter((a) => a.status === "live");
  // Map to the view's shape with server-formatted labels (no client Date.now()).
  const agentRows: AgentRow[] = agentRowsRaw.map((a) => ({
    id: a.id,
    kind: a.kind,
    name: a.name,
    status: a.status,
    nextRunLabel: timeUntil(a.next_run_at),
  }));
  const replyRows: ReplyRow[] = (recentReplies ?? []).map((r) => ({
    id: r.id,
    channel: r.channel,
    body: r.body,
    receivedLabel: timeAgo(r.received_at),
    lead_id: r.lead_id,
    leads: r.leads,
  }));
  const goal = account.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : null;
  const firstName = user?.email?.split("@")[0] ?? "there";

  // Channel readiness — can the pipeline actually send?
  const mbActive = (mailboxes ?? []).filter((m) => m.status === "active").length;
  const mbWarming = (mailboxes ?? []).filter((m) => m.status === "warming").length;
  const mbTotal = (mailboxes ?? []).length;
  const liStatus = (linkedinAccounts ?? [])[0]?.status ?? null;

  // This week's momentum
  const sendsWeek = (weekSends ?? []).length;
  const emailWeek = (weekSends ?? []).filter((s) => s.channel === "email").length;
  const liWeek = (weekSends ?? []).filter((s) => s.channel === "linkedin").length;
  const repliesWeek = repliesWeekRes.count ?? 0;

  // State machine: an activation ramp before the first agent is live with no leads
  // yet; the working dashboard once either condition is met.
  const isNew = liveAgents.length === 0 && total === 0;

  // Pipeline pulse — leads moving through the outreach sequence (sequence_runs),
  // a compact mirror of the full /pipeline board.
  const { data: seqRuns } = await supabase
    .from("sequence_runs")
    .select("current_stage, status")
    .returns<{ current_stage: string; status: string }[]>();
  const pipeline = shapePipeline({
    runs: seqRuns ?? [],
    convertedClients: converted,
    avgDealValueCents: account.avg_deal_value_cents,
    revenueGoalCents: account.revenue_goal_cents,
  });

  // Just-in-time CRM nudge: a deal has closed but nothing is routing wins out yet.
  // Peak-end moment — surface it here rather than as pre-aha onboarding friction.
  const showCrmNudge = converted > 0 && (crmActiveRes.count ?? 0) === 0;

  return (
    <DashboardView
      firstName={firstName}
      icp={account.onboarding_icp}
      industry={account.onboarding_industry}
      goal={goal}
      goalCents={account.revenue_goal_cents}
      isNew={isNew}
      showCrmNudge={showCrmNudge}
      scoutDeployed={Boolean(scout)}
      drafts={drafts}
      agents={agentRows}
      liveAgentsCount={liveAgents.length}
      scoutNextRunLabel={timeUntil(scout?.next_run_at ?? null)}
      scoutLastRunLabel={timeAgo(scout?.last_run_at ?? null)}
      scoutLive={scout?.status === "live"}
      revenue={revenue}
      convertedClients={converted}
      pipelineLeads={pipelineLeads}
      series={revenueSeries}
      pipeline={pipeline}
      prospects={prospects ?? []}
      recentReplies={replyRows}
      interested={interested}
      channels={{ mbActive, mbWarming, mbTotal, liStatus }}
      week={{ sends: sendsWeek, email: emailWeek, li: liWeek, replies: repliesWeek }}
    />
  );
}

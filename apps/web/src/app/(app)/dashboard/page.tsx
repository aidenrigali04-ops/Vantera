import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { shapePipeline } from "../pipeline/queries";
import {
  buildRevenueSeries,
  computeGoalPace,
  computeRevenueSnapshot,
} from "@/lib/revenue";
import { loadSignalAttribution } from "@/lib/analytics";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import type { LeadProfile } from "@/components/lead-profile";
import { DashboardView, type AgentRow, type ReplyRow } from "./dashboard-view";
import type { Prospect } from "./prospect-panel";
import { ResultsTabsBar, resolveView } from "./results-tabs";
import { AnalyticsSection } from "../analytics/analytics-section";
import { PipelineSection } from "../pipeline/pipeline-section";

// The Results surface (Surface B). One destination, three views (Overview / Analytics / Pipeline)
// selected by ?view= so each is server-rendered and deep-linkable. Only the active view loads its
// data. Overview is the command-center home (OverviewTab below); the other two reuse the sections
// extracted from the former /analytics and /pipeline pages.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view = resolveView((await searchParams).view);
  return (
    <>
      <ResultsTabsBar active={view} />
      {view === "analytics" ? (
        <AnalyticsSection />
      ) : view === "pipeline" ? (
        <PipelineSection />
      ) : (
        <OverviewTab />
      )}
    </>
  );
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// Month-label for the goal-pace ETA — keeps Date.now() in a module helper, not render.
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

// Forward-projected month label (e.g. "March 2026") for a goal ETA. Kept at module
// scope — like timeUntil/timeAgo — so the impure Date.now() isn't called inline in
// the component's render body (React purity lint).
function etaMonthLabel(etaDays: number): string {
  return new Date(Date.now() + etaDays * 86_400_000).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
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
  channel: "linkedin";
  body: string | null;
  received_at: string;
  lead_id: string;
  leads: LeadProfile | null;
};

async function OverviewTab() {
  const { user, account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const weekAgo = isoDaysAgo(7);

  // RLS scopes every query to this account (rule 02) — no account id is passed.
  const [
    { data: agents },
    { data: leadCountRows },
    draftsRes,
    interestedRes,
    { data: recentReplies },
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
    // One RLS-scoped grouped aggregate (account_lead_counts) replaces six count:'exact' scans.
    supabase.rpc("account_lead_counts"),
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
    supabase.from("linkedin_accounts").select("status"),
    supabase.from("outreach_sends").select("channel").gte("sent_at", weekAgo),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .gte("received_at", weekAgo),
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, title, company_name, company_domain, company_size, industry, location, tech_stack, status, ai_score, ai_rationale, ai_insights, scored_at, email, email_status, phone, phone_status, linkedin_url, lead_signals(kind, label, detail, observed_at)"
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

  // status is single-valued per lead, so the multi-status figures are exact sums
  // of the per-status counts returned by the aggregate (no double counting).
  const leadCountList = (leadCountRows ?? []) as { status: string; n: number }[];
  const leadCounts = new Map(leadCountList.map((r): [string, number] => [r.status, Number(r.n)]));
  const countOf = (...ss: string[]) => ss.reduce((sum, s) => sum + (leadCounts.get(s) ?? 0), 0);
  const total = [...leadCounts.values()].reduce((a, b) => a + b, 0);
  const qualified = countOf("qualified", "enriched");
  const inOutreach = countOf("in_campaign");
  const replied = countOf("replied", "converted");
  const repliedOnly = countOf("replied");
  const converted = countOf("converted");
  const drafts = draftsRes.count ?? 0;
  const interested = interestedRes.count ?? 0;

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

  // Channel readiness — is LinkedIn connected? (the only channel, the activation gate)
  const liStatus = (linkedinAccounts ?? [])[0]?.status ?? null;

  // This week's momentum
  const sendsWeek = (weekSends ?? []).length;
  const liWeek = (weekSends ?? []).filter((s) => s.channel === "linkedin").length;
  const repliesWeek = repliesWeekRes.count ?? 0;

  // State machine: an activation ramp before the first agent is live with no leads
  // yet; the working dashboard once either condition is met.
  const isNew = liveAgents.length === 0 && total === 0;
  // Agents are live but the first run hasn't produced leads yet — the post-deploy waiting
  // window. Surface a "working now" state instead of a hollow dashboard of zeros so the
  // silence after launch never reads as "nothing's happening" (retention: show activity).
  const isWorkingEmpty = !isNew && liveAgents.length > 0 && total === 0;

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

  // Loss-aversion + variable-reward metrics for the retention panels.
  const dayAgo = isoDaysAgo(1);
  const coldCutoff = isoDaysAgo(3);
  const [coldRes, sent24Res, replies24Res, sourced24Res] = await Promise.all([
    // warm leads cooling: replied (not converted) and untouched 3+ days
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "replied")
      .lt("updated_at", coldCutoff),
    supabase.from("outreach_sends").select("id", { count: "exact", head: true }).gte("sent_at", dayAgo),
    supabase.from("replies").select("id", { count: "exact", head: true }).gte("received_at", dayAgo),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
  ]);
  const cold = coldRes.count ?? 0;
  const today = {
    sourced: sourced24Res.count ?? 0,
    sent: sent24Res.count ?? 0,
    replied: replies24Res.count ?? 0,
  };

  // The full live-pipeline funnel moved to the Pipeline tab (its dedicated home); the Overview
  // keeps only the compact pipeline pulse (built from `pipeline` above).

  // Just-in-time CRM nudge: a deal has closed but nothing is routing wins out yet.
  // Peak-end moment — surface it here rather than as pre-aha onboarding friction.
  const showCrmNudge = converted > 0 && (crmActiveRes.count ?? 0) === 0;

  // Peak-end: the most recent unread conversion drives a one-time celebration.
  const { data: winNote } = await supabase
    .from("lead_notifications")
    .select("id, lead_id")
    .eq("kind", "converted")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let conversionWin: { id: string; leadName: string } | null = null;
  if (winNote) {
    const { data: winLead } = await supabase
      .from("leads")
      .select("first_name, company_name")
      .eq("id", winNote.lead_id)
      .maybeSingle();
    conversionWin = {
      id: winNote.id,
      leadName: winLead?.company_name || winLead?.first_name || "A lead",
    };
  }

  // Peak-end: the most recent unread INTERESTED reply gets a one-time celebration (variable
  // reward — replies arrive unpredictably; make the moment rewarding). A not-interested reply
  // still notifies via the bell but never throws confetti.
  const { data: replyNote } = await supabase
    .from("lead_notifications")
    .select("id, lead_id")
    .eq("kind", "reply")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let replyWin: { id: string; leadName: string } | null = null;
  if (replyNote) {
    const { data: rLead } = await supabase
      .from("leads")
      .select("first_name, company_name, replies(classification, received_at)")
      .eq("id", replyNote.lead_id)
      .maybeSingle();
    const replies = (rLead?.replies ?? []) as {
      classification: string | null;
      received_at: string | null;
    }[];
    const latest = replies
      .slice()
      .sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""))[0];
    if (latest?.classification === "interested") {
      const name = rLead?.first_name?.trim();
      replyWin = {
        id: replyNote.id,
        leadName: name
          ? `${name}${rLead?.company_name ? ` at ${rLead.company_name}` : ""}`
          : rLead?.company_name || "A prospect",
      };
    }
  }

  // Explicit goal pace (forward projection) — formatted on the server, no client Date.now().
  const pace = computeGoalPace({
    conversionDates: (convertedDates ?? []).map((r) => r.updated_at),
    avgDealValueCents: account.avg_deal_value_cents,
    goalCents: account.revenue_goal_cents,
    convertedClients: converted,
  });
  let revenuePace: string | null = null;
  if (pace?.reached) {
    revenuePace = "You've cleared your monthly goal — time to raise it.";
  } else if (pace && pace.etaDays != null) {
    revenuePace = `On pace to hit your ${goal}/mo goal around ${etaMonthLabel(pace.etaDays)}.`;
  }

  // Signal→revenue attribution: which captured signals actually closed deals (the dependency
  // proof). Surfaced as a one-liner on Overview when there's at least one attributed win.
  const signalAttribution = await loadSignalAttribution(supabase);

  return (
    <DashboardView
      firstName={firstName}
      icp={account.onboarding_icp}
      industry={account.onboarding_industry}
      goal={goal}
      goalCents={account.revenue_goal_cents}
      isNew={isNew}
      isWorkingEmpty={isWorkingEmpty}
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
      cold={cold}
      today={today}
      revenuePace={revenuePace}
      conversionWin={conversionWin}
      replyWin={replyWin}
      prospects={prospects ?? []}
      recentReplies={replyRows}
      interested={interested}
      channels={{ liStatus }}
      week={{ sends: sendsWeek, li: liWeek, replies: repliesWeek }}
      attribution={signalAttribution}
    />
  );
}

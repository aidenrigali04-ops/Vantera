import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import {
  buildRevenueSeries,
  computeRevenueSnapshot,
} from "@/lib/revenue";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
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
  ] = await Promise.all([
    supabase
      .from("agents")
      .select("id, kind, name, status, last_run_at, next_run_at")
      .order("created_at", { ascending: true })
      .returns<AgentRow[]>(),
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
      .returns<ReplyRow[]>(),
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

  const agentRows = agents ?? [];
  const scout = agentRows.find((a) => a.kind === "scout") ?? null;
  const liveAgents = agentRows.filter((a) => a.status === "live");
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

  const funnel = [
    { label: "Sourced", count: total, href: "/leads" },
    { label: "Qualified", count: qualified, href: "/leads?tab=qualified" },
    { label: "In outreach", count: inOutreach, href: "/leads?tab=in_campaign" },
    { label: "Replied", count: replied, href: "/leads?tab=replied" },
    { label: "Converted", count: converted, href: "/leads?tab=replied" },
  ];
  const reached = funnel.filter((s) => s.count > 0).length;

  return (
    <DashboardView
      firstName={firstName}
      icp={account.onboarding_icp}
      industry={account.onboarding_industry}
      goal={goal}
      goalCents={account.revenue_goal_cents}
      isNew={isNew}
      scoutDeployed={Boolean(scout)}
      drafts={drafts}
      agents={agentRows}
      liveAgentsCount={liveAgents.length}
      scoutNextRun={scout?.next_run_at ?? null}
      scoutLastRun={scout?.last_run_at ?? null}
      scoutLive={scout?.status === "live"}
      revenue={revenue}
      convertedClients={converted}
      pipelineLeads={pipelineLeads}
      series={revenueSeries}
      funnel={funnel}
      reached={reached}
      prospects={prospects ?? []}
      recentReplies={recentReplies ?? []}
      interested={interested}
      channels={{ mbActive, mbWarming, mbTotal, liStatus }}
      week={{ sends: sendsWeek, email: emailWeek, li: liWeek, replies: repliesWeek }}
    />
  );
}

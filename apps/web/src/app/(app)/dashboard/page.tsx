import {
  buildTargetingProfile,
  describeStrategy,
  topTiltSegment,
  type CopyStrategy,
} from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { countInterestedSince } from "@/lib/optimize";
import { playCards } from "@/lib/plays";
import { shapePipeline } from "../pipeline/queries";
import {
  buildRevenueSeries,
  computeGoalPace,
  computeRevenueSnapshot,
} from "@/lib/revenue";
import { loadSignalAttribution } from "@/lib/analytics";
import { LEAD_PROFILE_FIELDS } from "@/components/lead-profile-fields";
import type { LeadProfile } from "@/components/lead-profile";
import { DashboardView, type AgentRow, type LearningProps, type ReplyRow } from "./dashboard-view";
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
    // One-screen on desktop: the tabs bar stays pinned and the PAGE never scrolls —
    // the active view scrolls inside its own region only when its content overflows.
    <div className="flex flex-col lg:h-[calc(100dvh-3rem)]">
      <ResultsTabsBar active={view} />
      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {view === "analytics" ? (
          <AnalyticsSection />
        ) : view === "pipeline" ? (
          <PipelineSection />
        ) : (
          <OverviewTab />
        )}
      </div>
    </div>
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
      .select(`id, channel, body, received_at, lead_id, leads(${LEAD_PROFILE_FIELDS})`)
      .eq("classification", "interested")
      .order("received_at", { ascending: false })
      .limit(24)
      .returns<ReplyRowRaw[]>(),
    supabase.from("linkedin_accounts").select("status"),
    supabase.from("outreach_sends").select("channel").gte("sent_at", weekAgo),
    // Warm replies this week — interested only. Counting every classification here made the
    // tile disagree with real activity (a not-interested reply is not a warm reply).
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("classification", "interested")
      .gte("received_at", weekAgo),
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, title, company_name, company_domain, company_size, industry, location, tech_stack, status, source, ai_score, ai_rationale, ai_insights, scored_at, email, email_status, phone, phone_status, linkedin_url, lead_signals(kind, label, detail, observed_at)"
      )
      .in("status", ["qualified", "enriched", "in_campaign", "replied", "converted"])
      .order("ai_score", { ascending: false, nullsFirst: false })
      .limit(6)
      .returns<Prospect[]>(),
    // Closed-revenue history + REAL per-deal values (P1: actuals over estimates).
    supabase
      .from("leads")
      .select("updated_at, deal_value_cents")
      .eq("status", "converted")
      .order("updated_at", { ascending: true })
      .returns<{ updated_at: string; deal_value_cents: number | null }[]>(),
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
  const repliedOnly = countOf("replied");
  const converted = countOf("converted");
  const drafts = draftsRes.count ?? 0;

  // Revenue snapshot: real counts × the account's value per client (Settings).
  const pipelineLeads = qualified + inOutreach + repliedOnly;
  // Actuals where actuals exist: real typed deal values beat the avg×count estimate.
  const closedActualCents = (convertedDates ?? []).reduce(
    (sum, r) => sum + (r.deal_value_cents ?? account.avg_deal_value_cents ?? 0),
    0
  );
  const revenue = computeRevenueSnapshot({
    convertedClients: converted,
    pipeline: { qualified, inOutreach, replied: repliedOnly },
    avgDealValueCents: account.avg_deal_value_cents,
    goalCents: account.revenue_goal_cents,
    closedActualCents,
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
  // Warm replies WAITING ON YOU — an interested reply counts only until it's answered.
  // Answered = any message DELIVERED to that lead after the reply landed (agent or manual;
  // markSent stamps updated_at) — or the lead already converted. Without this, handled
  // replies lingered as "waiting" and the queue read a step behind real activity.
  const interestedRows = (recentReplies ?? []).filter((r) => r.leads?.status !== "converted");
  const replyLeadIds = [...new Set(interestedRows.map((r) => r.lead_id))];
  const { data: sentAfter } = replyLeadIds.length
    ? await supabase
        .from("scheduled_sends")
        .select("lead_id, updated_at")
        .in("lead_id", replyLeadIds)
        .eq("status", "sent")
        .eq("linkedin_stage", "message")
        .returns<{ lead_id: string; updated_at: string }[]>()
    : { data: [] as { lead_id: string; updated_at: string }[] };
  const lastSentByLead = new Map<string, number>();
  for (const s of sentAfter ?? []) {
    const t = new Date(s.updated_at).getTime();
    if (t > (lastSentByLead.get(s.lead_id) ?? 0)) lastSentByLead.set(s.lead_id, t);
  }
  const waitingRows = interestedRows.filter(
    (r) => (lastSentByLead.get(r.lead_id) ?? 0) <= new Date(r.received_at).getTime()
  );
  const repliesWaiting = new Set(waitingRows.map((r) => r.lead_id)).size;
  const replyRows: ReplyRow[] = waitingRows.slice(0, 4).map((r) => ({
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
  // Hot-leads next-action chip: which of the (≤6) surfaced prospects have a draft
  // waiting in Review. Bounded to the surfaced ids; RLS scopes the rest (rule 02).
  const prospectIds = (prospects ?? []).map((p) => p.id).filter((id): id is string => Boolean(id));
  const [coldRes, sent24Res, replies24Res, sourced24Res, pendingDraftRes] = await Promise.all([
    // warm leads cooling: replied (not converted) and untouched 3+ days
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "replied")
      .lt("updated_at", coldCutoff),
    supabase.from("outreach_sends").select("id", { count: "exact", head: true }).gte("sent_at", dayAgo),
    supabase.from("replies").select("id", { count: "exact", head: true }).gte("received_at", dayAgo),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    prospectIds.length
      ? supabase
          .from("scheduled_sends")
          .select("lead_id")
          .eq("status", "pending_review")
          .in("lead_id", prospectIds)
          .returns<{ lead_id: string }[]>()
      : Promise.resolve({ data: [] as { lead_id: string }[] }),
  ]);
  const pendingDraftLeadIds = [...new Set((pendingDraftRes.data ?? []).map((r) => r.lead_id))];
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

  // Vera's learning log — the self-optimizing loop's visible heartbeat on the Overview
  // (retention brief: variable reward + goal-gradient against the silent-wait churn cliff).
  // Every line is a real, RLS-scoped fact: the live test with its enrollment progress, the
  // latest adoption with real receipts, and the targeting focus. Never a placeholder.
  const STAGE_LABEL: Record<string, string> = {
    acceptance: "connection accepts",
    reply: "interested replies",
    booking: "booked meetings",
    close: "closed deals",
  };
  const [{ data: runningExp }, { data: adoptedExp }, { data: playbook }] = await Promise.all([
    supabase
      .from("optimization_experiments")
      .select("id, stage_key, challenger_strategy, started_at, min_sample")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        stage_key: string;
        challenger_strategy: CopyStrategy;
        started_at: string;
        min_sample: number;
      }>(),
    supabase
      .from("optimization_experiments")
      .select("challenger_strategy, decision_reason, concluded_at")
      .eq("status", "adopted")
      .order("concluded_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        challenger_strategy: CopyStrategy;
        decision_reason: string | null;
        concluded_at: string | null;
      }>(),
    supabase.from("optimization_playbook").select("version").maybeSingle<{ version: number }>(),
  ]);

  let testing: LearningProps["testing"] = null;
  if (runningExp) {
    const { count: enrolled } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("experiment_id", runningExp.id);
    testing = {
      label: describeStrategy(runningExp.challenger_strategy ?? {}),
      stageLabel: STAGE_LABEL[runningExp.stage_key] ?? runningExp.stage_key,
      startedAgo: timeAgo(runningExp.started_at),
      enrolled: enrolled ?? 0,
      // decision needs min_sample RESULTS per side; enrollment is the honest leading proxy
      targetEnrolled: runningExp.min_sample * 2,
    };
  }

  let adopted: LearningProps["adopted"] = null;
  if (adoptedExp && !(adoptedExp.decision_reason ?? "").includes("· reverted")) {
    // Stage-1 receipts under the adopted play: sends stamped with the CURRENT playbook
    // version + distinct leads among them that replied interested since the adoption.
    let receipts: { sent: number; interested: number } | null = null;
    if (playbook?.version) {
      const { data: stamped } = await supabase
        .from("scheduled_sends")
        .select("lead_id")
        .eq("status", "sent")
        .eq("recipe->>playbookVersion", String(playbook.version))
        .returns<{ lead_id: string }[]>();
      if ((stamped ?? []).length > 0) {
        const { data: interestedAll } = await supabase
          .from("replies")
          .select("lead_id, received_at")
          .eq("classification", "interested")
          .returns<{ lead_id: string; received_at: string }[]>();
        receipts = {
          sent: (stamped ?? []).length,
          interested: countInterestedSince(
            new Set((stamped ?? []).map((r) => r.lead_id)),
            interestedAll ?? [],
            adoptedExp.concluded_at
          ),
        };
      }
    }
    adopted = {
      label: describeStrategy(adoptedExp.challenger_strategy ?? {}),
      whenAgo: timeAgo(adoptedExp.concluded_at),
      receipts,
    };
  }

  // Targeting focus (Stage 2): the buyer segment being prioritized, from real outcomes.
  let focus: LearningProps["focus"] = null;
  {
    const [{ data: invitedLeads }, { data: interestedIdRows }] = await Promise.all([
      supabase
        .from("leads")
        .select("id, title, industry, linkedin_connected_at, meeting_booked_at")
        .not("linkedin_invited_at", "is", null)
        .returns<
          {
            id: string;
            title: string | null;
            industry: string | null;
            linkedin_connected_at: string | null;
            meeting_booked_at: string | null;
          }[]
        >(),
      supabase
        .from("replies")
        .select("lead_id")
        .eq("classification", "interested")
        .returns<{ lead_id: string }[]>(),
    ]);
    const interestedIds = new Set((interestedIdRows ?? []).map((r) => r.lead_id));
    const profile = buildTargetingProfile(
      (invitedLeads ?? []).map((l) => ({
        title: l.title,
        industry: l.industry,
        flags: {
          invited: true,
          accepted: l.linkedin_connected_at != null,
          interested: interestedIds.has(l.id),
          negative: false,
          booked: l.meeting_booked_at != null,
          converted: false,
        },
      }))
    );
    const top = topTiltSegment(profile);
    if (top) focus = { label: top.label, deep: top.stat.deep, n: top.stat.n };
  }

  const learning: LearningProps = {
    playbookVersion: playbook?.version ?? null,
    testing,
    adopted,
    focus,
  };

  // Vera's matched starter plays — fill the waiting states with proven competence instead
  // of silence (honest source labels; server-computed).
  const plays = playCards({ industry: account.onboarding_industry, icp: account.onboarding_icp });

  // L1 meeting layer: interested buyers need somewhere to book. A live Outreach agent with no
  // bookingUrl is the single most conversion-critical config gap (prod 2026-07-15: 0/3 set,
  // 10 interested replies, 0 meetings ever) — nag until it's set.
  const { data: copyAgentRow } = await supabase
    .from("agents")
    .select("config")
    .eq("kind", "copy")
    .eq("status", "live")
    .limit(1)
    .maybeSingle<{ config: { bookingUrl?: string | null } | null }>();
  const needsBookingUrl =
    copyAgentRow != null && !(copyAgentRow.config?.bookingUrl ?? "").trim();

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
      avgDealValueCents={account.avg_deal_value_cents}
      pendingDraftLeadIds={pendingDraftLeadIds}
      series={revenueSeries}
      pipeline={pipeline}
      cold={cold}
      today={today}
      revenuePace={revenuePace}
      conversionWin={conversionWin}
      replyWin={replyWin}
      prospects={prospects ?? []}
      recentReplies={replyRows}
      repliesWaiting={repliesWaiting}
      channels={{ liStatus }}
      week={{ sends: sendsWeek, li: liWeek, replies: repliesWeek }}
      attribution={signalAttribution}
      learning={learning}
      needsBookingUrl={needsBookingUrl}
      plays={plays}
    />
  );
}

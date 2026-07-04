import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { shapePipeline } from "./queries";
import { PipelineBoard, type ActivityItem } from "./pipeline-board";
import { type LivePipelineData } from "../dashboard/live-pipeline";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Relative-time formatted on the server → passed as static strings (no client
// Date.now(), no hydration mismatch). Mirrors the dashboard page convention.
function timeAgo(iso: string | null): string {
  if (!iso) return "no runs yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

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

type NotificationRow = {
  id: string;
  kind: "reply" | "converted" | "exhausted";
  lead_id: string;
  created_at: string;
};

type ScoutRow = { status: string; last_run_at: string | null; next_run_at: string | null };

// The Pipeline view of the Results surface — the live autonomous process. The full end-to-end
// funnel (LivePipeline: pulled → disqualified → drafting → review → sending → sent → active) lives
// here, the dedicated home for "full process transparency"; the Overview tab keeps only a compact
// pulse. Below it, the sequence-stage board + recent activity. RLS scopes every query (rule 02).
export async function PipelineSection() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const leadCount = (statuses?: string[]) => {
    let q = supabase.from("leads").select("id", { count: "exact", head: true });
    if (statuses) q = q.in("status", statuses);
    return q;
  };
  const sendCount = (statuses: string[]) =>
    supabase.from("scheduled_sends").select("id", { count: "exact", head: true }).in("status", statuses);

  const [
    { data: runs },
    { data: notes },
    { data: scout },
    totalRes,
    rejectedRes,
    inCampaignRes,
    repliedRes,
    convertedRes,
    draftingRes,
    inReviewRes,
    sendingRes,
    sentRes,
    outreachCampaign,
  ] = await Promise.all([
    supabase.from("sequence_runs").select("current_stage, status"),
    supabase
      .from("lead_notifications")
      .select("id, kind, lead_id, created_at")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<NotificationRow[]>(),
    supabase
      .from("agents")
      .select("status, last_run_at, next_run_at")
      .eq("kind", "scout")
      .limit(1)
      .maybeSingle<ScoutRow>(),
    leadCount(),
    leadCount(["rejected"]),
    leadCount(["in_campaign"]),
    leadCount(["replied"]),
    leadCount(["converted"]),
    sendCount(["drafting"]),
    sendCount(["pending_review"]),
    sendCount(["approved", "scheduled", "sending"]),
    sendCount(["sent"]),
    supabase
      .from("campaigns")
      .select("send_mode")
      .eq("copywriting_mode", "agent")
      .limit(1)
      .maybeSingle<{ send_mode: string }>(),
  ]);

  const converted = convertedRes.count ?? 0;
  const repliedOnly = repliedRes.count ?? 0;
  const inOutreach = inCampaignRes.count ?? 0;

  const vm = shapePipeline({
    runs: runs ?? [],
    convertedClients: converted,
    avgDealValueCents: account.avg_deal_value_cents,
    revenueGoalCents: account.revenue_goal_cents,
  });

  const livePipeline: LivePipelineData = {
    scoutDeployed: Boolean(scout),
    scoutLive: scout?.status === "live",
    scoutNextRunLabel: timeUntil(scout?.next_run_at ?? null),
    scoutLastRunLabel: timeAgo(scout?.last_run_at ?? null),
    pulled: totalRes.count ?? 0,
    disqualified: rejectedRes.count ?? 0,
    drafting: draftingRes.count ?? 0,
    inReview: inReviewRes.count ?? 0,
    sending: sendingRes.count ?? 0,
    sent: sentRes.count ?? 0,
    active: inOutreach + repliedOnly + converted,
    replied: repliedOnly,
    won: converted,
    wonValueLabel:
      account.avg_deal_value_cents && converted > 0
        ? usd.format((converted * account.avg_deal_value_cents) / 100)
        : null,
    sendMode: (outreachCampaign.data?.send_mode === "automatic" ? "automatic" : "review") as
      | "review"
      | "automatic",
  };

  // Resolve lead names for the activity feed (composite FK isn't embeddable, so
  // a second scoped query joins in-process).
  const leadIds = [...new Set((notes ?? []).map((n) => n.lead_id))];
  const { data: leadRows } = leadIds.length
    ? await supabase
        .from("leads")
        .select("id, first_name, company_name")
        .in("id", leadIds)
        .returns<{ id: string; first_name: string | null; company_name: string | null }[]>()
    : { data: [] as { id: string; first_name: string | null; company_name: string | null }[] };
  const nameById = new Map(
    (leadRows ?? []).map((l) => [l.id, l.company_name || l.first_name || "A lead"])
  );

  const VERB: Record<NotificationRow["kind"], string> = {
    reply: "replied",
    converted: "booked a meeting",
    exhausted: "went cold",
  };
  const activity: ActivityItem[] = (notes ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    who: nameById.get(n.lead_id) ?? "A lead",
    verb: VERB[n.kind],
    at: timeAgo(n.created_at),
  }));

  const goalLabel = account.revenue_goal_cents ? usd.format(account.revenue_goal_cents / 100) : null;

  return (
    <PipelineBoard
      vm={vm}
      activity={activity}
      goalLabel={goalLabel}
      pipelineValueLabel={usd.format(vm.pipelineValueCents / 100)}
      livePipeline={livePipeline}
    />
  );
}

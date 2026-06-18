import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { shapePipeline } from "./queries";
import { PipelineBoard, type ActivityItem } from "./pipeline-board";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Relative-time formatted on the server → passed as static strings (no client
// Date.now(), no hydration mismatch). Mirrors the dashboard page convention.
function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type NotificationRow = {
  id: string;
  kind: "reply" | "converted" | "exhausted";
  lead_id: string;
  created_at: string;
};

// The Pipeline view of the Results surface — the live autonomous process, stage by stage, plus the
// recent activity feed. RLS scopes every query to this account (rule 02) — no account id is passed.
export async function PipelineSection() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();

  const [{ data: runs }, convertedRes, { data: notes }] = await Promise.all([
    supabase.from("sequence_runs").select("current_stage, status"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted"),
    supabase
      .from("lead_notifications")
      .select("id, kind, lead_id, created_at")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<NotificationRow[]>(),
  ]);

  const vm = shapePipeline({
    runs: runs ?? [],
    convertedClients: convertedRes.count ?? 0,
    avgDealValueCents: account.avg_deal_value_cents,
    revenueGoalCents: account.revenue_goal_cents,
  });

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
    />
  );
}

import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadsTable, type LeadRow } from "./leads-table";
import { HOT_MIN_SCORE } from "./lead-value";

const PAGE_SIZE = 25;

// Shared column set so the paginated table and the "Hot right now" spotlight return the same shape.
// lead_signals (0031) are the REAL "why now" — events + intent captured at enrichment.
const LEAD_SELECT =
  "id, first_name, last_name, title, company_name, industry, location, status, source, ai_score, ai_rationale, ai_insights, rules_gate_reasons, scored_at, email, email_status, phone, phone_status, linkedin_url, created_at, replies(channel, classification, classification_rationale, body, received_at), lead_signals(kind, label, detail, observed_at)";

// Tabs where the spotlight makes sense — never above the "Filtered out" list.
const HOT_STRIP_TABS = new Set(["all", "qualified", "in_campaign", "replied"]);

// `source` tabs filter by where the lead entered the funnel (In-market = the Intent Agent), so the
// differentiator gets its own first-class view; `statuses` tabs filter by pipeline stage.
const TABS: { key: string; label: string; statuses: string[] | null; source?: string }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "intent", label: "In-market", statuses: null, source: "intent" },
  { key: "qualified", label: "Qualified", statuses: ["qualified", "enriched"] },
  { key: "in_campaign", label: "In outreach", statuses: ["in_campaign"] },
  { key: "replied", label: "Replied", statuses: ["replied", "converted"] },
  { key: "rejected", label: "Filtered out", statuses: ["rejected"] },
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(LEAD_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (tab.source) query = query.eq("source", tab.source);

  // "Hot right now" spotlight — account-wide top-fit leads ready to work, independent of the
  // current tab/page. RLS scopes it to this account (rule 02); no account id is passed.
  const hotQuery = supabase
    .from("leads")
    .select(LEAD_SELECT)
    .gte("ai_score", HOT_MIN_SCORE)
    .in("status", ["qualified", "enriched", "in_campaign"])
    .order("ai_score", { ascending: false })
    .order("scored_at", { ascending: false, nullsFirst: false })
    .limit(3);

  // Account carries the revenue numbers that turn each lead into "≈ $X to your goal".
  const [{ data: leads, count }, { data: hotLeads }, { account }] = await Promise.all([
    query,
    hotQuery,
    getGateData(),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Every prospect your agents sourced, with the reasoning behind each score.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/leads" : `/leads?tab=${t.key}`}
            className={`rounded-full border px-3 py-1 ${
              tab.key === t.key ? "border-primary bg-primary/10 font-medium" : "border-border"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!leads || leads.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {tab.key === "all"
                ? "No leads yet"
                : tab.key === "intent"
                  ? "No in-market leads yet"
                  : "Nothing here yet"}
            </CardTitle>
            <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
              {tab.key === "all"
                ? "Your Prospect Agent fills this page on its schedule — sourcing, scoring, and keeping only high-quality leads."
                : tab.key === "intent"
                  ? "Your Intent Agent surfaces people here the moment they show buying behavior on LinkedIn — engaging your competitors, posting about your space — qualified against your ICP."
                  : "Leads move here as your agents work the pipeline."}
            </p>
            {(tab.key === "all" || tab.key === "intent") && (
              <Button asChild variant="outline" size="sm" className="mx-auto mt-2">
                <Link href="/agents">{tab.key === "intent" ? "Set up your Intent Agent" : "Check your agents"}</Link>
              </Button>
            )}
          </CardHeader>
        </Card>
      ) : (
        <>
          <LeadsTable
            leads={leads as unknown as LeadRow[]}
            hotLeads={
              (HOT_STRIP_TABS.has(tab.key) ? (hotLeads ?? []) : []) as unknown as LeadRow[]
            }
            avgDealValueCents={account?.avg_deal_value_cents ?? null}
            goalCents={account?.revenue_goal_cents ?? null}
          />
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {count} leads
              </span>
              <span className="flex gap-2">
                {page > 1 && (
                  <Link
                    className="underline underline-offset-2"
                    href={`/leads?tab=${tab.key}&page=${page - 1}`}
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    className="underline underline-offset-2"
                    href={`/leads?tab=${tab.key}&page=${page + 1}`}
                  >
                    Next
                  </Link>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

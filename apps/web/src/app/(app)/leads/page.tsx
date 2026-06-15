import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadsTable, type LeadRow } from "./leads-table";

const PAGE_SIZE = 25;

const TABS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "all", label: "All", statuses: null },
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
    .select(
      "id, first_name, last_name, title, company_name, industry, location, status, ai_score, ai_rationale, ai_insights, rules_gate_reasons, email, email_status, phone, phone_status, linkedin_url, created_at, replies(channel, classification, classification_rationale, body, received_at)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (tab.statuses) query = query.in("status", tab.statuses);
  const { data: leads, count } = await query;

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
              {tab.key === "all" ? "No leads yet" : "Nothing here yet"}
            </CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              {tab.key === "all"
                ? "Your Prospect Agent fills this page on its schedule — sourcing, scoring, and keeping only high-quality leads."
                : "Leads move here as your agents work the pipeline."}
            </p>
            {tab.key === "all" && (
              <Button asChild variant="outline" size="sm" className="mx-auto mt-2">
                <Link href="/agents">Check your agents</Link>
              </Button>
            )}
          </CardHeader>
        </Card>
      ) : (
        <>
          <LeadsTable leads={leads as unknown as LeadRow[]} />
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

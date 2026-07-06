import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadsTable, type LeadRow, type LeadsSort } from "./leads-table";
import { HOT_MIN_SCORE } from "./lead-value";
import { cn } from "@/lib/utils";

// Sized so a full page fits ON SCREEN inside the one-screen shell (no inner scrollbar on a
// typical desktop) — more leads = more pages, never a scrolling table.
const PAGE_SIZE = 10;

// Shared column set so the paginated table and the "Hot right now" spotlight return the same shape.
// lead_signals (0031) are the REAL "why now" — events + intent captured at enrichment.
// company_size + tech_stack ride along for the side-peek profiler (no second fetch on click).
const LEAD_SELECT =
  "id, first_name, last_name, title, company_name, company_size, industry, location, tech_stack, status, source, ai_score, ai_rationale, ai_insights, rules_gate_reasons, scored_at, email, email_status, phone, phone_status, linkedin_url, created_at, replies(channel, classification, classification_rationale, body, received_at), lead_signals(kind, label, detail, observed_at)";

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

/** PostgREST `or()` treats , % ( ) as syntax — strip them so a search term can't break the filter. */
function sanitizeSearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[,%()]/g, "").trim().slice(0, 80);
}

/** One place to build /leads URLs so every link (tabs, sort, pages) preserves the others' state. */
function leadsHref(opts: { tab: string; q: string; sort: LeadsSort; page?: number }): string {
  const params = new URLSearchParams();
  if (opts.tab !== "all") params.set("tab", opts.tab);
  if (opts.q) params.set("q", opts.q);
  if (opts.sort !== "newest") params.set("sort", opts.sort);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const query = params.toString();
  return query ? `/leads?${query}` : "/leads";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const page = Math.max(1, Number(params.page) || 1);
  const q = sanitizeSearch(params.q);
  const sort: LeadsSort = params.sort === "score" ? "score" : "newest";
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase.from("leads").select(LEAD_SELECT, { count: "exact" });
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (tab.source) query = query.eq("source", tab.source);
  if (q)
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,title.ilike.%${q}%`
    );
  query =
    sort === "score"
      ? query
          .order("ai_score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  query = query.range(from, from + PAGE_SIZE - 1);

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
    // Data surface: fluid width (rule 07 width doctrine) — the table gets the screen,
    // with a guard so ultrawide monitors don't stretch rows past scannability.
    // One-screen on desktop (same contract as the lead brief): the PAGE never scrolls —
    // header/tabs/toolbar/pagination stay pinned, the table body scrolls internally.
    <div className="mx-auto flex w-full max-w-[1680px] flex-col lg:h-[calc(100dvh-3rem)]">
      <div className="mb-6 shrink-0 border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every prospect your agents sourced, with the reasoning behind each score.
        </p>
      </div>

      {/* Segmented control (matches the Results tabs) — one bordered track, active is a raised
          white segment. Replaces the old full-pill tabs. */}
      <div className="mb-5 shrink-0" data-copilot="leads-tabs">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-1 text-sm">
          {TABS.map((t) => {
            const isActive = tab.key === t.key;
            return (
              <Link
                key={t.key}
                href={leadsHref({ tab: t.key, q, sort })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-lg px-3 py-1.5 font-medium transition-colors",
                  isActive
                    ? "bg-white text-foreground shadow-[var(--shadow-sm)] ring-1 ring-[var(--hairline)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!leads || leads.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {q
                ? `No matches for “${q}”`
                : tab.key === "all"
                  ? "No leads yet"
                  : tab.key === "intent"
                    ? "No in-market leads yet"
                    : "Nothing here yet"}
            </CardTitle>
            <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
              {q
                ? "Try a shorter name or company — or clear the search to see everything in this view."
                : tab.key === "all"
                  ? "Your Prospect Agent fills this page on its schedule — sourcing, scoring, and keeping only high-quality leads."
                  : tab.key === "intent"
                    ? "Your Intent Agent surfaces people here the moment they show buying behavior on LinkedIn — engaging your competitors, posting about your space — qualified against your ICP."
                    : "Leads move here as your agents work the pipeline."}
            </p>
            {q ? (
              <Button asChild variant="outline" size="sm" className="mx-auto mt-2">
                <Link href={leadsHref({ tab: tab.key, q: "", sort })}>Clear search</Link>
              </Button>
            ) : (
              (tab.key === "all" || tab.key === "intent") && (
                <Button asChild variant="outline" size="sm" className="mx-auto mt-2">
                  <Link href="/agents">
                    {tab.key === "intent" ? "Set up your Intent Agent" : "Check your agents"}
                  </Link>
                </Button>
              )
            )}
          </CardHeader>
        </Card>
      ) : (
        <>
          <LeadsTable
            leads={leads as unknown as LeadRow[]}
            hotLeads={
              (HOT_STRIP_TABS.has(tab.key) && !q ? (hotLeads ?? []) : []) as unknown as LeadRow[]
            }
            avgDealValueCents={account?.avg_deal_value_cents ?? null}
            goalCents={account?.revenue_goal_cents ?? null}
            tab={tab.key}
            q={q}
            sort={sort}
          />
          {totalPages > 1 && (
            <div className="mt-4 flex shrink-0 items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {count} leads
              </span>
              <span className="flex gap-2">
                {page > 1 && (
                  <Link
                    className="underline underline-offset-2"
                    href={leadsHref({ tab: tab.key, q, sort, page: page - 1 })}
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    className="underline underline-offset-2"
                    href={leadsHref({ tab: tab.key, q, sort, page: page + 1 })}
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

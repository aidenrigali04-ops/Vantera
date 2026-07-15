import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orThrow } from "@/lib/supabase/guard";
import { getGateData } from "@/lib/auth/context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadsTable, leadsHref, type LeadRow, type LeadsFilters, type LeadsSort } from "./leads-table";
import { HOT_MIN_SCORE } from "./lead-value";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

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

// R4: page size is a URL param (10/25/50). 25 default — the old fixed 10 meant 50+ pages
// at prod's real volume. Module scope for the date filter (react purity lint bars Date.now
// in render).
const PER_OPTIONS = [10, 25, 50] as const;
const SCORE_FLOORS = [50, 70, 85] as const;
const DAY_WINDOWS = [7, 30, 90] as const;
function sourcedSinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    q?: string;
    sort?: string;
    per?: string;
    industry?: string;
    min?: string;
    days?: string;
    intent?: string;
  }>;
}) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const page = Math.max(1, Number(params.page) || 1);
  const q = sanitizeSearch(params.q);
  const SORTS: LeadsSort[] = ["newest", "score", "company", "activity"];
  const sort: LeadsSort = SORTS.includes(params.sort as LeadsSort)
    ? (params.sort as LeadsSort)
    : "newest";
  const per = PER_OPTIONS.includes(Number(params.per) as (typeof PER_OPTIONS)[number])
    ? Number(params.per)
    : 25;
  const filters: LeadsFilters = {
    industry: (params.industry ?? "").slice(0, 80),
    min: SCORE_FLOORS.includes(Number(params.min) as (typeof SCORE_FLOORS)[number])
      ? Number(params.min)
      : null,
    days: DAY_WINDOWS.includes(Number(params.days) as (typeof DAY_WINDOWS)[number])
      ? Number(params.days)
      : null,
    intent: params.intent === "1",
  };
  const from = (page - 1) * per;

  const supabase = await createClient();
  let query = supabase.from("leads").select(LEAD_SELECT, { count: "exact" });
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (tab.source) query = query.eq("source", tab.source);
  // R4 filters — compose with tabs and search; each is URL state, shareable and back-safe.
  if (filters.industry) query = query.eq("industry", filters.industry);
  if (filters.min) query = query.gte("ai_score", filters.min);
  if (filters.days) query = query.gte("created_at", sourcedSinceIso(filters.days));
  if (filters.intent && !tab.source) query = query.eq("source", "intent");
  if (q)
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,title.ilike.%${q}%`
    );
  query =
    sort === "score"
      ? query
          .order("ai_score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
      : sort === "company"
        ? query
            .order("company_name", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false })
        : sort === "activity"
          ? query
              .order("scored_at", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
          : query.order("created_at", { ascending: false });
  query = query.range(from, from + per - 1);

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

  // R4 filter options: the account's real industries (deduped) for the filter popover.
  const industriesQuery = supabase
    .from("leads")
    .select("industry")
    .not("industry", "is", null)
    .limit(1000);

  // Account carries the revenue numbers that turn each lead into "≈ $X to your goal".
  const [leadsRes, hotRes, industriesRes, { account }] = await Promise.all([
    query,
    hotQuery,
    industriesQuery,
    getGateData(),
  ]);
  // R1c: a failed read hits the error boundary — never renders as "0 leads".
  const leadsRaw = orThrow(leadsRes, "your leads");
  const count = leadsRes.count;
  const hotLeads = orThrow(hotRes, "hot leads");
  const industries = [
    ...new Set(((industriesRes.data ?? []) as { industry: string | null }[]).map((r) => r.industry).filter(Boolean) as string[]),
  ].sort();

  // R4: on the default view, filtered-out rows sink below live ones within the page — the
  // first screen must never read as a wall of rejects (stable partition, order kept).
  const leads =
    tab.key === "all" && sort === "newest" && leadsRaw
      ? [...leadsRaw.filter((l: { status: string }) => l.status !== "rejected"), ...leadsRaw.filter((l: { status: string }) => l.status === "rejected")]
      : leadsRaw;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / per));

  return (
    // Data surface: fluid width (rule 07 width doctrine) — the table gets the screen,
    // with a guard so ultrawide monitors don't stretch rows past scannability.
    // One-screen on desktop (same contract as the lead brief): the PAGE never scrolls —
    // header/tabs/toolbar/pagination stay pinned, the table body scrolls internally.
    <div className="mx-auto flex w-full max-w-[1680px] flex-col lg:h-[calc(100dvh-3rem)]">
      <div className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every prospect your agents sourced, with the reasoning behind each score.
          </p>
        </div>
        {/* P1: CSV export — the user's own data, one click. */}
        <a
          href="/api/export/leads"
          className="inline-flex items-center rounded-lg border border-[var(--hairline)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--tint)]"
        >
          Export CSV
        </a>
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
                href={leadsHref({ tab: t.key, q, sort, per, filters })}
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
            per={per}
            filters={filters}
            industries={industries}
          />
          {(totalPages > 1 || per !== 25) && (
            <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-3">
                <span>
                  Page {page} of {totalPages} · {count} leads
                </span>
                {/* R4: page size — URL state like everything else. */}
                <span className="flex items-center gap-1">
                  {PER_OPTIONS.map((n) => (
                    <Link
                      key={n}
                      href={leadsHref({ tab: tab.key, q, sort, per: n, filters })}
                      aria-current={per === n ? "true" : undefined}
                      className={cn(
                        "rounded-md px-1.5 py-0.5",
                        per === n ? "bg-foreground/10 font-medium text-foreground" : "hover:text-foreground"
                      )}
                    >
                      {n}
                    </Link>
                  ))}
                  <span className="ml-0.5">/ page</span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                {/* R4: jump-to-page — 49 Next-clicks was the audit's poster child. */}
                {totalPages > 3 && (
                  <form action="/leads" method="get" className="flex items-center gap-1.5">
                    {tab.key !== "all" && <input type="hidden" name="tab" value={tab.key} />}
                    {q && <input type="hidden" name="q" value={q} />}
                    {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
                    {per !== 25 && <input type="hidden" name="per" value={per} />}
                    {filters.industry && <input type="hidden" name="industry" value={filters.industry} />}
                    {filters.min && <input type="hidden" name="min" value={filters.min} />}
                    {filters.days && <input type="hidden" name="days" value={filters.days} />}
                    {filters.intent && <input type="hidden" name="intent" value="1" />}
                    <label htmlFor="page-jump">Go to</label>
                    <input
                      id="page-jump"
                      type="number"
                      name="page"
                      min={1}
                      max={totalPages}
                      defaultValue={page}
                      className="h-7 w-14 rounded-md border border-[var(--hairline)] bg-white px-1.5 text-center text-sm focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
                    />
                  </form>
                )}
                <span className="flex gap-2">
                  {page > 1 && (
                    <Link
                      className="underline underline-offset-2"
                      href={leadsHref({ tab: tab.key, q, sort, page: page - 1, per, filters })}
                    >
                      Previous
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      className="underline underline-offset-2"
                      href={leadsHref({ tab: tab.key, q, sort, page: page + 1, per, filters })}
                    >
                      Next
                    </Link>
                  )}
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

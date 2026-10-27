import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orThrow } from "@/lib/supabase/guard";
import { getGateData } from "@/lib/auth/context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadsTable, type LeadRow } from "./leads-table";
import {
  LEADS_TABS,
  leadsHref,
  tabPredicate,
  type LeadsFilters,
  type LeadsSort,
  type LeadsTab,
  type TabCounts,
} from "./leads-params";
import { signalGroups, whyNowCell, type IntentPostIn } from "@/lib/prospects/why-now-cell";
import { AddLead } from "./add-lead";
import { HOT_MIN_SCORE } from "./lead-value";
import { cn } from "@/lib/utils";
import { parseReadout, reasonsForLead, whatsWorking } from "@/lib/learning/readout";
import { fitVerdictFromRows } from "@/lib/learning/fit";
import { isRegenerable } from "@/lib/copy/regenerable";
import { WhatsWorkingStrip } from "./whats-working";
import { PageHeader, SEGMENT_TRACK, segmentClass } from "@/components/app/surface";

export const metadata = { title: "Prospects" };

// Shared column set so the paginated table and the "Hot right now" spotlight return the same shape.
// lead_signals (0031) are the REAL "why now" — events + intent captured at enrichment.
// company_size + tech_stack ride along for the side-peek profiler (no second fetch on click).
const LEAD_SELECT =
  "id, first_name, last_name, title, company_name, company_size, industry, location, tech_stack, status, source, ai_score, ai_rationale, ai_insights, rules_gate_reasons, scored_at, email, email_status, phone, phone_status, linkedin_url, created_at, replies(channel, classification, classification_rationale, body, received_at), lead_signals(kind, label, detail, level, observed_at)";

// The signal-filter variant adds an inner embed so only leads with that signal kind come back.
const LEAD_SELECT_SIGNAL = `${LEAD_SELECT}, sig:lead_signals!inner(kind)`;

// Tabs where the spotlight makes sense — never above the "Filtered out" list.
const HOT_STRIP_TABS = new Set(["all", "qualified", "in_campaign", "replied"]);

// Tab predicates live in leads-params (tabPredicate); this is only the label table.
const TAB_LABELS: Record<LeadsTab, string> = {
  all: "All",
  intent: "In-market",
  qualified: "Qualified",
  scheduled: "Scheduled",
  in_campaign: "In outreach",
  replied: "Replied",
  rejected: "Filtered out",
};
const TABS = LEADS_TABS.map((key) => ({ key, label: TAB_LABELS[key], ...tabPredicate(key) }));

/** PostgREST `or()` treats , % ( ) as syntax — strip them so a search term can't break the filter. */
function sanitizeSearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[,%()]/g, "").trim().slice(0, 80);
}

// R4: page size is a URL param (10/25/50). 25 default — the old fixed 10 meant 50+ pages
// at prod's real volume. sourcedSinceIso reads the clock when the (server) page calls it per
// request — a helper rather than an inline Date.now so the react purity lint stays quiet.
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
    signal?: string;
  }>;
}) {
  const params = await searchParams;
  const now = new Date(); // per request (server code) so "3d ago" never drifts on a warm instance
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
    signal: (params.signal ?? "").replace(/[^a-z0-9_:-]/gi, "").slice(0, 60),
  };
  const from = (page - 1) * per;
  const filtering = Boolean(filters.industry || filters.min || filters.days || filters.intent || filters.signal);

  const supabase = await createClient();
  // One filter/search recipe shared by the main query and every tab count, so a tab's count is
  // exactly what clicking it shows. `tabKey` swaps the tab predicate; filters/search are constant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = <T extends { in: any; eq: any; gte: any; or: any }>(qb: T, tabKey: LeadsTab): T => {
    const p = tabPredicate(tabKey);
    let out = qb;
    if (p.statuses) out = out.in("status", p.statuses);
    if (p.source) out = out.eq("source", p.source);
    if (p.scheduled) out = out.eq("sequence_runs.status", "active");
    // R4 filters — compose with tabs and search; each is URL state, shareable and back-safe.
    if (filters.industry) out = out.eq("industry", filters.industry);
    if (filters.min) out = out.gte("ai_score", filters.min);
    if (filters.days) out = out.gte("created_at", sourcedSinceIso(filters.days));
    if (filters.intent && !p.source) out = out.eq("source", "intent");
    if (filters.signal) out = out.eq("sig.kind", filters.signal);
    if (q)
      out = out.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,title.ilike.%${q}%`
      );
    return out;
  };
  const tabKey = tab.key as LeadsTab;
  const selectFor = (key: LeadsTab, base: string) =>
    key === "scheduled" ? `${base}, sequence_runs!inner(status)` : base;
  let query = applyFilters(
    supabase
      .from("leads")
      .select(selectFor(tabKey, filters.signal ? LEAD_SELECT_SIGNAL : LEAD_SELECT), { count: "exact" }),
    tabKey
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

  // ML-2: the latest scout run carries the learned readout (this account's own outcomes only).
  const learnedQuery = supabase
    .from("agent_runs")
    .select("summary")
    .eq("kind", "scout")
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1);

  // Tab counts: one head count per tab, same search + filters as the main query.
  const countQueries = LEADS_TABS.map((key) =>
    applyFilters(
      supabase
        .from("leads")
        .select(
          selectFor(key, filters.signal ? "id, sig:lead_signals!inner(kind)" : "id"),
          { count: "exact", head: true }
        ),
      key
    )
  );

  // Signal kinds present on this account's prospects → the filter's option list.
  const signalKindsQuery = supabase.from("lead_signals").select("kind").limit(2000);

  // Account carries the revenue numbers that turn each lead into "≈ $X to your goal".
  const [leadsRes, hotRes, industriesRes, learnedRes, signalKindsRes, { account }, ...countRes] =
    await Promise.all([
      query,
      hotQuery,
      industriesQuery,
      learnedQuery,
      signalKindsQuery,
      getGateData(),
      ...countQueries,
    ]);
  // Counts are decoration: a failed one shows 0 rather than taking the page down.
  const tabCounts = Object.fromEntries(
    LEADS_TABS.map((key, i) => [key, countRes[i]?.error ? 0 : (countRes[i]?.count ?? 0)])
  ) as TabCounts;
  const signalGroupList = signalGroups(
    signalKindsRes.error ? [] : ((signalKindsRes.data ?? []) as { kind: string }[])
  );
  // Insight only — a failed read just hides the reasons, never the prospects.
  const readout = parseReadout((learnedRes.data?.[0] as { summary?: unknown } | undefined)?.summary ?? null);
  const working = whatsWorking(readout);
  // R1c: a failed read hits the error boundary — never renders as "0 leads".
  const pageRows = (orThrow(leadsRes, "your prospects") ?? []) as unknown as { id: string; status: string }[];
  const hotRows = (orThrow(hotRes, "hot prospects") ?? []) as { id: string; status: string }[];
  // ML-4 + UX-2 reasons: batched by the visible ids, each a soft read — a missing table or a
  // failed read hides that decoration, never the prospects.
  const ids = [...new Set([...pageRows, ...hotRows].map((r) => r.id))];
  const [feedbackRes, postsRes, draftsRes] = await Promise.all([
    supabase.from("lead_feedback").select("lead_id, verdict, reason").in("lead_id", ids),
    supabase
      .from("intent_observations")
      .select("lead_id, post_ref, headline, detail, observed_at")
      .in("lead_id", ids)
      .order("observed_at", { ascending: false }),
    supabase
      .from("scheduled_sends")
      .select("id, lead_id, body, status, linkedin_stage, origin, style_flags, recipe")
      .in("lead_id", ids)
      .in("status", ["pending_review", "approved", "scheduled"])
      .order("created_at", { ascending: false }),
  ]);
  const feedbackRows = feedbackRes.error
    ? null
    : (feedbackRes.data as { lead_id: string; verdict: string; reason: string | null }[] | null);
  const verdicts = fitVerdictFromRows(feedbackRows);
  const fitReasons = new Map<string, string>();
  for (const r of feedbackRows ?? []) if (r.reason && !fitReasons.has(r.lead_id)) fitReasons.set(r.lead_id, r.reason);
  const postsByLead = new Map<string, IntentPostIn[]>();
  for (const p of postsRes.error ? [] : ((postsRes.data ?? []) as (IntentPostIn & { lead_id: string | null })[])) {
    if (!p.lead_id) continue;
    const list = postsByLead.get(p.lead_id) ?? [];
    list.push({ post_ref: p.post_ref, headline: p.headline, detail: p.detail, observed_at: p.observed_at });
    postsByLead.set(p.lead_id, list);
  }
  type Draft = NonNullable<LeadRow["queued_draft"]>;
  const draftByLead = new Map<string, Draft>();
  type DraftRaw = Omit<Draft, "regenerable"> & { lead_id: string; recipe: unknown };
  for (const d of draftsRes.error ? [] : ((draftsRes.data ?? []) as DraftRaw[])) {
    // newest first → keep the first seen per lead
    if (!draftByLead.has(d.lead_id)) {
      const { lead_id: _leadId, recipe, ...draft } = d;
      void _leadId;
      draftByLead.set(d.lead_id, { ...draft, regenerable: isRegenerable(recipe) });
    }
  }
  const withReasons = <T extends { id: string }>(rows: T[]) =>
    rows.map((r) => {
      const row = r as T & {
        lead_signals?: { kind: string; label: string | null; detail?: string | null; level?: string | null; observed_at?: string | null }[] | null;
        ai_insights?: { triggers?: string[]; pain_points?: string[] } | null;
      };
      const posts = postsByLead.get(r.id) ?? [];
      return {
        ...r,
        learned_reasons: reasonsForLead(readout, r as never),
        fit_verdict: verdicts.get(r.id) ?? null,
        fit_reason: fitReasons.get(r.id) ?? null,
        intent_posts: posts,
        queued_draft: draftByLead.get(r.id) ?? null,
        why_now: whyNowCell(row.lead_signals ?? [], posts, row.ai_insights ?? null, now),
      };
    });
  const leadsRaw = withReasons(pageRows);
  const count = leadsRes.count;
  const hotLeads = withReasons(hotRows);
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
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col lg:min-h-0 lg:flex-1">
      <PageHeader
        className="mb-5"
        title="Prospects"
        subtitle="Every prospect your agents sourced, with the reasoning behind each score."
      >
          {/* P1: CSV export — the user's own data, one click. */}
          <a
            href="/api/export/leads"
            className="inline-flex h-9 items-center rounded-[var(--r-btn)] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm font-medium shadow-[var(--shadow-tile)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Export CSV
          </a>
          {/* R6: bring your own prospect — same qualification bar as discovery. */}
          <AddLead />
      </PageHeader>

      {/* Segmented control (matches the Results tabs) — one bordered track, active is a raised
          white segment. Replaces the old full-pill tabs. */}
      <div className="mb-5 shrink-0" data-copilot="leads-tabs">
        <div className={cn(SEGMENT_TRACK, "flex-wrap")}>
          {TABS.map((t) => {
            const isActive = tab.key === t.key;
            return (
              <Link
                key={t.key}
                href={leadsHref({ tab: t.key, q, sort, per, filters })}
                aria-current={isActive ? "page" : undefined}
                className={segmentClass(isActive)}
              >
                {t.label}
                <span className="ml-1 font-mono text-xs tabular-nums opacity-60">· {tabCounts[t.key]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {working && <WhatsWorkingStrip working={working} />}

      {!leads || leads.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {q
                ? `No matches for “${q}”`
                : filtering
                  ? "No prospects match these filters"
                  : tab.key === "all"
                  ? "No prospects yet"
                  : tab.key === "intent"
                    ? "No in-market prospects yet"
                    : "Nothing here yet"}
            </CardTitle>
            <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
              {q
                ? "Try a shorter name or company — or clear the search to see everything in this view."
                : filtering
                  ? "Loosen or clear the filters to see everything in this view."
                  : tab.key === "all"
                  ? "Your Prospect Agent fills this page on its schedule — sourcing, scoring, and keeping only high-quality prospects."
                  : tab.key === "intent"
                    ? "Your Intent Agent surfaces people here the moment they show buying behavior on LinkedIn — engaging your competitors, posting about your space — qualified against your ICP."
                    : "Prospects move here as your agents work the pipeline."}
            </p>
            {q || filtering ? (
              <div className="mx-auto mt-2 flex flex-wrap justify-center gap-2">
                {q && (
                  <Button asChild variant="outline" size="sm">
                    {/* clearing one control keeps the others (and the page size) */}
                    <Link href={leadsHref({ tab: tab.key, q: "", sort, per, filters })}>Clear search</Link>
                  </Button>
                )}
                {filtering && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={leadsHref({ tab: tab.key, q, sort, per })}>Clear filters</Link>
                  </Button>
                )}
              </div>
            ) : (
              (tab.key === "all" || tab.key === "intent") && (
                <Button asChild variant="outline" size="sm" className="mx-auto mt-2">
                  <Link href="/playbook">
                    {tab.key === "intent" ? "Set up your Intent Agent" : "Check your playbook"}
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
            tabCounts={tabCounts}
            signalGroups={signalGroupList}
          />
          {(totalPages > 1 || per !== 25) && (
            <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-3">
                <span>
                  Page {page} of {totalPages} · {count} prospects
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
                  <form action="/prospects" method="get" className="flex items-center gap-1.5">
                    {tab.key !== "all" && <input type="hidden" name="tab" value={tab.key} />}
                    {q && <input type="hidden" name="q" value={q} />}
                    {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
                    {per !== 25 && <input type="hidden" name="per" value={per} />}
                    {filters.industry && <input type="hidden" name="industry" value={filters.industry} />}
                    {filters.min && <input type="hidden" name="min" value={filters.min} />}
                    {filters.days && <input type="hidden" name="days" value={filters.days} />}
                    {filters.intent && <input type="hidden" name="intent" value="1" />}
                    {filters.signal && <input type="hidden" name="signal" value={filters.signal} />}
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

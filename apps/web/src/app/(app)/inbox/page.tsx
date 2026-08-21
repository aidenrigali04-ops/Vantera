import Link from "next/link";
import { ArrowLeft, MessagesSquare, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadInbox, loadThread } from "@/lib/conversations";
import { ConversationPanel } from "@/components/conversation-panel";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inbox" };

/**
 * The unified inbox (L2, spec 2026-07-15): every conversation in one place — the full
 * two-way thread, unanswered-interested pinned, composer pre-drafted. The surface the
 * "100% reply visibility" promise always needed.
 */
const FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "not_interested", label: "Not interested" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function inboxHref(opts: { filter?: FilterKey; q?: string; show?: number; lead?: string }): string {
  const sp = new URLSearchParams();
  if (opts.filter && opts.filter !== "all") sp.set("filter", opts.filter);
  if (opts.q) sp.set("q", opts.q);
  if (opts.show && opts.show !== 30) sp.set("show", String(opts.show));
  if (opts.lead) sp.set("lead", opts.lead);
  const s = sp.toString();
  return s ? `/inbox?${s}` : "/inbox";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; q?: string; filter?: string; show?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80).toLowerCase();
  const filter: FilterKey = FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as FilterKey)
    : "all";
  // R4: "Show older" raises both the visible count and the fetch caps — no silent horizon.
  const show = Math.min(Math.max(Number(params.show) || 30, 30), 480);

  const supabase = await createClient();
  const allItems = await loadInbox(supabase, {
    sentLimit: Math.max(600, show * 15),
    replyLimit: Math.max(400, show * 10),
  });

  const filtered = allItems.filter((i) => {
    if (filter === "waiting" && !i.waiting) return false;
    if (filter === "not_interested" && i.lastClassification !== "not_interested") return false;
    if (q && !`${i.name} ${i.company ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const items = filtered.slice(0, show);
  const hasMore = filtered.length > show;

  // R4 mobile master/detail: with no explicit ?lead= the phone shows the LIST; a tapped
  // thread shows only the thread with a back affordance. Desktop keeps auto-selecting.
  const hasLeadParam = Boolean(params.lead);
  const selectedId = params.lead ?? items[0]?.leadId ?? null;
  const selected =
    items.find((i) => i.leadId === selectedId) ?? allItems.find((i) => i.leadId === selectedId) ?? null;
  const turns = selectedId ? await loadThread(supabase, selectedId) : [];

  // Pre-draft: a queued agent draft for this lead opens in the composer ("one click to send").
  let queuedDraft = "";
  if (selectedId) {
    const { data: q } = await supabase
      .from("scheduled_sends")
      .select("body")
      .eq("lead_id", selectedId)
      .in("status", ["pending_review", "approved", "scheduled"])
      .neq("origin", "manual")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ body: string | null }>();
    queuedDraft = q?.body ?? "";
  }

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5 lg:h-[calc(100dvh-3rem)]">
      <header className="shrink-0 border-b border-[var(--hairline)] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every conversation, both sides, in one place. Unanswered warm replies come first.
        </p>
      </header>

      {/* R4 toolbar: search + filter chips — all URL state. */}
      <div className={cn("flex shrink-0 flex-wrap items-center gap-2", hasLeadParam && "hidden lg:flex")}>
        <form action="/inbox" method="get" role="search" className="relative">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-9 w-56 rounded-lg border border-[var(--hairline)] bg-white pl-9 pr-3 text-sm shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/60 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none sm:w-72"
          />
        </form>
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-1 text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={inboxHref({ filter: f.key, q: params.q })}
              aria-current={filter === f.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-lg px-3 py-1 font-medium transition-colors",
                filter === f.key
                  ? "bg-white text-foreground shadow-[var(--shadow-sm)] ring-1 ring-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--hairline)] bg-white/60 py-16 text-center">
          <MessagesSquare className="size-7 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {q || filter !== "all"
              ? "No conversations match — clear the search or filter to see everything."
              : "Conversations land here as soon as your outreach starts talking to real people."}
          </p>
          {(q || filter !== "all") && (
            <Link href="/inbox" className="text-sm font-medium text-[var(--cyan-strong)] hover:underline">
              Clear
            </Link>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* Thread list — on phones it hides once a thread is explicitly open. */}
          <div
            className={cn(
              "min-h-0 overflow-y-auto rounded-xl border border-[var(--hairline)] bg-white/60",
              hasLeadParam && "hidden lg:block"
            )}
          >
            <ul>
              {items.map((i) => (
                <li key={i.leadId}>
                  <Link
                    href={inboxHref({ filter, q: params.q, show: show !== 30 ? show : undefined, lead: i.leadId })}
                    className={cn(
                      "flex flex-col gap-0.5 border-b border-[var(--hairline)] px-4 py-3 transition-colors hover:bg-[var(--cyan-tint)]/40",
                      i.leadId === selectedId && "bg-[var(--cyan-tint)]/60",
                      // R4: settled threads recede — waiting/unanswered stay full-strength.
                      !i.waiting && i.lastRole === "agent" && "opacity-60"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{i.name}</span>
                      {i.waiting && (
                        <span className="rounded-full bg-[var(--cyan-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          waiting
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">
                        {new Date(i.lastAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {i.lastRole === "agent" ? "You: " : ""}
                      {i.lastSnippet}
                    </span>
                  </Link>
                </li>
              ))}
              {hasMore && (
                <li>
                  <Link
                    href={inboxHref({ filter, q: params.q, show: show * 2 })}
                    className="block px-4 py-3 text-center text-sm font-medium text-[var(--cyan-strong)] hover:underline"
                  >
                    Show older conversations
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Thread + composer — on phones it renders only when a thread is explicitly open. */}
          <div
            className={cn(
              "flex min-h-0 flex-col rounded-xl border border-[var(--hairline)] bg-white/60",
              !hasLeadParam && "hidden lg:flex"
            )}
          >
            {selected ? (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--hairline)] px-5 py-3">
                  {/* R4 mobile back affordance — the list is hidden while a thread is open. */}
                  <Link
                    href={inboxHref({ filter, q: params.q, show: show !== 30 ? show : undefined })}
                    aria-label="Back to all conversations"
                    className="shrink-0 rounded-lg border border-[var(--hairline)] p-1.5 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                  >
                    <ArrowLeft className="size-4" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
                    {selected.company && (
                      <p className="truncate text-xs text-muted-foreground">{selected.company}</p>
                    )}
                  </div>
                  <Link
                    href={`/leads/${selected.leadId}`}
                    className="shrink-0 text-xs font-medium text-[var(--cyan-strong)] hover:underline"
                  >
                    Full profile
                  </Link>
                </div>
                <ConversationPanel
                  leadId={selected.leadId}
                  turns={turns}
                  initialDraft={queuedDraft}
                  threadClassName="min-h-0 flex-1 overflow-y-auto p-5"
                  composerClassName="shrink-0 border-t border-[var(--hairline)] p-4"
                />
              </>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Pick a conversation.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

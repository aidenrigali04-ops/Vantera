import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadInbox, loadThread } from "@/lib/conversations";
import { ConversationThread, Composer } from "@/components/conversation";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inbox — Vantera" };

/**
 * The unified inbox (L2, spec 2026-07-15): every conversation in one place — the full
 * two-way thread, unanswered-interested pinned, composer pre-drafted. The surface the
 * "100% reply visibility" promise always needed.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const supabase = await createClient();
  const items = await loadInbox(supabase);
  const selectedId = (await searchParams).lead ?? items[0]?.leadId ?? null;
  const selected = items.find((i) => i.leadId === selectedId) ?? null;
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

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--hairline)] bg-white/60 py-16 text-center">
          <MessagesSquare className="size-7 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Conversations land here as soon as your outreach starts talking to real people.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* Thread list */}
          <div className="min-h-0 overflow-y-auto rounded-xl border border-[var(--hairline)] bg-white/60">
            <ul>
              {items.map((i) => (
                <li key={i.leadId}>
                  <Link
                    href={`/inbox?lead=${i.leadId}`}
                    className={cn(
                      "flex flex-col gap-0.5 border-b border-[var(--hairline)] px-4 py-3 transition-colors hover:bg-[var(--cyan-tint)]/40",
                      i.leadId === selectedId && "bg-[var(--cyan-tint)]/60"
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
            </ul>
          </div>

          {/* Thread + composer */}
          <div className="flex min-h-0 flex-col rounded-xl border border-[var(--hairline)] bg-white/60">
            {selected ? (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5 py-3">
                  <div className="min-w-0">
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
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <ConversationThread turns={turns} />
                </div>
                <div className="shrink-0 border-t border-[var(--hairline)] p-4">
                  <Composer leadId={selected.leadId} initialDraft={queuedDraft} />
                </div>
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

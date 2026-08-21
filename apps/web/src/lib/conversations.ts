import type { SupabaseClient } from "@supabase/supabase-js";
import { describeStrategy, type CopyStrategy, type SendRecipe } from "@vantera/agent-brains";
import { orThrow } from "@/lib/supabase/guard";

/**
 * The conversation cockpit's data layer (L2, spec 2026-07-15). The full two-way thread has
 * always existed in the DB — sent messages in scheduled_sends, inbound in replies — the UI
 * just never stitched it. RLS scopes every query (rule 02); no accountId is passed.
 */

export type ThreadTurn = {
  role: "agent" | "lead";
  text: string;
  at: string;
  /** which play wrote an agent message (Stage-1 recipe stamp), when known */
  playLabel: string | null;
  /** inbound classification chip (interested / not interested / …), when known */
  classification: string | null;
  /** human-typed vs agent-written */
  manual: boolean;
  /** R1d optimistic echo: true while a just-sent message awaits server confirmation */
  pending?: boolean;
};

type SentRow = {
  lead_id: string;
  body: string | null;
  updated_at: string;
  origin: string | null;
  recipe: SendRecipe | null;
  linkedin_stage: string | null;
};
type ReplyRow = { lead_id: string; body: string | null; received_at: string; classification: string | null };

function playLabel(recipe: SendRecipe | null): string | null {
  const strategy = (recipe?.strategy ?? null) as CopyStrategy | null;
  if (!strategy || Object.keys(strategy).length === 0) return null;
  return describeStrategy(strategy);
}

/** Full two-way thread for one lead, oldest first. */
export async function loadThread(db: SupabaseClient, leadId: string): Promise<ThreadTurn[]> {
  const [{ data: sent }, { data: got }] = await Promise.all([
    db
      .from("scheduled_sends")
      .select("lead_id, body, updated_at, origin, recipe, linkedin_stage")
      .eq("lead_id", leadId)
      .eq("status", "sent")
      .returns<SentRow[]>(),
    db
      .from("replies")
      .select("lead_id, body, received_at, classification")
      .eq("lead_id", leadId)
      .returns<ReplyRow[]>(),
  ]);
  const turns: ThreadTurn[] = [
    ...(sent ?? [])
      .filter((s) => (s.body ?? "").trim())
      .map((s) => ({
        role: "agent" as const,
        text: s.body ?? "",
        at: s.updated_at,
        playLabel: s.origin === "manual" ? null : playLabel(s.recipe),
        classification: null,
        manual: s.origin === "manual",
      })),
    ...(got ?? [])
      .filter((r) => (r.body ?? "").trim())
      .map((r) => ({
        role: "lead" as const,
        text: r.body ?? "",
        at: r.received_at,
        playLabel: null,
        classification: r.classification,
        manual: false,
      })),
  ];
  return turns.sort((a, b) => a.at.localeCompare(b.at));
}

export type InboxItem = {
  leadId: string;
  name: string;
  company: string | null;
  lastAt: string;
  lastSnippet: string;
  lastRole: "agent" | "lead";
  /** interested reply with no delivered message after it (truthful "waiting on you") */
  waiting: boolean;
  status: string;
  /** the most recent inbound classification, for inbox filter chips (R4) */
  lastClassification: string | null;
};

/** Every conversation, newest activity first, unanswered-interested pinned.
 *  R4: fetch caps are parameterized — the inbox "Show older" control raises them, so old
 *  threads paginate in instead of silently vanishing behind a fixed cap. */
export async function loadInbox(
  db: SupabaseClient,
  opts: { sentLimit?: number; replyLimit?: number } = {}
): Promise<InboxItem[]> {
  const sentLimit = Math.min(opts.sentLimit ?? 600, 3000);
  const replyLimit = Math.min(opts.replyLimit ?? 400, 2000);
  // R1c: a failed read must hit the route's error boundary, never render an empty inbox.
  const [sentRes, gotRes] = await Promise.all([
    db
      .from("scheduled_sends")
      .select("lead_id, body, updated_at, origin, recipe, linkedin_stage")
      .eq("status", "sent")
      .order("updated_at", { ascending: false })
      .limit(sentLimit)
      .returns<SentRow[]>(),
    db
      .from("replies")
      .select("lead_id, body, received_at, classification")
      .order("received_at", { ascending: false })
      .limit(replyLimit)
      .returns<ReplyRow[]>(),
  ]);
  const sent = orThrow(sentRes, "your sent messages");
  const got = orThrow(gotRes, "replies");
  const byLead = new Map<
    string,
    {
      lastAt: string;
      lastSnippet: string;
      lastRole: "agent" | "lead";
      lastSentAt: string;
      lastInterestedAt: string;
      lastReplyAt: string;
      lastClassification: string | null;
    }
  >();
  const touch = (
    leadId: string,
    at: string,
    snippet: string,
    role: "agent" | "lead"
  ) => {
    const cur = byLead.get(leadId) ?? {
      lastAt: "",
      lastSnippet: "",
      lastRole: role,
      lastSentAt: "",
      lastInterestedAt: "",
      lastReplyAt: "",
      lastClassification: null as string | null,
    };
    if (at > cur.lastAt) {
      cur.lastAt = at;
      cur.lastSnippet = snippet;
      cur.lastRole = role;
    }
    byLead.set(leadId, cur);
    return cur;
  };
  for (const s of sent ?? []) {
    if (!(s.body ?? "").trim()) continue;
    const cur = touch(s.lead_id, s.updated_at, s.body ?? "", "agent");
    if (s.updated_at > cur.lastSentAt) cur.lastSentAt = s.updated_at;
  }
  for (const r of got ?? []) {
    if (!(r.body ?? "").trim()) continue;
    const cur = touch(r.lead_id, r.received_at, r.body ?? "", "lead");
    if (r.classification === "interested" && r.received_at > cur.lastInterestedAt) {
      cur.lastInterestedAt = r.received_at;
    }
    if (r.received_at > cur.lastReplyAt) {
      cur.lastReplyAt = r.received_at;
      cur.lastClassification = r.classification;
    }
  }
  const ids = [...byLead.keys()];
  if (ids.length === 0) return [];
  const { data: leads } = await db
    .from("leads")
    .select("id, first_name, last_name, company_name, status")
    .in("id", ids)
    .returns<{ id: string; first_name: string | null; last_name: string | null; company_name: string | null; status: string }[]>();
  const items: InboxItem[] = (leads ?? []).map((l) => {
    const c = byLead.get(l.id)!;
    return {
      leadId: l.id,
      name: [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "A prospect",
      company: l.company_name,
      lastAt: c.lastAt,
      lastSnippet: c.lastSnippet.slice(0, 110),
      lastRole: c.lastRole,
      waiting:
        l.status !== "converted" &&
        c.lastInterestedAt !== "" &&
        c.lastInterestedAt > c.lastSentAt,
      status: l.status,
      lastClassification: c.lastClassification,
    };
  });
  return items.sort((a, b) =>
    a.waiting === b.waiting ? b.lastAt.localeCompare(a.lastAt) : a.waiting ? -1 : 1
  );
}

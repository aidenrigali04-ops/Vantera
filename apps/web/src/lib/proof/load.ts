import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProof } from "./build";
import { PROOF_PAGE_SIZE, PROOF_ROW_CAP, type ProofInput, type ProofLead, type ProofModel } from "./types";

type Read<T> = { data: T[] | null; error: unknown };
type Page<T> = (from: number, to: number) => PromiseLike<Read<T>>;
type Paged<T> = { rows: T[]; capped: boolean };

type SendRow = { lead_id: string | null };
type ReplyRow = { lead_id: string | null; classification: string | null };
type SignalRow = { lead_id: string | null; kind: string };
type ObsRow = { lead_id: string | null; watch_target: string | null };

/** Thrown when the prospects read fails: the route error boundary shows it, never provider text. */
export const PROOF_LOAD_ERROR = "Couldn't load your results.";

/**
 * PostgREST truncates every response at max-rows (1000), so a single `.limit(5000)` would
 * silently under-count. Page sequentially until a short page or PROOF_ROW_CAP. A failed
 * page is logged server-side; the rows read so far are kept and the table reads as capped
 * (an incomplete count, never a false zero). `required` tables (leads) throw instead,
 * because without them every number on the page would be wrong.
 */
async function readAll<T>(table: string, page: Page<T>, required = false): Promise<Paged<T>> {
  const rows: T[] = [];
  for (let from = 0; from < PROOF_ROW_CAP; from += PROOF_PAGE_SIZE) {
    const res = await page(from, Math.min(from + PROOF_PAGE_SIZE, PROOF_ROW_CAP) - 1);
    if (res.error) {
      console.error(`proof: ${table} read failed`, res.error);
      if (required) throw new Error(PROOF_LOAD_ERROR);
      return { rows, capped: true };
    }
    const data = res.data ?? [];
    rows.push(...data);
    if (data.length < PROOF_PAGE_SIZE) break;
  }
  return { rows, capped: rows.length >= PROOF_ROW_CAP };
}

/** Offset paging while a run inserts newer rows can serve the same lead twice; keep the first. */
function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

const hasLead = <R extends { lead_id: string | null }>(r: R): r is R & { lead_id: string } =>
  r.lead_id !== null;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

/** The intent agent's config.watch (written by deployIntent); missing arrays parse as []. */
export function parseWatch(config: unknown): ProofInput["watch"] {
  const watch = (config as { watch?: unknown } | null | undefined)?.watch;
  if (!watch || typeof watch !== "object") return null;
  const w = watch as Record<string, unknown>;
  return {
    keywords: strings(w.keywords),
    competitors: strings(w.competitors),
    creators: strings(w.creators),
    hashtags: strings(w.hashtags),
  };
}

async function readWatch(db: SupabaseClient): Promise<ProofInput["watch"]> {
  const res = await db.from("agents").select("config").eq("kind", "intent").limit(1).maybeSingle();
  if (res.error) {
    console.error("proof: agents read failed", res.error);
    return null;
  }
  return parseWatch((res.data as { config?: unknown } | null)?.config ?? null);
}

/**
 * Lead-level proof rows for the session's own workspace. Takes only the session client:
 * RLS does the scoping (rule 02) — this never accepts or filters by a workspace key.
 * Each table pages in a stable order (own timestamp desc, then id desc). Throws
 * PROOF_LOAD_ERROR when the prospects read fails.
 */
export async function loadProof(db: SupabaseClient): Promise<ProofModel> {
  const desc = { ascending: false } as const;
  const [leads, sends, replies, signals, obs, watch] = await Promise.all([
    readAll<ProofLead>("leads", (f, t) =>
      db.from("leads")
        .select("id,status,source,linkedin_invited_at,linkedin_connected_at,meeting_booked_at")
        .order("created_at", desc).order("id", desc).range(f, t), true),
    readAll<SendRow>("outreach_sends", (f, t) =>
      db.from("outreach_sends").select("lead_id").not("lead_id", "is", null)
        .order("sent_at", desc).order("id", desc).range(f, t)),
    readAll<ReplyRow>("replies", (f, t) =>
      db.from("replies").select("lead_id,classification")
        .order("created_at", desc).order("id", desc).range(f, t)),
    readAll<SignalRow>("lead_signals", (f, t) =>
      db.from("lead_signals").select("lead_id,kind")
        .order("created_at", desc).order("id", desc).range(f, t)),
    readAll<ObsRow>("intent_observations", (f, t) =>
      db.from("intent_observations").select("lead_id,watch_target").not("lead_id", "is", null)
        .order("observed_at", desc).order("id", desc).range(f, t)),
    readWatch(db),
  ]);

  return buildProof({
    leads: uniqueById(leads.rows),
    sendLeadIds: sends.rows.filter(hasLead).map((s) => s.lead_id),
    replies: replies.rows.filter(hasLead),
    signals: signals.rows.filter(hasLead),
    observations: obs.rows.filter(hasLead).map((o) => ({ lead_id: o.lead_id, watch_target: o.watch_target })),
    watch,
    capped: [leads, sends, replies, signals, obs].some((r) => r.capped),
  });
}

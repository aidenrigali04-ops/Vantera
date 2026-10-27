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

/**
 * PostgREST truncates every response at max-rows (1000), so a single `.limit(5000)` would
 * silently under-count. Page sequentially until a short page or PROOF_ROW_CAP. A failed
 * page is logged server-side and the whole table reads as empty — provider text never
 * reaches the UI.
 */
async function readAll<T>(table: string, page: Page<T>): Promise<Paged<T>> {
  const rows: T[] = [];
  for (let from = 0; from < PROOF_ROW_CAP; from += PROOF_PAGE_SIZE) {
    const res = await page(from, Math.min(from + PROOF_PAGE_SIZE, PROOF_ROW_CAP) - 1);
    if (res.error) {
      console.error(`proof: ${table} read failed`, res.error);
      return { rows: [], capped: false };
    }
    const data = res.data ?? [];
    rows.push(...data);
    if (data.length < PROOF_PAGE_SIZE) break;
  }
  return { rows, capped: rows.length >= PROOF_ROW_CAP };
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
 * Each table pages in a stable order (own timestamp desc, then id desc).
 */
export async function loadProof(db: SupabaseClient): Promise<ProofModel> {
  const desc = { ascending: false } as const;
  const [leads, sends, replies, signals, obs, watch] = await Promise.all([
    readAll<ProofLead>("leads", (f, t) =>
      db.from("leads")
        .select("id,status,source,linkedin_invited_at,linkedin_connected_at,meeting_booked_at")
        .order("created_at", desc).order("id", desc).range(f, t)),
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
    leads: leads.rows,
    sendLeadIds: sends.rows.filter(hasLead).map((s) => s.lead_id),
    replies: replies.rows.filter(hasLead),
    signals: signals.rows.filter(hasLead),
    observations: obs.rows.filter(hasLead).map((o) => ({ lead_id: o.lead_id, watch_target: o.watch_target })),
    watch,
    capped: [leads, sends, replies, signals, obs].some((r) => r.capped),
  });
}

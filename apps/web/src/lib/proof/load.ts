import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProof } from "./build";
import { PROOF_ROW_CAP, type ProofInput, type ProofLead, type ProofModel } from "./types";

type Read<T> = { data: T | null; error: unknown };

/** A failed read is logged server-side and treated as empty — provider text never reaches the UI. */
function rowsOf<T>(table: string, res: Read<T[]>): T[] {
  if (res.error) {
    console.error(`proof: ${table} read failed`, res.error);
    return [];
  }
  return res.data ?? [];
}

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

/**
 * Lead-level proof rows for the session's own workspace. Takes only the session client:
 * RLS does the scoping (rule 02) — this never accepts or filters by a workspace key.
 */
export async function loadProof(db: SupabaseClient): Promise<ProofModel> {
  const [leadsRes, sendsRes, repliesRes, signalsRes, obsRes, agentRes] = await Promise.all([
    db.from("leads")
      .select("id,status,source,linkedin_invited_at,linkedin_connected_at,meeting_booked_at")
      .limit(PROOF_ROW_CAP),
    db.from("outreach_sends").select("lead_id").not("lead_id", "is", null).limit(PROOF_ROW_CAP),
    db.from("replies").select("lead_id,classification").limit(PROOF_ROW_CAP),
    db.from("lead_signals").select("lead_id,kind").limit(PROOF_ROW_CAP),
    db.from("intent_observations")
      .select("lead_id,watch_target")
      .not("lead_id", "is", null)
      .limit(PROOF_ROW_CAP),
    db.from("agents").select("config").eq("kind", "intent").limit(1).maybeSingle(),
  ]);

  const leads = rowsOf<ProofLead>("leads", leadsRes as Read<ProofLead[]>);
  const sends = rowsOf<{ lead_id: string | null }>("outreach_sends", sendsRes as Read<{ lead_id: string | null }[]>);
  const replies = rowsOf<ProofInput["replies"][number]>("replies", repliesRes as Read<ProofInput["replies"]>);
  const signals = rowsOf<ProofInput["signals"][number]>("lead_signals", signalsRes as Read<ProofInput["signals"]>);
  const obs = rowsOf<{ lead_id: string | null; watch_target: string | null }>(
    "intent_observations",
    obsRes as Read<{ lead_id: string | null; watch_target: string | null }[]>
  );
  let config: unknown = null;
  if (agentRes.error) console.error("proof: agents read failed", agentRes.error);
  else config = (agentRes.data as { config?: unknown } | null)?.config ?? null;

  const capped = [leads, sends, replies, signals, obs].some((r) => r.length === PROOF_ROW_CAP);

  return buildProof({
    leads,
    sendLeadIds: sends.flatMap((s) => (s.lead_id === null ? [] : [s.lead_id])),
    replies: replies.filter((r) => r.lead_id !== null),
    signals: signals.filter((s) => s.lead_id !== null),
    observations: obs.flatMap((o) => (o.lead_id === null ? [] : [{ lead_id: o.lead_id, watch_target: o.watch_target }])),
    watch: parseWatch(config),
    capped,
  });
}

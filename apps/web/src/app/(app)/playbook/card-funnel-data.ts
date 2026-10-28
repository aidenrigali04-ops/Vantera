import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProof } from "@/lib/proof/load";
import { cardFunnels, type CardFunnels, type RunFacts } from "./card-funnel";

/**
 * One proof read per request (RLS-scoped session client) + the latest completed intent run,
 * folded into the per-card mini funnels. Server-only; the cards get plain data.
 * A failed read is logged and yields null, so the cards render without a funnel.
 */
export async function loadCardFunnels(db: SupabaseClient): Promise<CardFunnels | null> {
  try {
    const [proof, { data: intentRun }] = await Promise.all([
      loadProof(db),
      db
        .from("agent_runs")
        .select("summary")
        .eq("kind", "intent")
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ summary: RunFacts["intentSummary"] }>(),
    ]);
    return cardFunnels(proof, { intentSummary: intentRun?.summary ?? null, intentRan: intentRun != null });
  } catch (err) {
    console.error("playbook: card funnels failed", err);
    return null;
  }
}

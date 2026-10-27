import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { loadAnalytics } from "@/lib/analytics";
import { loadProof } from "@/lib/proof/load";
import { loadOutreachDiagnosis } from "@/lib/optimize";
import { AnalyticsView } from "./analytics-view";

// The Analytics view of the Results surface — the proof: the eight-stage count funnel and where
// prospects come from (loadProof), plus the dollar layer from loadAnalytics (shared with the
// copilot tool so the money never diverges). RLS scopes every query (rule 02).
export async function AnalyticsSection() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const [vm, proof, outreach] = await Promise.all([
    loadAnalytics(supabase),
    loadProof(supabase),
    loadOutreachDiagnosis(supabase),
  ]);

  return <AnalyticsView proof={proof} roi={vm.roi} hasValue={vm.hasValue} outreach={outreach} />;
}

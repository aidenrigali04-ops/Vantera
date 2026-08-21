import { createClient } from "@/lib/supabase/server";
import { resolveSequenceConfig } from "@vantera/jobs/pipeline/sequence-config";
import { SequenceBuilder } from "./sequence-builder";

export const metadata = { title: "Sequence" };

export default async function SequencePage() {
  const supabase = await createClient();
  // RLS scopes to the session's account; one campaign per account in v1.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, sequence_config")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const config = resolveSequenceConfig(
    (campaign?.sequence_config as Parameters<typeof resolveSequenceConfig>[0]) ?? null
  );
  return <SequenceBuilder config={config} hasCampaign={Boolean(campaign)} />;
}

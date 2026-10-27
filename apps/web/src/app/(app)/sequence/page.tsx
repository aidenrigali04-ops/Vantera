import { createClient } from "@/lib/supabase/server";
import { resolveSequenceConfig } from "@vantera/jobs/pipeline/sequence-config";
import {
  LINKEDIN_RAMP,
  LINKEDIN_STEADY_DAILY_INVITES,
  LINKEDIN_STEADY_DAILY_MESSAGES,
  LINKEDIN_WEEKLY_INVITE_CEILING,
} from "@vantera/jobs/pipeline/safety-limits";
import type { CapsInput } from "@/lib/safety/caps-line";
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
  // The caps on screen are the code's caps — never hardcoded in the UI (rule 07).
  const caps: CapsInput = {
    dailyInvites: LINKEDIN_STEADY_DAILY_INVITES,
    dailyMessages: LINKEDIN_STEADY_DAILY_MESSAGES,
    weeklyInvites: LINKEDIN_WEEKLY_INVITE_CEILING,
    ramp: LINKEDIN_RAMP.map((s) => ({ ...s })),
  };
  return <SequenceBuilder config={config} hasCampaign={Boolean(campaign)} caps={caps} />;
}

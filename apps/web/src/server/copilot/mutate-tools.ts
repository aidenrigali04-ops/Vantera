import type { SupabaseClient } from "@supabase/supabase-js";

export interface SendStateOutcome {
  summary: string;
  undoable: boolean;
  undoTo?: "pause" | "resume";
  deepLink: string;
}

export async function runCampaignSendState(
  db: SupabaseClient,
  op: "pause" | "resume"
): Promise<SendStateOutcome> {
  const { data: agent } = await db
    .from("agents")
    .select("name, campaigns(id, status)")
    .eq("kind", "copy")
    .limit(1)
    .maybeSingle();

  const campRaw = (agent as { campaigns?: unknown } | null)?.campaigns;
  const campaign = (
    Array.isArray(campRaw) ? campRaw[0] : campRaw
  ) as { id: string; status: string } | undefined;

  if (!campaign) {
    return {
      summary: "There's no outreach campaign to update yet.",
      undoable: false,
      deepLink: "/playbook",
    };
  }

  const next = op === "pause" ? "paused" : "active";
  const { error } = await db
    .from("campaigns")
    .update({ status: next })
    .eq("id", campaign.id);

  if (error) {
    return {
      summary: "Couldn't update the campaign. Only admins can do this.",
      undoable: false,
      deepLink: "/playbook",
    };
  }

  const name =
    (agent as { name?: string }).name ?? "your outreach agent";

  return {
    summary:
      op === "pause"
        ? `Paused outreach for ${name}.`
        : `Resumed outreach for ${name}.`,
    undoable: true,
    undoTo: op === "pause" ? "resume" : "pause",
    deepLink: "/playbook",
  };
}

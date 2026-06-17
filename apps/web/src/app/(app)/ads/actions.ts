"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateAdConcepts } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { parseAdForm } from "./validation";

export type AdActionState = { error?: string };

async function sessionAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null };
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, onboarding_industry, website_scan")
    .limit(1)
    .maybeSingle<{
      id: string;
      name: string | null;
      onboarding_industry: string | null;
      website_scan: { summary?: string } | null;
    }>();
  return { supabase, user, account };
}

/**
 * Generate an ad campaign: create the campaign + its internal nurture campaign, generate grounded
 * ad concepts via the ad brain, and persist them as draft creatives (with humanizer style flags so
 * a fabricated claim is never silently published). Generation is interactive, so it's a server
 * action, not a Trigger job.
 */
export async function generateAdCampaign(
  _prev: AdActionState,
  formData: FormData
): Promise<AdActionState> {
  const parsed = parseAdForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, offer, targetIcp, cta, variants } = parsed.values;

  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  // internal nurture campaign — ad-sourced leads hang off this and flow into the sequence engine
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      account_id: account.id,
      name: `${name} (ads)`,
      status: "active",
      channels: ["email"],
      targeting: [{ type: "icp", value: targetIcp }],
      copywriting_mode: "agent",
      send_mode: "review",
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (campaignError || !campaign) {
    return { error: "Could not create the campaign. Only workspace admins can do this." };
  }

  const { data: adCampaign, error: adError } = await supabase
    .from("ad_campaigns")
    .insert({
      account_id: account.id,
      name,
      offer,
      target_icp: targetIcp,
      cta,
      campaign_id: campaign.id,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (adError || !adCampaign) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return { error: "Could not create the campaign. Only workspace admins can do this." };
  }

  let result;
  try {
    result = await generateAdConcepts({
      accountName: account.name,
      accountIndustry: account.onboarding_industry,
      valueProp: account.website_scan?.summary ?? null,
      offer,
      targetIcp,
      cta,
      variants,
    });
  } catch {
    // keep the (empty) campaign so the user can retry generation rather than re-enter everything
    return { error: "Couldn't generate concepts right now. Open the campaign and try again." };
  }

  if (result.concepts.length > 0) {
    await supabase.from("ad_creatives").insert(
      result.concepts.map((c) => ({
        account_id: account.id,
        ad_campaign_id: adCampaign.id,
        headline: c.headline,
        primary_text: c.primaryText,
        description: c.description ?? null,
        cta: c.cta,
        creative_prompt: c.creativePrompt,
        style_flags: result.violations.length ? JSON.stringify(result.violations) : null,
      }))
    );
  }

  revalidatePath("/ads");
  redirect(`/ads/${adCampaign.id}`);
}

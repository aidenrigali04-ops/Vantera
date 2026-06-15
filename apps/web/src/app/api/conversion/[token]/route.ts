import { createServiceClient } from "@/lib/supabase/service";
import { markConverted } from "@vantera/jobs/pipeline/conversion";
import type { ConversionStore } from "@vantera/jobs/pipeline/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Service-role ConversionStore over the Supabase client (bypasses RLS — see service.ts). */
function conversionStore(): ConversionStore {
  const supabase = createServiceClient();
  return {
    resolveConversionToken: async (token) => {
      const { data } = await supabase
        .from("conversion_tokens")
        .select("account_id, lead_id, campaign_id, target_url")
        .eq("token", token)
        .maybeSingle();
      if (!data) return null;
      return {
        accountId: data.account_id as string,
        leadId: data.lead_id as string,
        campaignId: data.campaign_id as string,
        targetUrl: data.target_url as string,
      };
    },
    setLeadConverted: async (leadId) => {
      await supabase.from("leads").update({ status: "converted" }).eq("id", leadId);
    },
    closeSequenceRun: async (campaignId, leadId) => {
      await supabase
        .from("sequence_runs")
        .update({ status: "converted" })
        .eq("campaign_id", campaignId)
        .eq("lead_id", leadId);
    },
    cancelPendingSends: async (leadId) => {
      const { data } = await supabase
        .from("scheduled_sends")
        .update({ status: "canceled", error: "lead converted" })
        .eq("lead_id", leadId)
        .in("status", ["pending_review", "approved", "scheduled"])
        .select("id");
      return data?.length ?? 0;
    },
    setCampaignLeadStatus: async (campaignId, leadId, status) => {
      await supabase
        .from("campaign_leads")
        .update({ status })
        .eq("campaign_id", campaignId)
        .eq("lead_id", leadId);
    },
    insertLeadNotification: async (n) => {
      await supabase.from("lead_notifications").insert({
        account_id: n.accountId,
        lead_id: n.leadId,
        kind: n.kind,
        body: n.body,
      });
    },
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fallback = new URL("/", req.url).toString();
  // garbage input: skip the DB, just send them home (never an error page for a prospect)
  if (!UUID_RE.test(token)) return Response.redirect(fallback, 302);
  const { redirectUrl } = await markConverted(token, { store: conversionStore() });
  return Response.redirect(redirectUrl ?? fallback, 302);
}

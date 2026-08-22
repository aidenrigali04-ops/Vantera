import { z } from "zod";
import type { CopilotTool } from "@vantera/help-agent";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDraftQueueSummary,
  getCampaignStatus,
  getGoalProgress,
  getLeadScoreRationale,
  getBillingStatus,
  getCrmStatus,
  getChannelStatusForAccount,
  getReturnOnSpend,
  getIntentStatus,
} from "./read-tools";
import { runCampaignSendState } from "./mutate-tools";

export function buildAccountTools(db: SupabaseClient, accountId: string): CopilotTool[] {
  return [
    {
      name: "getDraftQueueSummary",
      tier: "read",
      description: "How many drafts are waiting in Approvals (the approval queue).",
      parameters: z.object({}),
      run: async () => getDraftQueueSummary(db, accountId),
    },
    {
      name: "getCampaignStatus",
      tier: "read",
      description: "The Outreach agent's status and send mode.",
      parameters: z.object({}),
      run: async () => getCampaignStatus(db, accountId),
    },
    {
      name: "getGoalProgress",
      tier: "read",
      description:
        "Progress toward the revenue goal: qualified leads, in outreach, replied.",
      parameters: z.object({}),
      run: async () => getGoalProgress(db, accountId),
    },
    {
      name: "getLeadScoreRationale",
      tier: "read",
      description: "Why a lead got its score. Pass the lead's first name.",
      parameters: z.object({ leadName: z.string() }),
      run: async (args: Record<string, unknown>) => getLeadScoreRationale(db, args.leadName as string),
    },
    {
      name: "getBillingStatus",
      tier: "read",
      description:
        "The account's current plan, subscription status, and seat/campaign usage vs. limits.",
      parameters: z.object({}),
      run: async () => getBillingStatus(db, accountId),
    },
    {
      name: "getCrmStatus",
      tier: "read",
      description:
        "Connected CRM / notification destinations and recent closed-deal push results (success/pending/failed).",
      parameters: z.object({}),
      run: async () => getCrmStatus(db, accountId),
    },
    {
      name: "getChannelStatus",
      tier: "read",
      description:
        "LinkedIn connection status: whether a LinkedIn account is connected and active, the primary account's state, and how many accounts are connected. Connecting LinkedIn is the activation gate. Use to answer 'is my LinkedIn connected?' or 'why isn't my outreach going out yet?'.",
      parameters: z.object({}),
      run: async () => getChannelStatusForAccount(db, accountId),
    },
    {
      name: "getReturnOnSpend",
      tier: "read",
      description:
        "Return on spend: the pipeline-to-spend ratio vs the 2x renewal bar, cost per meeting, cost per close, and annual spend. Use for 'is this worth it / what's my ROI / what does a meeting cost me?'.",
      parameters: z.object({}),
      run: async () => getReturnOnSpend(db),
    },
    {
      name: "getIntentStatus",
      tier: "read",
      description:
        "The Intent Agent: whether it's deployed and live, how many creators/competitors/keywords/hashtags it watches, which signal types are on (engagement/content), and how many leads it has sourced from LinkedIn intent. Use for 'is my Intent Agent working?' or 'how many intent leads have we found?'.",
      parameters: z.object({}),
      run: async () => getIntentStatus(db, accountId),
    },
    {
      name: "pauseCampaign",
      tier: "mutate",
      description: "Pause all outreach for the Outreach agent.",
      parameters: z.object({}),
      confirmationSummary: () => "This pauses all outreach sends until you resume.",
      run: async () => runCampaignSendState(db, "pause"),
    },
    {
      name: "resumeCampaign",
      tier: "mutate",
      description: "Resume outreach for the Outreach agent.",
      parameters: z.object({}),
      confirmationSummary: () => "This resumes outreach sends.",
      run: async () => runCampaignSendState(db, "resume"),
    },
  ];
}

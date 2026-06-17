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
  getWarmupStatusForAccount,
  getReturnOnSpend,
} from "./read-tools";
import { runCampaignSendState } from "./mutate-tools";

export function buildAccountTools(db: SupabaseClient, accountId: string): CopilotTool[] {
  return [
    {
      name: "getDraftQueueSummary",
      tier: "read",
      description: "How many drafts are waiting in the review queue, by channel.",
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
      name: "getWarmupStatus",
      tier: "read",
      description:
        "Current email warm-up phase (warming vs. ready), estimated days until email outreach can start, and which channels are live now. Use to answer questions like 'when does my email start?' or 'why aren't emails going out yet?'.",
      parameters: z.object({}),
      run: async () => getWarmupStatusForAccount(db, accountId),
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

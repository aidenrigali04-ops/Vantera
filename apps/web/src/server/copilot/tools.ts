import { z } from "zod";
import type { CopilotTool } from "@vantera/help-agent";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDraftQueueSummary,
  getCampaignStatus,
  getGoalProgress,
  getLeadScoreRationale,
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

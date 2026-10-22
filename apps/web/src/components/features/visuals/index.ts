import type { FeatureSlug } from "@/lib/features";
import type { FeatureVisuals } from "../types";
import { visuals as prospectDiscovery } from "./prospect-discovery";
import { visuals as fitScoring } from "./fit-scoring";
import { visuals as machineLearnedTargeting } from "./machine-learned-targeting";
import { visuals as autopilotOutreach } from "./autopilot-outreach";
import { visuals as unifiedInbox } from "./unified-inbox";
import { visuals as accountSafety } from "./account-safety";
import { visuals as crmSync } from "./crm-sync";

/** Each feature page's pictures, by slug (one module per feature in this folder). */
export const VISUALS: Record<FeatureSlug, FeatureVisuals> = {
  "prospect-discovery": prospectDiscovery,
  "fit-scoring": fitScoring,
  "machine-learned-targeting": machineLearnedTargeting,
  "autopilot-outreach": autopilotOutreach,
  "unified-inbox": unifiedInbox,
  "account-safety": accountSafety,
  "crm-sync": crmSync,
};

import type { CrmContactLookup } from "@vantera/crm-infra";

/**
 * CRM dedup gate (report #10, the "janitor effect"). Decides whether to skip cold outreach to a
 * lead based on its state in the customer's connected CRM: skip an existing customer or a contact
 * with an open deal (already in motion); a stale lead or non-customer is fair game. Pure — the
 * pipeline does the lookup and suppression; this only judges the lookup result.
 */

/** Lifecycle stages that mean "already a relationship" — outreach here erodes trust. */
const RELATIONSHIP_STAGES = new Set([
  "customer",
  "opportunity",
  "won",
  "closedwon",
  "closed_won",
]);

export interface CrmDedupDecision {
  skip: boolean;
  reason: string | null;
}

export function shouldSkipForCrm(lookup: CrmContactLookup | null): CrmDedupDecision {
  if (!lookup || !lookup.exists) return { skip: false, reason: null };
  if (lookup.openDeal) return { skip: true, reason: "an open deal in your CRM" };
  const stage = (lookup.lifecycleStage ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (RELATIONSHIP_STAGES.has(stage)) {
    return { skip: true, reason: `already a ${lookup.lifecycleStage} in your CRM` };
  }
  return { skip: false, reason: null };
}

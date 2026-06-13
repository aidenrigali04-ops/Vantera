import { PLANS, type PlanTier } from "./plans";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface EntitlementSnapshot {
  plan: PlanTier | "none";
  subscriptionStatus: SubscriptionStatus;
  seatsPurchased: number;
  linkedinAccountsPurchased: number;
  currentPeriodEnd: string | null;
}

export interface Limits {
  maxSeats: number;
  maxMailboxes: number;
  maxCampaigns: number;
  maxLinkedinAccounts: number;
  features: { aiCaller: boolean; metaAds: boolean };
}

export type GatedResource = "seat" | "mailbox" | "campaign" | "linkedinAccount";

const EMPTY: Limits = {
  maxSeats: 0,
  maxMailboxes: 0,
  maxCampaigns: 0,
  maxLinkedinAccounts: 0,
  features: { aiCaller: false, metaAds: false },
};

export function isActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export function resolveEntitlements(snapshot: EntitlementSnapshot): Limits {
  if (snapshot.plan === "none" || !isActive(snapshot.subscriptionStatus)) {
    return EMPTY;
  }
  const plan = PLANS[snapshot.plan];
  return {
    maxSeats: plan.includedSeats + Math.max(0, snapshot.seatsPurchased),
    maxMailboxes: plan.maxMailboxes,
    maxCampaigns: plan.maxCampaigns,
    maxLinkedinAccounts: Math.max(0, snapshot.linkedinAccountsPurchased),
    features: plan.features,
  };
}

const LIMIT_FIELD: Record<GatedResource, keyof Limits> = {
  seat: "maxSeats",
  mailbox: "maxMailboxes",
  campaign: "maxCampaigns",
  linkedinAccount: "maxLinkedinAccounts",
};

export function checkLimit(
  resource: GatedResource,
  current: number,
  limits: Limits
): { allowed: boolean; reason?: string } {
  const max = limits[LIMIT_FIELD[resource]] as number;
  if (current >= max) {
    return {
      allowed: false,
      reason: `You've reached your plan limit for ${resource}s. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}

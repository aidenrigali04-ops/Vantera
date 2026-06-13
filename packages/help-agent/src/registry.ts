import type { Tier } from "./types";

export function requiresConfirmation(tier: Tier): boolean {
  return tier === "mutate" || tier === "critical";
}

export function assertApproved(tier: Tier, approved: boolean): void {
  if (requiresConfirmation(tier) && !approved) {
    throw new Error("tier requires explicit confirmation");
  }
}

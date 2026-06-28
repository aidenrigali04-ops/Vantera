import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface SyncConnectionsStore {
  getInvitedUnacceptedLeads(accountId: string): Promise<{ leadId: string; profileUrl: string }[]>;
  getLeadAssignedIdentity(leadId: string): Promise<{ providerRef: string; status: string } | null>;
  setLeadConnected(leadId: string, at: Date): Promise<void>;
}

export interface SyncConnectionsDeps {
  store: SyncConnectionsStore;
  linkedinInfra: Pick<LinkedInInfra, "getConnectionState">;
  accountId: string;
  now?: () => Date;
}

export interface SyncConnectionsResult {
  checked: number;
  connected: number;
  /** Per-lead distance the provider reported — diagnostic for confirming the connection signal. */
  distances: { leadId: string; distance: string | null; connected: boolean }[];
}

/**
 * Backfill missed connection acceptances: for each lead we invited but never marked connected, ask
 * the provider whether it's now a 1st-degree connection (the invite was accepted). If so, mark it
 * connected so the dispatcher fires the parked follow-up message. Reconciles acceptances dropped
 * while the inbound webhook was down. Conservative — only an explicit 1st-degree signal flips a lead.
 */
export async function runSyncConnections(deps: SyncConnectionsDeps): Promise<SyncConnectionsResult> {
  const now = deps.now?.() ?? new Date();
  const leads = await deps.store.getInvitedUnacceptedLeads(deps.accountId);
  let connected = 0;
  const distances: SyncConnectionsResult["distances"] = [];
  for (const lead of leads) {
    const identity = await deps.store.getLeadAssignedIdentity(lead.leadId);
    if (!identity || identity.status !== "active") continue;
    const state = await deps.linkedinInfra.getConnectionState({
      connectedAccountId: identity.providerRef,
      profileUrl: lead.profileUrl,
    });
    distances.push({ leadId: lead.leadId, distance: state.distance, connected: state.connected });
    if (state.connected) {
      await deps.store.setLeadConnected(lead.leadId, now);
      connected += 1;
    }
  }
  return { checked: leads.length, connected, distances };
}

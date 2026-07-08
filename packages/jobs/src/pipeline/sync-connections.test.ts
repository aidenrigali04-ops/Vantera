import { describe, expect, it, vi } from "vitest";
import { runSyncConnections, SYNC_CHECKS_PER_RUN, type SyncConnectionsStore } from "./sync-connections";

function makeStore(over: Partial<SyncConnectionsStore> = {}): SyncConnectionsStore & {
  connectedCalls: { leadId: string }[];
} {
  const connectedCalls: { leadId: string }[] = [];
  return {
    connectedCalls,
    getInvitedUnacceptedLeads: vi.fn(async () => [
      { leadId: "l1", profileUrl: "https://linkedin.com/in/a" },
      { leadId: "l2", profileUrl: "https://linkedin.com/in/b" },
    ]),
    getLeadAssignedIdentity: vi.fn(async () => ({ providerRef: "ACoAA_x", status: "active" })),
    setLeadConnected: vi.fn(async (leadId: string) => {
      connectedCalls.push({ leadId });
    }),
    ...over,
  };
}

describe("runSyncConnections", () => {
  it("marks only the leads the provider reports as 1st-degree connected", async () => {
    const store = makeStore();
    const linkedinInfra = {
      getConnectionState: vi.fn(async ({ profileUrl }: { profileUrl: string }) =>
        profileUrl.endsWith("/a")
          ? { connected: true, distance: "DISTANCE_1" }
          : { connected: false, distance: "DISTANCE_2" }
      ),
    };

    const res = await runSyncConnections({ store, linkedinInfra, accountId: "acc1", sleep: async () => {} });

    expect(res.checked).toBe(2);
    expect(res.connected).toBe(1);
    expect(store.connectedCalls).toEqual([{ leadId: "l1" }]); // only the connected one
    expect(res.distances).toEqual([
      { leadId: "l1", distance: "DISTANCE_1", connected: true },
      { leadId: "l2", distance: "DISTANCE_2", connected: false },
    ]);
  });

  it("skips a lead whose assigned sender is not active (never marks it connected)", async () => {
    const store = makeStore({ getLeadAssignedIdentity: vi.fn(async () => ({ providerRef: "x", status: "restricted" })) });
    const linkedinInfra = { getConnectionState: vi.fn(async () => ({ connected: true, distance: "DISTANCE_1" })) };

    const res = await runSyncConnections({ store, linkedinInfra, accountId: "acc1", sleep: async () => {} });

    expect(res.connected).toBe(0);
    expect(store.connectedCalls).toEqual([]);
    expect(linkedinInfra.getConnectionState).not.toHaveBeenCalled();
  });
});

it("caps profile reads per run — a big backlog drains over several runs, never a read storm", async () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    leadId: `l${i}`,
    profileUrl: `https://linkedin.com/in/p${i}`,
  }));
  const store = makeStore({ getInvitedUnacceptedLeads: vi.fn(async () => many) });
  const linkedinInfra = {
    getConnectionState: vi.fn(async () => ({ connected: false, distance: "DISTANCE_2" })),
  };

  const res = await runSyncConnections({ store, linkedinInfra, accountId: "acc1", sleep: async () => {} });

  expect(res.checked).toBe(SYNC_CHECKS_PER_RUN);
  expect(linkedinInfra.getConnectionState).toHaveBeenCalledTimes(SYNC_CHECKS_PER_RUN);
});

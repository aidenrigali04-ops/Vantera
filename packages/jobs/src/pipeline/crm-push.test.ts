import { describe, expect, it } from "vitest";
import type { CrmConnector, ConnectorResult } from "@vantera/crm-infra";
import {
  runCrmPush,
  type CrmConnectionRow,
  type CrmPushEventRow,
  type CrmPushStore,
} from "./crm-push";

function fakeConnector(over: Partial<CrmConnector> = {}): CrmConnector {
  return {
    provider: "slack",
    kind: "notify",
    meta: {} as CrmConnector["meta"],
    getAuthorizeUrl: () => "https://authorize",
    exchangeCode: async () => ({ accessToken: "a" }),
    refreshToken: async () => ({ accessToken: "refreshed" }),
    testConnection: async () => ({ ok: true, data: {} }),
    pushClosedDeal: async (): Promise<ConnectorResult<{ externalRef?: string }>> => ({
      ok: true,
      data: { externalRef: "ext-1" },
    }),
    ...over,
  };
}

const baseEvent: CrmPushEventRow = {
  id: "evt-1",
  accountId: "acc-1",
  connectionId: "conn-1",
  leadId: "lead-1",
  status: "pending",
  attempts: 0,
  payload: {
    leadId: "lead-1",
    contact: { email: "a@b.co", firstName: "A", lastName: "B" },
    dealValueCents: 50000,
    closedAt: "2026-06-14T00:00:00.000Z",
    source: "Vantera",
    config: {},
  },
};

const baseConn: CrmConnectionRow = {
  id: "conn-1",
  provider: "slack",
  status: "active",
  accessTokenEnc: "enc-access",
  refreshTokenEnc: "enc-refresh",
  tokenExpiresAt: null,
  externalAccountRef: "T1",
  config: { target: { channelId: "C1" } },
};

function makeStore(event: CrmPushEventRow | null, conn: CrmConnectionRow | null) {
  const calls = {
    success: [] as Array<{ externalRef?: string }>,
    failure: [] as Array<{ error: string; attempts: number; nextRetryAt: string | null; connectionError?: string }>,
    refreshed: [] as Array<{ accessTokenEnc: string }>,
  };
  const store: CrmPushStore = {
    loadEvent: async () => event,
    loadConnection: async () => conn,
    saveRefreshedTokens: async (_id, t) => {
      calls.refreshed.push({ accessTokenEnc: t.accessTokenEnc });
    },
    markSuccess: async (_id, externalRef) => {
      calls.success.push({ externalRef });
    },
    markFailure: async (a) => {
      calls.failure.push({
        error: a.error,
        attempts: a.attempts,
        nextRetryAt: a.nextRetryAt,
        connectionError: a.connectionError,
      });
    },
    dueEventIds: async () => [],
  };
  return { store, calls };
}

const ident = (s: string) => s;

describe("runCrmPush", () => {
  it("pushes a deal and records success", async () => {
    const { store, calls } = makeStore(baseEvent, baseConn);
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () => fakeConnector(),
      decrypt: ident,
      encrypt: ident,
    });
    expect(out.status).toBe("success");
    expect(calls.success).toHaveLength(1);
    expect(calls.success[0]!.externalRef).toBe("ext-1");
  });

  it("schedules a retry with backoff on a retryable failure", async () => {
    const { store, calls } = makeStore(baseEvent, baseConn);
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () =>
        fakeConnector({ pushClosedDeal: async () => ({ ok: false, error: "429", retryable: true }) }),
      decrypt: ident,
      encrypt: ident,
      now: () => new Date("2026-06-14T12:00:00.000Z"),
    });
    expect(out.status).toBe("retry");
    expect(calls.failure[0]!.attempts).toBe(1);
    expect(calls.failure[0]!.nextRetryAt).toBe("2026-06-14T12:01:00.000Z"); // +1m
    expect(calls.failure[0]!.connectionError).toBeUndefined();
  });

  it("terminates a non-retryable failure", async () => {
    const { store, calls } = makeStore(baseEvent, baseConn);
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () =>
        fakeConnector({ pushClosedDeal: async () => ({ ok: false, error: "bad config", retryable: false }) }),
      decrypt: ident,
      encrypt: ident,
    });
    expect(out.status).toBe("failed");
    expect(calls.failure[0]!.nextRetryAt).toBeNull();
    expect(calls.failure[0]!.connectionError).toBe("bad config");
  });

  it("terminates retryable failures once attempts hit the cap", async () => {
    const { store, calls } = makeStore({ ...baseEvent, attempts: 5 }, baseConn);
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () =>
        fakeConnector({ pushClosedDeal: async () => ({ ok: false, error: "503", retryable: true }) }),
      decrypt: ident,
      encrypt: ident,
      maxAttempts: 6,
    });
    expect(out.status).toBe("failed"); // attempt 6 == cap
    expect(calls.failure[0]!.nextRetryAt).toBeNull();
  });

  it("fails terminally when the connection is disconnected", async () => {
    const { store, calls } = makeStore(baseEvent, { ...baseConn, status: "disconnected" });
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () => fakeConnector(),
      decrypt: ident,
      encrypt: ident,
    });
    expect(out.status).toBe("failed");
    expect(calls.failure[0]!.connectionError).toContain("Disconnected");
  });

  it("refreshes an expired token before pushing", async () => {
    const expiredConn = { ...baseConn, tokenExpiresAt: "2020-01-01T00:00:00.000Z" };
    const { store, calls } = makeStore(baseEvent, expiredConn);
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () => fakeConnector(),
      decrypt: ident,
      encrypt: ident,
    });
    expect(out.status).toBe("success");
    expect(calls.refreshed).toHaveLength(1);
    expect(calls.refreshed[0]!.accessTokenEnc).toBe("refreshed");
  });

  it("skips an already-successful event", async () => {
    const { store } = makeStore({ ...baseEvent, status: "success" }, baseConn);
    const out = await runCrmPush("evt-1", {
      store,
      getConnector: () => fakeConnector(),
      decrypt: ident,
      encrypt: ident,
    });
    expect(out.status).toBe("skipped");
  });
});

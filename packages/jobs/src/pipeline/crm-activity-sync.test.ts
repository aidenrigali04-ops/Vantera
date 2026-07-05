import { describe, expect, it } from "vitest";
import { InMemoryConnector } from "@vantera/crm-infra";
import {
  renderActivityNote,
  runCrmActivitySync,
  type ActivityConnectionRow,
  type CrmActivityStore,
  type LeadActivityEvent,
} from "./crm-activity-sync";

const NOW = new Date("2026-07-04T12:00:00.000Z");

function connection(over: Partial<ActivityConnectionRow> = {}): ActivityConnectionRow {
  return {
    id: "conn-1",
    accountId: "acct-1",
    provider: "hubspot",
    status: "active",
    accessTokenEnc: "enc:tok",
    refreshTokenEnc: null,
    tokenExpiresAt: null,
    externalAccountRef: null,
    config: {
      activity: {
        enabled: true,
        events: { outreach: true, replies: true, meetings: true },
        watermark: "2026-07-04T00:00:00.000Z",
      },
    },
    ...over,
  };
}

function event(over: Partial<LeadActivityEvent> = {}): LeadActivityEvent {
  return {
    leadId: "lead-1",
    kind: "reply",
    occurredAt: "2026-07-04T06:00:00.000Z",
    excerpt: "Sounds interesting — tell me more.",
    lead: { firstName: "Ada", lastName: "Lovelace", email: "ada@analytical.io", company: "Analytical" },
    ...over,
  };
}

class FakeStore implements CrmActivityStore {
  connections: ActivityConnectionRow[] = [];
  events: LeadActivityEvent[] = [];
  refs = new Map<string, string>(); // `${connectionId}:${leadId}` -> externalRef
  watermarks = new Map<string, string>();
  errors: Array<{ connectionId: string; error: string }> = [];
  refreshed: string[] = [];

  async listActivityConnections() {
    return this.connections;
  }
  async eventsSince(_accountId: string, sinceIso: string, limit: number) {
    return this.events
      .filter((e) => e.occurredAt > sinceIso)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .slice(0, limit);
  }
  async getContactRef(connectionId: string, leadId: string) {
    return this.refs.get(`${connectionId}:${leadId}`) ?? null;
  }
  async saveContactRef(args: {
    accountId: string;
    connectionId: string;
    leadId: string;
    externalRef: string;
  }) {
    this.refs.set(`${args.connectionId}:${args.leadId}`, args.externalRef);
  }
  async saveWatermark(connectionId: string, iso: string) {
    this.watermarks.set(connectionId, iso);
  }
  async saveRefreshedTokens(connectionId: string) {
    this.refreshed.push(connectionId);
  }
  async markConnectionError(connectionId: string, error: string) {
    this.errors.push({ connectionId, error });
  }
}

function deps(store: FakeStore, connector = new InMemoryConnector("hubspot")) {
  return {
    store,
    connector,
    deps: {
      store,
      getConnector: () => connector,
      decrypt: (enc: string) => enc.replace("enc:", ""),
      encrypt: (plain: string) => `enc:${plain}`,
      now: () => NOW,
    },
  };
}

describe("runCrmActivitySync", () => {
  it("initializes the watermark to now on the first enabled tick — history is never back-dumped", async () => {
    const store = new FakeStore();
    store.connections = [
      connection({ config: { activity: { enabled: true, events: {} } } }), // no watermark yet
    ];
    store.events = [event()];
    const d = deps(store);
    const out = await runCrmActivitySync(d.deps);
    expect(store.watermarks.get("conn-1")).toBe(NOW.toISOString());
    expect(d.connector.activities).toHaveLength(0);
    expect(out.logged).toBe(0);
  });

  it("logs events past the watermark, creates the contact once, and advances the watermark", async () => {
    const store = new FakeStore();
    store.connections = [connection()];
    store.events = [
      event({ kind: "outreach", occurredAt: "2026-07-04T05:00:00.000Z", excerpt: null }),
      event({ kind: "reply", occurredAt: "2026-07-04T06:00:00.000Z" }),
    ];
    const d = deps(store);
    const out = await runCrmActivitySync(d.deps);
    expect(out.logged).toBe(2);
    expect(d.connector.ensured).toHaveLength(1); // one lead → one contact
    expect(d.connector.activities.map((a) => a.occurredAt)).toEqual([
      "2026-07-04T05:00:00.000Z",
      "2026-07-04T06:00:00.000Z",
    ]);
    expect(store.watermarks.get("conn-1")).toBe("2026-07-04T06:00:00.000Z");
    expect(store.refs.get("conn-1:lead-1")).toBeTruthy();
  });

  it("skips event kinds the user toggled off but still advances the watermark past them", async () => {
    const store = new FakeStore();
    store.connections = [
      connection({
        config: {
          activity: {
            enabled: true,
            events: { outreach: false, replies: true, meetings: true },
            watermark: "2026-07-04T00:00:00.000Z",
          },
        },
      }),
    ];
    store.events = [event({ kind: "outreach", occurredAt: "2026-07-04T05:00:00.000Z" })];
    const d = deps(store);
    const out = await runCrmActivitySync(d.deps);
    expect(out.logged).toBe(0);
    expect(d.connector.activities).toHaveLength(0);
    expect(store.watermarks.get("conn-1")).toBe("2026-07-04T05:00:00.000Z");
  });

  it("stops at the first failure, keeps the watermark before the failed event, and records the error", async () => {
    const store = new FakeStore();
    store.connections = [connection()];
    store.events = [
      event({ occurredAt: "2026-07-04T05:00:00.000Z" }),
      event({ occurredAt: "2026-07-04T06:00:00.000Z" }),
    ];
    const d = deps(store);
    // first event: ensure + log succeed; second: log fails
    let calls = 0;
    const origLog = d.connector.logActivity.bind(d.connector);
    d.connector.logActivity = async (ctx, input) => {
      calls++;
      if (calls === 2) return { ok: false, error: "HubSpot note failed (403).", retryable: false };
      return origLog(ctx, input);
    };
    const out = await runCrmActivitySync(d.deps);
    expect(out.logged).toBe(1);
    expect(store.watermarks.get("conn-1")).toBe("2026-07-04T05:00:00.000Z");
    expect(store.errors[0]?.error).toContain("HubSpot note failed");
  });

  it("reuses a stored contact ref instead of re-ensuring", async () => {
    const store = new FakeStore();
    store.connections = [connection()];
    store.refs.set("conn-1:lead-1", "existing-contact");
    store.events = [event()];
    const d = deps(store);
    await runCrmActivitySync(d.deps);
    expect(d.connector.ensured).toHaveLength(0);
    expect(d.connector.activities[0]?.contactId).toBe("existing-contact");
  });

  it("ignores disabled connections and providers without activity support", async () => {
    const store = new FakeStore();
    store.connections = [
      connection({ id: "off", config: { activity: { enabled: false } } }),
      connection({ id: "slacky", provider: "slack" }), // no ensureContact/logActivity
    ];
    store.events = [event()];
    const d = deps(store, new InMemoryConnector("slack"));
    const out = await runCrmActivitySync(d.deps);
    expect(out.logged).toBe(0);
  });
});

describe("renderActivityNote", () => {
  it("renders each kind with the lead's name and clamps reply excerpts", () => {
    const lead = { firstName: "Ada", lastName: "Lovelace" };
    expect(renderActivityNote(event({ kind: "outreach", lead, excerpt: null }))).toBe(
      "LinkedIn outreach sent to Ada Lovelace — via Vantera"
    );
    expect(renderActivityNote(event({ kind: "meeting", lead, excerpt: null }))).toBe(
      "Meeting booked with Ada Lovelace — via Vantera"
    );
    const long = "x".repeat(400);
    const note = renderActivityNote(event({ kind: "reply", lead, excerpt: long }));
    expect(note).toContain("LinkedIn reply from Ada Lovelace");
    expect(note.length).toBeLessThan(360);
  });

  it("falls back to the company when the lead has no name", () => {
    expect(
      renderActivityNote(event({ kind: "outreach", lead: { company: "Analytical" }, excerpt: null }))
    ).toBe("LinkedIn outreach sent to Analytical — via Vantera");
  });
});

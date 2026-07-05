import { afterEach, describe, expect, it, vi } from "vitest";
import { getConnector } from "./index";
import type { ClosedDeal, ConnectorCtx } from "./types";

const CREDS = { clientId: "cid", clientSecret: "secret" };

function mockFetch(responses: Array<{ ok?: boolean; status?: number; json: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)]!;
    i++;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const deal: ClosedDeal = {
  leadId: "lead-1",
  contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@analytical.io", company: "Analytical" },
  dealValueCents: 1_200_00,
  closedAt: "2026-06-14T00:00:00.000Z",
  source: "Vantera",
  config: {},
};

function ctx(target: Record<string, string>, externalAccountRef?: string): ConnectorCtx {
  return { accessToken: "access-tok", externalAccountRef, config: { target } };
}

describe("OAuth exchange (generic)", () => {
  it("exchanges an auth code into a token set and captures the account handle", async () => {
    const calls = mockFetch([
      { json: { access_token: "AT", refresh_token: "RT", expires_in: 3600, instance_url: "https://x.my.salesforce.com" } },
    ]);
    const token = await getConnector("salesforce", CREDS).exchangeCode("the-code", "https://app/cb");
    expect(token.accessToken).toBe("AT");
    expect(token.refreshToken).toBe("RT");
    expect(token.externalAccountRef).toBe("https://x.my.salesforce.com");
    expect(token.expiresAt).toBeTruthy();
    // posts to the token endpoint with the code + redirect
    expect(calls[0]!.url).toBe("https://login.salesforce.com/services/oauth2/token");
    expect(String(calls[0]!.init.body)).toContain("grant_type=authorization_code");
    expect(String(calls[0]!.init.body)).toContain("the-code");
  });

  it("throws when the token endpoint errors", async () => {
    mockFetch([{ ok: false, status: 400, json: { error: "invalid_grant" } }]);
    await expect(getConnector("hubspot", CREDS).exchangeCode("bad", "https://app/cb")).rejects.toThrow();
  });
});

describe("Slack adapter", () => {
  it("posts a deal message to the configured channel", async () => {
    const calls = mockFetch([{ json: { ok: true, ts: "1700000000.0001" } }]);
    const res = await getConnector("slack").pushClosedDeal(ctx({ channelId: "C123" }), deal);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalRef).toBe("1700000000.0001");
    expect(calls[0]!.url).toBe("https://slack.com/api/chat.postMessage");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.channel).toBe("C123");
    expect(body.text).toContain("Analytical");
  });

  it("treats ratelimited as retryable, other errors as terminal", async () => {
    mockFetch([{ json: { ok: false, error: "ratelimited" } }]);
    const r1 = await getConnector("slack").pushClosedDeal(ctx({ channelId: "C1" }), deal);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.retryable).toBe(true);

    mockFetch([{ json: { ok: false, error: "channel_not_found" } }]);
    const r2 = await getConnector("slack").pushClosedDeal(ctx({ channelId: "C1" }), deal);
    if (!r2.ok) expect(r2.retryable).toBe(false);
  });

  it("fails fast with no channel configured", async () => {
    const res = await getConnector("slack").pushClosedDeal(ctx({}), deal);
    expect(res.ok).toBe(false);
  });
});

describe("HubSpot adapter", () => {
  it("creates a contact then an associated deal", async () => {
    const calls = mockFetch([
      { json: { id: "contact-1" } }, // create contact
      { json: { id: "deal-9" } }, // create deal
    ]);
    const res = await getConnector("hubspot").pushClosedDeal(
      ctx({ pipelineId: "p1", stageId: "won" }),
      deal
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalRef).toBe("deal-9");
    expect(calls[0]!.url).toContain("/crm/v3/objects/contacts");
    expect(calls[1]!.url).toContain("/crm/v3/objects/deals");
    const dealBody = JSON.parse(String(calls[1]!.init.body));
    expect(dealBody.properties.amount).toBe("1200");
    expect(dealBody.properties.dealstage).toBe("won");
  });

  it("recovers a duplicate contact via search (409)", async () => {
    const calls = mockFetch([
      { ok: false, status: 409, json: {} }, // contact exists
      { json: { results: [{ id: "existing-contact" }] } }, // search
      { json: { id: "deal-10" } }, // deal
    ]);
    const res = await getConnector("hubspot").pushClosedDeal(ctx({ stageId: "won" }), deal);
    expect(res.ok).toBe(true);
    expect(calls[1]!.url).toContain("/contacts/search");
  });

  it("writes a journey note after the deal when context rides the payload — and never fails the push on a note error", async () => {
    const calls = mockFetch([
      { json: { id: "contact-1" } }, // create contact
      { json: { id: "deal-9" } }, // create deal
      { ok: false, status: 403, json: {} }, // note rejected (missing scope) — swallowed
    ]);
    const res = await getConnector("hubspot").pushClosedDeal(ctx({ stageId: "won" }), {
      ...deal,
      context: { score: 91, whyNow: "Raised a Series B", origin: "intent" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalRef).toBe("deal-9");
    expect(calls[2]!.url).toContain("/crm/v3/objects/notes");
    const note = JSON.parse(String(calls[2]!.init.body));
    expect(note.properties.hs_note_body).toContain("fit score 91");
    expect(note.properties.hs_note_body).toContain("Raised a Series B");
    expect(note.associations[0].to.id).toBe("contact-1");
    expect(note.associations[0].types[0].associationTypeId).toBe(202);
  });

  it("skips the note entirely when the payload carries no context", async () => {
    const calls = mockFetch([{ json: { id: "contact-1" } }, { json: { id: "deal-9" } }]);
    await getConnector("hubspot").pushClosedDeal(ctx({ stageId: "won" }), deal);
    expect(calls).toHaveLength(2);
  });

  it("ensureContact finds an existing contact by email before creating", async () => {
    const calls = mockFetch([{ json: { results: [{ id: "c-77" }] } }]);
    const res = await getConnector("hubspot").ensureContact!(ctx({}), {
      firstName: "Ada",
      email: "ada@analytical.io",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.contactId).toBe("c-77");
    expect(calls[0]!.url).toContain("/contacts/search");
  });

  it("ensureContact creates the contact when the search misses", async () => {
    const calls = mockFetch([
      { json: { results: [] } }, // search miss
      { json: { id: "c-new" } }, // create
    ]);
    const res = await getConnector("hubspot").ensureContact!(ctx({}), {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@analytical.io",
      company: "Analytical",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.contactId).toBe("c-new");
    const body = JSON.parse(String(calls[1]!.init.body));
    expect(body.properties.email).toBe("ada@analytical.io");
    expect(body.properties.company).toBe("Analytical");
  });

  it("ensureContact creates directly when the lead has no email (our stored ref dedupes after)", async () => {
    const calls = mockFetch([{ json: { id: "c-no-email" } }]);
    const res = await getConnector("hubspot").ensureContact!(ctx({}), { firstName: "Ada" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.contactId).toBe("c-no-email");
    expect(calls[0]!.url).toContain("/crm/v3/objects/contacts");
    expect(calls[0]!.url).not.toContain("search");
  });

  it("logActivity posts a note associated to the contact (typeId 202) and maps 5xx/429 to retryable", async () => {
    const calls = mockFetch([{ json: { id: "note-1" } }]);
    const res = await getConnector("hubspot").logActivity!(ctx({}), {
      contactId: "c-77",
      body: "LinkedIn reply from Ada",
      occurredAt: "2026-07-01T12:00:00.000Z",
    });
    expect(res.ok).toBe(true);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.properties.hs_note_body).toBe("LinkedIn reply from Ada");
    expect(body.properties.hs_timestamp).toBe("2026-07-01T12:00:00.000Z");
    expect(body.associations[0].to.id).toBe("c-77");

    mockFetch([{ ok: false, status: 429, json: {} }]);
    const limited = await getConnector("hubspot").logActivity!(ctx({}), {
      contactId: "c-77",
      body: "x",
      occurredAt: "2026-07-01T12:00:00.000Z",
    });
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.retryable).toBe(true);
  });

  it("declares activity-sync support in the registry (scope + flag)", async () => {
    const meta = getConnector("hubspot").meta;
    expect(meta.supportsActivitySync).toBe(true);
    expect(meta.oauthScopes).toContain("crm.objects.notes.write");
  });
});

describe("Monday adapter", () => {
  it("creates a board item via GraphQL", async () => {
    const calls = mockFetch([{ json: { data: { create_item: { id: "item-5" } } } }]);
    const res = await getConnector("monday").pushClosedDeal(ctx({ boardId: "999" }), deal);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalRef).toBe("item-5");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.query).toContain("create_item");
    expect(body.variables.board).toBe("999");
  });
});

describe("Salesforce adapter", () => {
  it("needs an instance url (externalAccountRef)", async () => {
    const res = await getConnector("salesforce").pushClosedDeal(ctx({ stageId: "Closed Won" }), deal);
    expect(res.ok).toBe(false);
  });

  it("creates contact + opportunity against the instance url", async () => {
    const calls = mockFetch([
      { json: { id: "003xx" } }, // contact
      { json: { id: "006xx" } }, // opportunity
    ]);
    const res = await getConnector("salesforce").pushClosedDeal(
      ctx({ stageId: "Closed Won" }, "https://x.my.salesforce.com"),
      deal
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalRef).toBe("006xx");
    expect(calls[0]!.url).toBe("https://x.my.salesforce.com/services/data/v59.0/sobjects/Contact");
    expect(calls[1]!.url).toContain("/sobjects/Opportunity");
  });
});

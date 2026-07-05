import type {
  ActivityLogInput,
  ClosedDeal,
  ConnectorCtx,
  ConnectorResult,
  ContactStub,
  CrmProvider,
  ProviderAdapter,
} from "./types";

// Per-provider push/health logic. Vendor API specifics live ONLY here (rule 13). Written to
// each provider's documented contract; each needs a live smoke test against a real account
// once OAuth credentials exist, but the request shapes + error handling are locked by tests.

type Json = Record<string, unknown>;

async function http(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; json: Json }> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, json };
}

// 5xx / 429 are transient (retry); other 4xx are terminal (bad config, revoked token).
function failFromStatus<T>(status: number, message: string): ConnectorResult<T> {
  return { ok: false, error: message, retryable: status >= 500 || status === 429 };
}

function fullName(deal: ClosedDeal): string {
  return (
    [deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(" ") ||
    deal.contact.company ||
    deal.contact.email ||
    "New customer"
  );
}

function dollars(deal: ClosedDeal): number {
  return Math.round(deal.dealValueCents) / 100;
}

function dealMessage(deal: ClosedDeal): string {
  const value = dollars(deal).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const company = deal.contact.company ? ` (${deal.contact.company})` : "";
  return `Deal closed — ${fullName(deal)}${company}: ${value}`;
}

function dealName(deal: ClosedDeal): string {
  return `${deal.contact.company || fullName(deal)} — won`;
}

// ── Slack (notify) ──────────────────────────────────────────────────────────────
const slack: ProviderAdapter = {
  async pushClosedDeal(ctx, deal) {
    const channel = ctx.config.target?.channelId;
    if (!channel) return { ok: false, error: "No Slack channel configured.", retryable: false };
    const { ok, status, json } = await http("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text: dealMessage(deal) }),
    });
    if (!ok) return failFromStatus(status, `Slack request failed (${status}).`);
    if (json.ok !== true) {
      const err = String(json.error ?? "unknown");
      return { ok: false, error: `Slack: ${err}`, retryable: err === "ratelimited" };
    }
    return { ok: true, data: { externalRef: json.ts as string | undefined } };
  },
  async testConnection(ctx) {
    const { ok, status, json } = await http("https://slack.com/api/auth.test", {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    });
    if (!ok) return failFromStatus(status, `Slack unreachable (${status}).`);
    if (json.ok !== true) return { ok: false, error: `Slack: ${json.error}`, retryable: false };
    return { ok: true, data: { detail: `Connected to ${json.team ?? "Slack"}` } };
  },
};

// ── Monday (notify) ─────────────────────────────────────────────────────────────
const monday: ProviderAdapter = {
  async pushClosedDeal(ctx, deal) {
    const board = ctx.config.target?.boardId;
    if (!board) return { ok: false, error: "No Monday board configured.", retryable: false };
    const query =
      "mutation ($board: ID!, $name: String!) { create_item (board_id: $board, item_name: $name) { id } }";
    const { ok, status, json } = await http("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: ctx.accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { board, name: dealMessage(deal) } }),
    });
    if (!ok) return failFromStatus(status, `Monday request failed (${status}).`);
    if (json.errors) return { ok: false, error: "Monday rejected the item.", retryable: false };
    const data = json.data as { create_item?: { id?: string } } | undefined;
    return { ok: true, data: { externalRef: data?.create_item?.id } };
  },
  async testConnection(ctx) {
    const { ok, status, json } = await http("https://api.monday.com/v2", {
      method: "POST",
      headers: { Authorization: ctx.accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ me { id } }" }),
    });
    if (!ok) return failFromStatus(status, `Monday unreachable (${status}).`);
    if (json.errors) return { ok: false, error: "Monday token rejected.", retryable: false };
    return { ok: true, data: { detail: "Connected to Monday" } };
  },
};

// ── HubSpot (crm) ───────────────────────────────────────────────────────────────
const HS = "https://api.hubapi.com";

function hsHeaders(ctx: ConnectorCtx) {
  return { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" };
}

async function hsSearchContactByEmail(
  headers: Record<string, string>,
  email: string
): Promise<{ ok: boolean; status: number; contactId?: string }> {
  const search = await http(`${HS}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
    }),
  });
  const results = search.json.results as Array<{ id?: string }> | undefined;
  return { ok: search.ok, status: search.status, contactId: results?.[0]?.id };
}

// The journey note (why-now, fit score, origin) written at push time. Rendered here so the
// wording lives with the wire call; the payload stays provider-agnostic.
function journeyNoteBody(deal: ClosedDeal): string | null {
  const c = deal.context;
  if (!c || (c.score == null && !c.whyNow && !c.origin)) return null;
  const lines = [`Closed via ${deal.source}${c.score != null ? ` — fit score ${c.score}` : ""}`];
  if (c.whyNow) lines.push(`Why now: ${c.whyNow}`);
  if (c.origin === "intent") lines.push("Origin: LinkedIn buying-intent signal");
  return lines.join("\n");
}

async function hsCreateNote(
  headers: Record<string, string>,
  input: ActivityLogInput
): Promise<{ ok: boolean; status: number; id?: string }> {
  const res = await http(`${HS}/crm/v3/objects/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: { hs_note_body: input.body, hs_timestamp: input.occurredAt },
      associations: [
        {
          to: { id: input.contactId },
          // HUBSPOT_DEFINED 202 = note → contact
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
      ],
    }),
  });
  return { ok: res.ok, status: res.status, id: res.json.id as string | undefined };
}

const hubspot: ProviderAdapter = {
  async pushClosedDeal(ctx, deal) {
    const headers = {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    };
    const m = ctx.config.mapping ?? {};
    const contactProps: Record<string, string> = {};
    const set = (src: string, fallback: string, val?: string) => {
      if (val) contactProps[m[src] ?? fallback] = val;
    };
    set("contact.email", "email", deal.contact.email);
    set("contact.firstName", "firstname", deal.contact.firstName);
    set("contact.lastName", "lastname", deal.contact.lastName);
    set("contact.company", "company", deal.contact.company);
    set("contact.title", "jobtitle", deal.contact.title);
    set("contact.phone", "phone", deal.contact.phone);

    // create contact; on 409 (already exists) search by email for the id
    let contactId: string | undefined;
    const created = await http("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ properties: contactProps }),
    });
    if (created.ok) {
      contactId = created.json.id as string | undefined;
    } else if (created.status === 409 && deal.contact.email) {
      const search = await http("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          filterGroups: [
            { filters: [{ propertyName: "email", operator: "EQ", value: deal.contact.email }] },
          ],
        }),
      });
      const results = search.json.results as Array<{ id?: string }> | undefined;
      contactId = results?.[0]?.id;
    } else {
      return failFromStatus(created.status, `HubSpot contact failed (${created.status}).`);
    }

    const dealProps: Record<string, string> = {
      dealname: dealName(deal),
      amount: String(dollars(deal)),
    };
    if (ctx.config.target?.pipelineId) dealProps.pipeline = ctx.config.target.pipelineId;
    if (ctx.config.target?.stageId) dealProps.dealstage = ctx.config.target.stageId;

    const dealRes = await http("https://api.hubapi.com/crm/v3/objects/deals", {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: dealProps,
        associations: contactId
          ? [
              {
                to: { id: contactId },
                types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
              },
            ]
          : undefined,
      }),
    });
    if (!dealRes.ok) return failFromStatus(dealRes.status, `HubSpot deal failed (${dealRes.status}).`);

    // Journey note (why-now, score, origin) — best-effort AFTER the deal exists. A note
    // failure must never fail the push: retrying now would duplicate the deal.
    const noteBody = journeyNoteBody(deal);
    if (noteBody && contactId) {
      await hsCreateNote(headers, {
        contactId,
        body: noteBody,
        occurredAt: deal.closedAt || new Date().toISOString(),
      }).catch(() => undefined);
    }

    return { ok: true, data: { externalRef: dealRes.json.id as string | undefined } };
  },
  async ensureContact(ctx, contact: ContactStub) {
    const headers = hsHeaders(ctx);
    // Email is the dedupe key when we have one; without it we create directly and rely on
    // the caller's stored ref for every later touch.
    if (contact.email) {
      const found = await hsSearchContactByEmail(headers, contact.email);
      if (!found.ok && (found.status >= 500 || found.status === 429)) {
        return failFromStatus(found.status, `HubSpot search failed (${found.status}).`);
      }
      if (found.contactId) return { ok: true, data: { contactId: found.contactId } };
    }
    const props: Record<string, string> = {};
    if (contact.email) props.email = contact.email;
    if (contact.firstName) props.firstname = contact.firstName;
    if (contact.lastName) props.lastname = contact.lastName;
    if (contact.title) props.jobtitle = contact.title;
    if (contact.company) props.company = contact.company;
    const created = await http(`${HS}/crm/v3/objects/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ properties: props }),
    });
    if (created.ok) {
      const id = created.json.id as string | undefined;
      if (id) return { ok: true, data: { contactId: id } };
      return { ok: false, error: "HubSpot returned no contact id.", retryable: true };
    }
    // 409 = created concurrently since our search — recover the existing id.
    if (created.status === 409 && contact.email) {
      const again = await hsSearchContactByEmail(headers, contact.email);
      if (again.contactId) return { ok: true, data: { contactId: again.contactId } };
    }
    return failFromStatus(created.status, `HubSpot contact failed (${created.status}).`);
  },
  async logActivity(ctx, input) {
    const res = await hsCreateNote(hsHeaders(ctx), input);
    if (!res.ok) return failFromStatus(res.status, `HubSpot note failed (${res.status}).`);
    return { ok: true, data: { externalRef: res.id } };
  },
  async testConnection(ctx) {
    const { ok, status } = await http(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } }
    );
    if (!ok) return failFromStatus(status, `HubSpot unreachable (${status}).`);
    return { ok: true, data: { detail: "Connected to HubSpot" } };
  },
};

// ── Salesforce (crm) ────────────────────────────────────────────────────────────
const SF_API = "v59.0";
const salesforce: ProviderAdapter = {
  async pushClosedDeal(ctx, deal) {
    const base = ctx.externalAccountRef; // instance_url from token exchange
    if (!base) return { ok: false, error: "Salesforce instance missing — reconnect.", retryable: false };
    const headers = {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    };
    const contact = await http(`${base}/services/data/${SF_API}/sobjects/Contact`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Email: deal.contact.email,
        FirstName: deal.contact.firstName,
        LastName: deal.contact.lastName || deal.contact.company || deal.contact.email || "Unknown",
      }),
    });
    if (!contact.ok && contact.status >= 500) {
      return failFromStatus(contact.status, `Salesforce contact failed (${contact.status}).`);
    }
    const opp = await http(`${base}/services/data/${SF_API}/sobjects/Opportunity`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Name: dealName(deal),
        Amount: dollars(deal),
        StageName: ctx.config.target?.stageId || "Closed Won",
        CloseDate: (deal.closedAt || new Date().toISOString()).slice(0, 10),
      }),
    });
    if (!opp.ok) return failFromStatus(opp.status, `Salesforce opportunity failed (${opp.status}).`);
    return { ok: true, data: { externalRef: opp.json.id as string | undefined } };
  },
  async testConnection(ctx) {
    const base = ctx.externalAccountRef;
    if (!base) return { ok: false, error: "Salesforce instance missing — reconnect.", retryable: false };
    const { ok, status } = await http(`${base}/services/data/`, {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    });
    if (!ok) return failFromStatus(status, `Salesforce unreachable (${status}).`);
    return { ok: true, data: { detail: "Connected to Salesforce" } };
  },
};

// ── GoHighLevel (crm) ───────────────────────────────────────────────────────────
const GHL = "https://services.leadconnectorhq.com";
const GHL_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
});
const gohighlevel: ProviderAdapter = {
  async pushClosedDeal(ctx, deal) {
    const locationId = ctx.externalAccountRef;
    const headers = GHL_HEADERS(ctx.accessToken);
    const contact = await http(`${GHL}/contacts/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: deal.contact.email,
        firstName: deal.contact.firstName,
        lastName: deal.contact.lastName,
        companyName: deal.contact.company,
        locationId,
      }),
    });
    if (!contact.ok && contact.status >= 500) {
      return failFromStatus(contact.status, `GoHighLevel contact failed (${contact.status}).`);
    }
    const pipelineId = ctx.config.target?.pipelineId;
    if (!pipelineId) return { ok: false, error: "No GoHighLevel pipeline configured.", retryable: false };
    const opp = await http(`${GHL}/opportunities/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        pipelineId,
        pipelineStageId: ctx.config.target?.stageId,
        locationId,
        name: dealName(deal),
        monetaryValue: dollars(deal),
        status: "won",
      }),
    });
    if (!opp.ok) return failFromStatus(opp.status, `GoHighLevel opportunity failed (${opp.status}).`);
    const body = opp.json as { opportunity?: { id?: string }; id?: string };
    return { ok: true, data: { externalRef: body.opportunity?.id ?? body.id } };
  },
  async testConnection(ctx) {
    const locationId = ctx.externalAccountRef;
    const { ok, status } = await http(`${GHL}/locations/${locationId ?? ""}`, {
      headers: GHL_HEADERS(ctx.accessToken),
    });
    if (!ok) return failFromStatus(status, `GoHighLevel unreachable (${status}).`);
    return { ok: true, data: { detail: "Connected to GoHighLevel" } };
  },
};

export const ADAPTERS: Record<CrmProvider, ProviderAdapter> = {
  slack,
  monday,
  hubspot,
  salesforce,
  gohighlevel,
};

// re-export so the pipeline can type the ctx it builds
export type { ConnectorCtx };

import type {
  ConnectorMeta,
  CrmConnector,
  CrmProvider,
  FieldDescriptor,
} from "./types";
import { ADAPTERS } from "./adapters";
import { exchangeAuthCode, refreshAccessToken, type OAuthCreds } from "./oauth";

export * from "./types";
export * from "./crypto";
export * from "./oauth";
export { InMemoryConnector } from "./in-memory";

// Fields a true-CRM destination maps from a ClosedDeal (contact + deal shape).
const CRM_FIELDS: FieldDescriptor[] = [
  { source: "contact.email", label: "Email", defaultTarget: "email", locked: true },
  { source: "contact.firstName", label: "First name", defaultTarget: "firstname" },
  { source: "contact.lastName", label: "Last name", defaultTarget: "lastname" },
  { source: "contact.company", label: "Company", defaultTarget: "company" },
  { source: "contact.title", label: "Job title", defaultTarget: "jobtitle" },
  { source: "contact.phone", label: "Phone", defaultTarget: "phone" },
  { source: "dealValueCents", label: "Deal value", defaultTarget: "amount" },
];

function defaultMappingFrom(fields: FieldDescriptor[]) {
  return Object.fromEntries(fields.map((f) => [f.source, f.defaultTarget]));
}

// The single source the integrations UI renders from. Authorize endpoints + scopes are
// the real provider values, so the moment OAuth client credentials exist the connect
// flow works end to end (no code change). Wire/token details live in each adapter file.
export const CONNECTOR_REGISTRY: Record<CrmProvider, ConnectorMeta> = {
  hubspot: {
    provider: "hubspot",
    kind: "crm",
    label: "HubSpot",
    blurb: "Creates the contact and a won deal in your HubSpot pipeline on close.",
    // notes.write powers activity sync (timeline notes). Connections authorized before it
    // was added need a one-click reconnect to grant it.
    oauthScopes: [
      "oauth",
      "crm.objects.contacts.write",
      "crm.objects.deals.write",
      "crm.objects.notes.write",
    ],
    authorizeEndpoint: "https://app.hubspot.com/oauth/authorize",
    tokenEndpoint: "https://api.hubapi.com/oauth/v1/token",
    apiBase: "https://api.hubapi.com",
    defaultMapping: defaultMappingFrom(CRM_FIELDS),
    fields: CRM_FIELDS,
    targets: [
      { key: "pipelineId", label: "Deal pipeline", required: true },
      { key: "stageId", label: "Won stage", required: true },
    ],
    supportsActivitySync: true,
  },
  salesforce: {
    provider: "salesforce",
    kind: "crm",
    label: "Salesforce",
    blurb: "Upserts the contact and creates a closed-won opportunity in Salesforce.",
    oauthScopes: ["api", "refresh_token"],
    authorizeEndpoint: "https://login.salesforce.com/services/oauth2/authorize",
    tokenEndpoint: "https://login.salesforce.com/services/oauth2/token",
    // overridden per-connection by the instance_url returned at token exchange
    apiBase: "https://login.salesforce.com",
    defaultMapping: defaultMappingFrom(CRM_FIELDS),
    fields: CRM_FIELDS,
    targets: [
      { key: "pipelineId", label: "Opportunity record type", required: false },
      { key: "stageId", label: "Closed-won stage", required: true },
    ],
  },
  gohighlevel: {
    provider: "gohighlevel",
    kind: "crm",
    label: "GoHighLevel",
    blurb: "Adds the contact and a won opportunity to your GoHighLevel location.",
    oauthScopes: ["contacts.write", "opportunities.write"],
    authorizeEndpoint: "https://marketplace.gohighlevel.com/oauth/chooselocation",
    tokenEndpoint: "https://services.leadconnectorhq.com/oauth/token",
    apiBase: "https://services.leadconnectorhq.com",
    defaultMapping: defaultMappingFrom(CRM_FIELDS),
    fields: CRM_FIELDS,
    targets: [
      { key: "pipelineId", label: "Pipeline", required: true },
      { key: "stageId", label: "Won stage", required: true },
    ],
  },
  slack: {
    provider: "slack",
    kind: "notify",
    label: "Slack",
    blurb: "Posts a “deal closed” message to a channel the moment a deal is won.",
    oauthScopes: ["chat:write", "channels:read"],
    authorizeEndpoint: "https://slack.com/oauth/v2/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.access",
    apiBase: "https://slack.com/api",
    defaultMapping: {},
    fields: [],
    targets: [{ key: "channelId", label: "Channel", required: true }],
  },
  monday: {
    provider: "monday",
    kind: "notify",
    label: "Monday",
    blurb: "Creates an item with the deal details on a board you choose.",
    oauthScopes: ["boards:write", "me:read"],
    authorizeEndpoint: "https://auth.monday.com/oauth2/authorize",
    tokenEndpoint: "https://auth.monday.com/oauth2/token",
    apiBase: "https://api.monday.com/v2",
    defaultMapping: {},
    fields: [],
    targets: [{ key: "boardId", label: "Board", required: true }],
  },
};

const ALL_PROVIDERS = Object.keys(CONNECTOR_REGISTRY) as CrmProvider[];

export function isCrmProvider(value: string): value is CrmProvider {
  return (ALL_PROVIDERS as string[]).includes(value);
}

export function listConnectors(): ConnectorMeta[] {
  return ALL_PROVIDERS.map((p) => CONNECTOR_REGISTRY[p]);
}

export function getConnectorMeta(provider: string): ConnectorMeta | undefined {
  return isCrmProvider(provider) ? CONNECTOR_REGISTRY[provider] : undefined;
}

// Per-provider OAuth client credentials from env. Lazy — only the token-exchange paths
// need them, so a connector can still push/test with an existing access token when the
// client secret isn't in this runtime.
function envCreds(provider: CrmProvider): OAuthCreds {
  const clientId = process.env[`CRM_${provider.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`CRM_${provider.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`CRM_${provider.toUpperCase()}_CLIENT_ID/SECRET is not configured.`);
  }
  return { clientId, clientSecret };
}

export function isOAuthConfigured(provider: string): boolean {
  return isCrmProvider(provider) && !!process.env[`CRM_${provider.toUpperCase()}_CLIENT_ID`];
}

// The real connector: generic OAuth (authorize/exchange/refresh) + the per-provider push/health
// adapter. `creds` is injectable for tests; defaults to env.
export function getConnector(provider: CrmProvider, creds?: OAuthCreds): CrmConnector {
  const meta = CONNECTOR_REGISTRY[provider];
  const adapter = ADAPTERS[provider];
  return {
    provider,
    kind: meta.kind,
    meta,
    getAuthorizeUrl: (input) =>
      buildAuthorizeUrl({ provider, ...input }) ?? meta.authorizeEndpoint,
    exchangeCode: (code, redirectUri) =>
      exchangeAuthCode(meta, creds ?? envCreds(provider), code, redirectUri),
    refreshToken: (rt) => refreshAccessToken(meta, creds ?? envCreds(provider), rt),
    testConnection: (ctx) => adapter.testConnection(ctx),
    pushClosedDeal: (ctx, deal) => adapter.pushClosedDeal(ctx, deal),
    // activity-sync pair — present only when the adapter implements it (HubSpot today)
    ensureContact: adapter.ensureContact
      ? (ctx, contact) => adapter.ensureContact!(ctx, contact)
      : undefined,
    logActivity: adapter.logActivity
      ? (ctx, input) => adapter.logActivity!(ctx, input)
      : undefined,
  };
}

// Builds the provider authorize URL from registry metadata + per-account params.
// Returns null when the provider is unknown — callers surface "unsupported destination".
export function buildAuthorizeUrl(input: {
  provider: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string | null {
  const meta = getConnectorMeta(input.provider);
  if (!meta) return null;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: meta.oauthScopes.join(" "),
    state: input.state,
  });
  return `${meta.authorizeEndpoint}?${params.toString()}`;
}

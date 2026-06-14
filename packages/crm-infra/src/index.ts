import type {
  ConnectorMeta,
  CrmProvider,
  FieldDescriptor,
} from "./types";

export * from "./types";
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
    oauthScopes: ["oauth", "crm.objects.contacts.write", "crm.objects.deals.write"],
    authorizeEndpoint: "https://app.hubspot.com/oauth/authorize",
    defaultMapping: defaultMappingFrom(CRM_FIELDS),
    fields: CRM_FIELDS,
    targets: [
      { key: "pipelineId", label: "Deal pipeline", required: true },
      { key: "stageId", label: "Won stage", required: true },
    ],
  },
  salesforce: {
    provider: "salesforce",
    kind: "crm",
    label: "Salesforce",
    blurb: "Upserts the contact and creates a closed-won opportunity in Salesforce.",
    oauthScopes: ["api", "refresh_token"],
    authorizeEndpoint: "https://login.salesforce.com/services/oauth2/authorize",
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

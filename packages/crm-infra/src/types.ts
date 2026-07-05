// Provider-agnostic CRM push interface (Phase 9, rule 13). HubSpot / Salesforce /
// GoHighLevel / Slack / Monday are implementations behind it; their API specifics never
// leave this package. Unlike outreach vendors (rules 03–05), the destination NAMES are
// the customer's own tools and ARE shown to users — only the wire details stay hidden.

export type CrmProvider =
  | "hubspot"
  | "salesforce"
  | "gohighlevel"
  | "slack"
  | "monday";

// crm  -> upsert a contact + create a deal (true CRMs)
// notify -> post a message / create a board item (Slack, Monday)
export type ConnectorKind = "crm" | "notify";

// Field mapping: our normalized field -> the destination's field key.
export type FieldMapping = Record<string, string>;

// Describes one mappable field for the light-override mapping UI.
export interface FieldDescriptor {
  /** our normalized ClosedDeal key, e.g. "contact.email" */
  source: string;
  /** human label shown in the mapping editor */
  label: string;
  /** the destination field key it defaults to */
  defaultTarget: string;
  /** false = the user may remap; true = locked (e.g. the dedupe key) */
  locked?: boolean;
}

// One destination-specific target the user must pick after connecting:
// Slack -> channel, Monday -> board, true CRMs -> pipeline + stage.
export interface TargetField {
  key: string; // e.g. "channelId", "boardId", "pipelineId", "stageId"
  label: string; // e.g. "Slack channel"
  required: boolean;
}

// Static metadata for a destination — the single source the UI is rendered from.
export interface ConnectorMeta {
  provider: CrmProvider;
  kind: ConnectorKind;
  /** user-facing name (the customer's own tool — allowed, rule 09 exception) */
  label: string;
  /** one-line description of what a push does for this destination */
  blurb: string;
  /** OAuth scopes requested at authorize time */
  oauthScopes: string[];
  /** provider authorize endpoint (the OAuth dialog the user is sent to) */
  authorizeEndpoint: string;
  /** OAuth token endpoint (code→token exchange + refresh) */
  tokenEndpoint: string;
  /** API base for push calls (Salesforce overrides this per-connection with instance_url) */
  apiBase: string;
  /** smart defaults pre-filled in the mapping editor */
  defaultMapping: FieldMapping;
  /** fields the user may remap */
  fields: FieldDescriptor[];
  /** destination target the user picks post-connect */
  targets: TargetField[];
  /** the destination can log LinkedIn touches onto a contact timeline (activity sync) */
  supportsActivitySync?: boolean;
}

// Normalized, provider-agnostic closed-won payload. No DB or vendor types leak in.
export interface ClosedDeal {
  leadId: string;
  contact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    title?: string;
    company?: string;
    domain?: string;
  };
  dealValueCents: number;
  closedAt: string; // ISO
  source: string; // label, e.g. "Vantera"
  /** journey context written to the destination as a note alongside the push (score, why-now,
   *  origin). Optional; a note failure never fails the push — the deal is already created. */
  context?: {
    score?: number | null;
    whyNow?: string | null;
    /** where the lead entered the funnel, e.g. "intent" */
    origin?: string | null;
  };
  config: {
    mapping?: FieldMapping;
    target?: Record<string, string>;
  };
}

// A pre-close contact stub for activity sync — just enough to find-or-create the person in
// the destination before any deal exists.
export interface ContactStub {
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
}

// One LinkedIn touch rendered for the destination's timeline (activity sync). The body is
// pre-rendered by the pipeline so adapters stay dumb pipes.
export interface ActivityLogInput {
  contactId: string;
  body: string;
  occurredAt: string; // ISO
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO
  // provider-specific account handle returned at exchange (Salesforce instance_url,
  // Slack team id, etc.) — persisted as crm_connections.external_account_ref
  externalAccountRef?: string;
}

// Per-provider push/health logic. OAuth (authorize/exchange/refresh) is generic across
// providers and lives in the factory; only these differ per destination.
export interface ProviderAdapter {
  pushClosedDeal(
    ctx: ConnectorCtx,
    deal: ClosedDeal
  ): Promise<ConnectorResult<{ externalRef?: string }>>;
  testConnection(ctx: ConnectorCtx): Promise<ConnectorResult<{ detail?: string }>>;
  /** find-or-create a contact pre-close (activity sync). Optional — HubSpot-only today. */
  ensureContact?(
    ctx: ConnectorCtx,
    contact: ContactStub
  ): Promise<ConnectorResult<{ contactId: string }>>;
  /** append one rendered touch to the contact's timeline (activity sync). Optional. */
  logActivity?(
    ctx: ConnectorCtx,
    input: ActivityLogInput
  ): Promise<ConnectorResult<{ externalRef?: string }>>;
}

export interface ConnectorCtx {
  accessToken: string;
  externalAccountRef?: string | null;
  config: ClosedDeal["config"];
}

export type ConnectorResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean };

// Read-back of a contact already in the customer's CRM — powers the dedup gate (report #10:
// don't cold-outreach someone who's already a customer or in an open deal — the "janitor effect").
export interface CrmContactLookup {
  exists: boolean;
  /** the CRM's lifecycle stage, normalized lowercase where possible (e.g. "customer", "lead") */
  lifecycleStage?: string | null;
  /** an open/active deal or opportunity is associated with this contact */
  openDeal?: boolean;
  lastActivityAt?: string | null;
}

// The one push interface. CRM adapters create a contact + deal; notify adapters post a
// message / item — two implementations, never two interfaces.
export interface CrmConnector {
  provider: CrmProvider;
  kind: ConnectorKind;
  meta: ConnectorMeta;
  // OAuth
  getAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  // health
  testConnection(ctx: ConnectorCtx): Promise<ConnectorResult<{ detail?: string }>>;
  // the single push entrypoint
  pushClosedDeal(
    ctx: ConnectorCtx,
    deal: ClosedDeal
  ): Promise<ConnectorResult<{ externalRef?: string }>>;
  // optional: live target fields for the mapping UI
  describeFields?(ctx: ConnectorCtx): Promise<FieldDescriptor[]>;
  // optional read-back for the dedup gate: does this contact already exist in the CRM, and how?
  findContact?(
    ctx: ConnectorCtx,
    query: { email?: string; domain?: string }
  ): Promise<ConnectorResult<CrmContactLookup>>;
  // optional activity-sync pair (present when the destination supports timeline logging)
  ensureContact?(
    ctx: ConnectorCtx,
    contact: ContactStub
  ): Promise<ConnectorResult<{ contactId: string }>>;
  logActivity?(
    ctx: ConnectorCtx,
    input: ActivityLogInput
  ): Promise<ConnectorResult<{ externalRef?: string }>>;
}

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
  /** smart defaults pre-filled in the mapping editor */
  defaultMapping: FieldMapping;
  /** fields the user may remap */
  fields: FieldDescriptor[];
  /** destination target the user picks post-connect */
  targets: TargetField[];
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
  config: {
    mapping?: FieldMapping;
    target?: Record<string, string>;
  };
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO
}

export interface ConnectorCtx {
  accessToken: string;
  externalAccountRef?: string | null;
  config: ClosedDeal["config"];
}

export type ConnectorResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean };

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
}

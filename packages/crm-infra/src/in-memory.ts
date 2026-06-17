import { CONNECTOR_REGISTRY } from "./index";
import type {
  ClosedDeal,
  ConnectorCtx,
  ConnectorResult,
  CrmConnector,
  CrmContactLookup,
  CrmProvider,
  TokenSet,
} from "./types";

// Deterministic fake connector for pipeline + UI tests. Records pushed deals; never
// touches the network. `failNext` flips the next push/test to a (retryable) failure so
// tests can exercise the error + retry paths the real adapters will use.
export class InMemoryConnector implements CrmConnector {
  readonly provider: CrmProvider;
  readonly kind: CrmConnector["kind"];
  readonly meta: CrmConnector["meta"];
  readonly pushed: ClosedDeal[] = [];
  /** Seed by email/domain (lowercased) for findContact in dedup tests. */
  contacts: Record<string, CrmContactLookup> = {};
  failNext = false;

  constructor(provider: CrmProvider = "hubspot") {
    this.provider = provider;
    this.meta = CONNECTOR_REGISTRY[provider];
    this.kind = this.meta.kind;
  }

  getAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      scope: this.meta.oauthScopes.join(" "),
      state: input.state,
    });
    return `${this.meta.authorizeEndpoint}?${params.toString()}`;
  }

  async exchangeCode(code: string, _redirectUri?: string): Promise<TokenSet> {
    return { accessToken: `fake-access-${code}`, refreshToken: `fake-refresh-${code}` };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    return { accessToken: `fake-access-from-${refreshToken}`, refreshToken };
  }

  async testConnection(_ctx: ConnectorCtx): Promise<ConnectorResult<{ detail?: string }>> {
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, error: "Connection check failed", retryable: true };
    }
    return { ok: true, data: { detail: `${this.meta.label} reachable` } };
  }

  async pushClosedDeal(
    _ctx: ConnectorCtx,
    deal: ClosedDeal
  ): Promise<ConnectorResult<{ externalRef?: string }>> {
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, error: "Push failed", retryable: true };
    }
    this.pushed.push(deal);
    return { ok: true, data: { externalRef: `fake-ref-${this.pushed.length}` } };
  }

  async findContact(
    _ctx: ConnectorCtx,
    query: { email?: string; domain?: string }
  ): Promise<ConnectorResult<CrmContactLookup>> {
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, error: "Lookup failed", retryable: true };
    }
    const key = (query.email ?? query.domain ?? "").toLowerCase();
    return { ok: true, data: this.contacts[key] ?? { exists: false } };
  }
}

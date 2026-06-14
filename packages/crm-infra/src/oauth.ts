import type { ConnectorMeta, TokenSet } from "./types";

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
}

// Standard OAuth2 token shapes across providers. Salesforce adds instance_url; GoHighLevel
// adds locationId; Slack nests a team object. We capture whichever applies as
// externalAccountRef so the push adapter can target the right account/instance.
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  instance_url?: string;
  locationId?: string;
  team?: { id?: string };
  error?: string;
  ok?: boolean;
}

function tokenSetFrom(json: TokenResponse): TokenSet {
  if (!json.access_token) {
    throw new Error("OAuth response had no access_token");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : undefined,
    externalAccountRef: json.instance_url ?? json.locationId ?? json.team?.id,
  };
}

async function postToken(
  meta: ConnectorMeta,
  params: Record<string, string>
): Promise<TokenSet> {
  const res = await fetch(meta.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  // Slack signals failure with ok:false rather than a non-2xx status.
  if (!res.ok || json.error || json.ok === false) {
    throw new Error(`OAuth token request to ${meta.label} failed: ${json.error ?? res.status}`);
  }
  return tokenSetFrom(json);
}

export function exchangeAuthCode(
  meta: ConnectorMeta,
  creds: OAuthCreds,
  code: string,
  redirectUri: string
): Promise<TokenSet> {
  return postToken(meta, {
    grant_type: "authorization_code",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(
  meta: ConnectorMeta,
  creds: OAuthCreds,
  refreshToken: string
): Promise<TokenSet> {
  return postToken(meta, {
    grant_type: "refresh_token",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
  });
}

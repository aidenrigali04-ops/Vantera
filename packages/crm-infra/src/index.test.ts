import { describe, expect, it } from "vitest";
import {
  CONNECTOR_REGISTRY,
  buildAuthorizeUrl,
  getConnectorMeta,
  isCrmProvider,
  listConnectors,
} from "./index";

describe("crm-infra registry", () => {
  it("exposes all five destinations across the two adapter shapes", () => {
    const metas = listConnectors();
    expect(metas).toHaveLength(5);
    expect(metas.filter((m) => m.kind === "crm").map((m) => m.provider).sort()).toEqual([
      "gohighlevel",
      "hubspot",
      "salesforce",
    ]);
    expect(metas.filter((m) => m.kind === "notify").map((m) => m.provider).sort()).toEqual([
      "monday",
      "slack",
    ]);
  });

  it("every connector has a label, scopes, an authorize endpoint, and at least one target", () => {
    for (const meta of listConnectors()) {
      expect(meta.label).toBeTruthy();
      expect(meta.oauthScopes.length).toBeGreaterThan(0);
      expect(meta.authorizeEndpoint).toMatch(/^https:\/\//);
      expect(meta.targets.length).toBeGreaterThan(0);
    }
  });

  it("crm connectors map the email field locked as the dedupe key", () => {
    for (const meta of listConnectors().filter((m) => m.kind === "crm")) {
      const email = meta.fields.find((f) => f.source === "contact.email");
      expect(email?.locked).toBe(true);
      expect(meta.defaultMapping["contact.email"]).toBe("email");
    }
  });

  it("isCrmProvider / getConnectorMeta guard unknown providers", () => {
    expect(isCrmProvider("hubspot")).toBe(true);
    expect(isCrmProvider("pipedrive")).toBe(false);
    expect(getConnectorMeta("pipedrive")).toBeUndefined();
    expect(getConnectorMeta("slack")).toBe(CONNECTOR_REGISTRY.slack);
  });

  it("buildAuthorizeUrl embeds client id, redirect, scope, and state", () => {
    const url = buildAuthorizeUrl({
      provider: "hubspot",
      clientId: "cid-123",
      redirectUri: "https://app.vantera/api/crm/hubspot/callback",
      state: "state-abc",
    });
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe("https://app.hubspot.com/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("cid-123");
    expect(parsed.searchParams.get("state")).toBe("state-abc");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.vantera/api/crm/hubspot/callback"
    );
    expect(parsed.searchParams.get("scope")).toContain("crm.objects.deals.write");
  });

  it("buildAuthorizeUrl returns null for an unknown provider", () => {
    expect(
      buildAuthorizeUrl({
        provider: "pipedrive",
        clientId: "x",
        redirectUri: "y",
        state: "z",
      })
    ).toBeNull();
  });
});

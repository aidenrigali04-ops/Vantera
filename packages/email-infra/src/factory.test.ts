import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailInfraFromEnv } from "./index";
import { SmartleadEmailInfra } from "./smartlead";
import { OwnedEmailInfra } from "./owned/index";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs(); });

describe("createEmailInfraFromEnv", () => {
  it("returns SmartleadEmailInfra when EMAIL_PROVIDER is smartlead (default)", () => {
    vi.stubEnv("EMAIL_PROVIDER", "smartlead");
    vi.stubEnv("SMARTLEAD_API_KEY", "k");
    vi.stubEnv("SMARTLEAD_WEBHOOK_SECRET", "s");
    expect(createEmailInfraFromEnv()).toBeInstanceOf(SmartleadEmailInfra);
  });

  it("returns OwnedEmailInfra when EMAIL_PROVIDER is owned", () => {
    vi.stubEnv("EMAIL_PROVIDER", "owned");
    vi.stubEnv("OWNED_EMAIL_WEBHOOK_SECRET", "s");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "t");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a");
    vi.stubEnv("WARMUP_API_KEY", "w");
    vi.stubEnv("GOOGLE_WORKSPACE_TENANT_LABEL", "t1");
    expect(createEmailInfraFromEnv()).toBeInstanceOf(OwnedEmailInfra);
  });
});

import { describe, expect, it, vi } from "vitest";
import { runSetupWebhooks } from "./setup-webhooks";

const okResult = (url: string) => ({
  requestUrl: url,
  secretConfigured: true,
  existing: 0,
  existingHooks: [],
  deleted: 0,
  created: [],
});

const infra = () => ({
  setupWebhook: vi.fn(async (url: string) => okResult(url)),
  probeWebhook: vi.fn(async (_url: string) => ({ status: 200, verified: true })),
});

describe("runSetupWebhooks", () => {
  it("builds the route URL from APP_URL, forcing https (http→https) and stripping trailing slash", async () => {
    const linkedinInfra = infra();
    // APP_URL is http:// in the runtime env — a Vercel http webhook never delivers, so it must upgrade.
    const res = await runSetupWebhooks({ linkedinInfra, appUrl: "http://vanterasystem.dev/" });
    expect(linkedinInfra.setupWebhook).toHaveBeenCalledWith("https://vanterasystem.dev/api/webhooks/linkedin");
    expect(res.requestUrl).toBe("https://vanterasystem.dev/api/webhooks/linkedin");
  });

  it("self-tests the route with the secret and returns the probe result", async () => {
    const linkedinInfra = infra();
    const res = await runSetupWebhooks({ linkedinInfra, appUrl: "https://vanterasystem.dev" });
    expect(linkedinInfra.probeWebhook).toHaveBeenCalledWith("https://vanterasystem.dev/api/webhooks/linkedin");
    expect(res.probe).toEqual({ status: 200, verified: true });
  });

  it("refuses a missing or localhost APP_URL so a bad webhook URL is never registered", async () => {
    const linkedinInfra = infra();
    await expect(runSetupWebhooks({ linkedinInfra, appUrl: "http://localhost:3000" })).rejects.toThrow(/APP_URL/);
    await expect(runSetupWebhooks({ linkedinInfra, appUrl: "" })).rejects.toThrow(/APP_URL/);
    expect(linkedinInfra.setupWebhook).not.toHaveBeenCalled();
  });
});

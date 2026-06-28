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

describe("runSetupWebhooks", () => {
  it("builds the route URL from APP_URL (trailing slash stripped) and delegates to the adapter", async () => {
    const setupWebhook = vi.fn(async (url: string) => okResult(url));
    const res = await runSetupWebhooks({ linkedinInfra: { setupWebhook }, appUrl: "https://vanterasystem.dev/" });
    expect(setupWebhook).toHaveBeenCalledWith("https://vanterasystem.dev/api/webhooks/linkedin");
    expect(res.requestUrl).toBe("https://vanterasystem.dev/api/webhooks/linkedin");
  });

  it("refuses a missing or localhost APP_URL so a bad webhook URL is never registered", async () => {
    const setupWebhook = vi.fn(async (url: string) => okResult(url));
    await expect(
      runSetupWebhooks({ linkedinInfra: { setupWebhook }, appUrl: "http://localhost:3000" })
    ).rejects.toThrow(/APP_URL/);
    await expect(runSetupWebhooks({ linkedinInfra: { setupWebhook }, appUrl: "" })).rejects.toThrow(/APP_URL/);
    expect(setupWebhook).not.toHaveBeenCalled();
  });
});

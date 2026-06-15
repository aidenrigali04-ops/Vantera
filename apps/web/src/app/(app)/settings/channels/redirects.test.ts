import { describe, it, expect } from "vitest";
import { buildConnectRedirects } from "./redirects";

describe("buildConnectRedirects", () => {
  it("builds success and failure urls on the channels page", () => {
    expect(buildConnectRedirects("https://app.test")).toEqual({
      success: "https://app.test/settings/channels?connected=1",
      failure: "https://app.test/settings/channels?connected=failed",
    });
  });

  it("normalizes a trailing slash on the base url", () => {
    expect(buildConnectRedirects("https://app.test/").success).toBe(
      "https://app.test/settings/channels?connected=1",
    );
  });

  it("throws when the base url is empty", () => {
    expect(() => buildConnectRedirects("")).toThrow("APP_URL is not set");
  });
});

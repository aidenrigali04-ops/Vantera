import { describe, it, expect, vi, afterEach } from "vitest";
import { appBaseUrl, buildConnectRedirects } from "./redirects";

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
  vi.restoreAllMocks();
});

describe("appBaseUrl", () => {
  it("returns the origin, dropping any path or trailing slash", () => {
    expect(appBaseUrl("https://app.test/")).toBe("https://app.test");
    expect(appBaseUrl("https://app.test/some/path")).toBe("https://app.test");
  });

  it("upgrades http to https for a real host", () => {
    expect(appBaseUrl("http://app.test")).toBe("https://app.test");
  });

  it("keeps http for loopback so local dev can actually receive the return", () => {
    expect(appBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(appBaseUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  it("throws on an empty or malformed base url instead of silently building a broken return", () => {
    expect(() => appBaseUrl("")).toThrow("APP_URL is not set");
    expect(() => appBaseUrl(undefined)).toThrow("APP_URL is not set");
    expect(() => appBaseUrl("app.test")).toThrow(/valid absolute URL/);
  });
});

describe("buildConnectRedirects", () => {
  it("builds the success and failure return urls for a given path", () => {
    expect(buildConnectRedirects("https://app.test", "/settings/channels")).toEqual({
      success: "https://app.test/settings/channels?connected=1",
      failure: "https://app.test/settings/channels?connected=failed",
    });
    expect(buildConnectRedirects("https://app.test", "/onboarding")).toEqual({
      success: "https://app.test/onboarding?connected=1",
      failure: "https://app.test/onboarding?connected=failed",
    });
  });

  it("normalizes a trailing slash and upgrades the scheme", () => {
    expect(buildConnectRedirects("http://app.test/", "/onboarding").success).toBe(
      "https://app.test/onboarding?connected=1"
    );
  });

  it("throws when the base url is empty", () => {
    expect(() => buildConnectRedirects("", "/onboarding")).toThrow("APP_URL is not set");
  });

  // The return trip lands on APP_URL's host, but the session cookie was issued on the
  // host the app is actually served from (NEXT_PUBLIC_APP_URL). If those disagree — the
  // classic www-vs-apex slip — the user finishes the hosted login and comes back signed
  // out, so the onboarding gate bounces them to /login. Fail loudly rather than silently.
  it("warns when APP_URL's host disagrees with the browser-facing app url", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    buildConnectRedirects("https://www.app.test", "/onboarding");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("www.app.test"));
  });

  it("stays quiet when the hosts agree", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_APP_URL = "http://app.test";
    buildConnectRedirects("https://app.test", "/onboarding");
    expect(warn).not.toHaveBeenCalled();
  });
});

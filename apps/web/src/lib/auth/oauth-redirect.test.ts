import { describe, expect, it, vi } from "vitest";
import { googleOAuthRedirectTo } from "./oauth-redirect";

describe("googleOAuthRedirectTo", () => {
  it("builds the callback URL on the app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    expect(googleOAuthRedirectTo({})).toBe("https://app.example.com/auth/callback");
    vi.unstubAllEnvs();
  });

  it("carries a validated next path and drops open redirects", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    expect(googleOAuthRedirectTo({ next: "/invite/abc" })).toBe(
      "https://app.example.com/auth/callback?next=%2Finvite%2Fabc"
    );
    expect(googleOAuthRedirectTo({ next: "https://evil.example" })).toBe(
      "https://app.example.com/auth/callback"
    );
    vi.unstubAllEnvs();
  });

  it("carries a landing-page site host and an invite UUID, never a script URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const url = googleOAuthRedirectTo({
      site: "acme.com",
      invite: "11111111-2222-3333-4444-555555555555",
    });
    expect(url).toContain("site=acme.com");
    expect(url).toContain("invite=11111111-2222-3333-4444-555555555555");
    expect(googleOAuthRedirectTo({ site: "javascript:alert(1)" })).toBe("http://localhost:3000/auth/callback");
    expect(googleOAuthRedirectTo({ invite: "not-a-uuid" })).toBe("http://localhost:3000/auth/callback");
    vi.unstubAllEnvs();
  });
});

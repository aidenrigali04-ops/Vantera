import { describe, expect, it, vi } from "vitest";
import { startGoogleOAuth } from "./oauth-start";

describe("startGoogleOAuth", () => {
  it("returns the provider URL from signInWithOAuth", async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
      error: null,
    }));
    const out = await startGoogleOAuth({ auth: { signInWithOAuth } } as never, {
      next: "/dashboard",
    });
    expect(out).toEqual({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
        redirectTo: expect.stringContaining("/auth/callback"),
      }),
    });
  });

  it("maps a provider error to a friendly message", async () => {
    const out = await startGoogleOAuth(
      {
        auth: {
          signInWithOAuth: async () => ({
            data: { url: null },
            error: { message: "Unsupported provider: provider is not enabled" },
          }),
        },
      } as never,
      {}
    );
    expect("error" in out && out.error).toMatch(/Google sign-in isn't available/i);
  });
});

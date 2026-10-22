import { describe, expect, it } from "vitest";
import { authQueryMessage, friendlyAuthError } from "./errors";

describe("friendlyAuthError", () => {
  it("maps known Supabase auth errors", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("Incorrect email or password.");
    expect(friendlyAuthError("Email not confirmed")).toBe(
      "Confirm your email first — check your inbox for the link."
    );
    expect(friendlyAuthError("User already registered")).toBe(
      "An account with this email already exists. Try signing in."
    );
  });

  it("maps the admin-API duplicate-signup error by substring", () => {
    expect(friendlyAuthError("A user with this email address has already been registered")).toBe(
      "An account with this email already exists. Try signing in."
    );
  });

  it("maps rate-limit errors by substring", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toBe(
      "Too many attempts right now — please wait a few minutes and try again."
    );
    expect(friendlyAuthError("Request rate limit reached")).toBe(
      "Too many attempts right now — please wait a few minutes and try again."
    );
  });

  it("maps a disabled Google provider to a usable next step", () => {
    expect(friendlyAuthError("Unsupported provider: provider is not enabled")).toBe(
      "Google sign-in isn't available yet. Use email and password."
    );
  });

  it("falls back to a generic message", () => {
    expect(friendlyAuthError("weird internal thing")).toBe(
      "Something went wrong. Please try again."
    );
  });
});

describe("authQueryMessage", () => {
  it("explains OAuth and invite-email failures from the callback", () => {
    expect(authQueryMessage("oauth")).toBe(
      "Google sign-in didn't complete. Try again, or use email and password."
    );
    expect(authQueryMessage("invite-email")).toMatch(/doesn't match the invited email/i);
    expect(authQueryMessage("link-expired")).toBeUndefined();
  });
});

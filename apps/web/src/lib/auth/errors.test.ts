import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./errors";

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

  it("falls back to a generic message", () => {
    expect(friendlyAuthError("weird internal thing")).toBe(
      "Something went wrong. Please try again."
    );
  });
});

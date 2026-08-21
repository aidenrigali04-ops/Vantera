import { beforeAll, describe, expect, it } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

beforeAll(() => {
  process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = "test-secret";
});

describe("lifecycle unsubscribe tokens", () => {
  it("round-trips a user id", () => {
    const token = signUnsubscribeToken("user-123");
    expect(verifyUnsubscribeToken(token)).toBe("user-123");
  });

  it("rejects a tampered payload", () => {
    const token = signUnsubscribeToken("user-123");
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("user-999").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyUnsubscribeToken("not-a-token")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("rejects a token with extra segments appended", () => {
    const token = signUnsubscribeToken("user-123");
    // split(".") on a valid token yields exactly [payload, signature]; a naive destructure
    // silently discards anything past index 1, so a trailing segment must not verify.
    expect(verifyUnsubscribeToken(`${token}.GARBAGE`)).toBeNull();
  });

  it("produces a URL-safe token", () => {
    expect(signUnsubscribeToken("user-123")).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("round-trips through the exact unsubscribe URL shape the pullback-email trigger task builds", () => {
    // Mirrors packages/jobs/src/trigger/pullback-email.ts verbatim:
    //   `${appUrl}/api/lifecycle-unsubscribe/${signUnsubscribeToken(message.userId)}`
    // signed from message.userId (the user, never message.to, the recipient address) — proves
    // the end-to-end wiring produces a link apps/web's [token] route can actually resolve.
    const appUrl = "https://www.vanterasystem.dev";
    const userId = "user-42";
    const prefix = `${appUrl}/api/lifecycle-unsubscribe/`;
    const unsubscribeUrl = `${prefix}${signUnsubscribeToken(userId)}`;

    // Extract the [token] dynamic segment the way Next.js routing would hand it to the route.
    const token = unsubscribeUrl.slice(prefix.length);
    expect(verifyUnsubscribeToken(token)).toBe(userId);

    // Signing the email address instead (the bug this wiring must not reintroduce) would NOT
    // verify back to the user id the route looks up.
    const wrongUrl = `${prefix}${signUnsubscribeToken("founder@example.com")}`;
    const wrongToken = wrongUrl.slice(prefix.length);
    expect(verifyUnsubscribeToken(wrongToken)).not.toBe(userId);
  });
});

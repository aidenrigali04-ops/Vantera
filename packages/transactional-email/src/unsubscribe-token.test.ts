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
});

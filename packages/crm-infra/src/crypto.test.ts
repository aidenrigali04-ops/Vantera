import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "./crypto";

// 32-byte key as 64 hex chars
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("CRM token encryption", () => {
  it("round-trips a token", () => {
    const secret = "ya29.a0Afaketoken-with.special_chars/and+symbols=";
    const enc = encryptToken(secret, KEY);
    expect(enc).not.toContain(secret);
    expect(decryptToken(enc, KEY)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptToken("same", KEY)).not.toBe(encryptToken("same", KEY));
  });

  it("fails to decrypt if the ciphertext is tampered with", () => {
    const enc = encryptToken("secret", KEY);
    const raw = Buffer.from(enc, "base64");
    raw[raw.length - 1] = raw[raw.length - 1]! ^ 0x01; // flip a byte in the ciphertext
    expect(() => decryptToken(raw.toString("base64"), KEY)).toThrow();
  });

  it("fails to decrypt with the wrong key", () => {
    const enc = encryptToken("secret", KEY);
    const other = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";
    expect(() => decryptToken(enc, other)).toThrow();
  });

  it("rejects a missing or malformed key", () => {
    expect(() => encryptToken("x", undefined)).toThrow(/CRM_TOKEN_KEY/);
    expect(() => encryptToken("x", "tooshort")).toThrow(/32 bytes/);
  });
});

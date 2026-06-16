import { describe, expect, it } from "vitest";
import {
  encryptToken,
  decryptToken,
  encryptTokenWithKeyring,
  decryptTokenWithKeyring,
} from "./crypto";

// 32-byte keys as 64 hex chars
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const KEY2 = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";

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

  it("rejects a malformed explicit key", () => {
    expect(() => encryptToken("x", "tooshort")).toThrow(/32 bytes/);
  });
});

describe("CRM token keyring (rotation)", () => {
  it("encrypts with the primary key and version-tags the output", () => {
    const env = { CRM_TOKEN_KEYS: `v1:${KEY}` };
    const enc = encryptTokenWithKeyring("secret", env);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptTokenWithKeyring(enc, env)).toBe("secret");
  });

  it("treats a lone CRM_TOKEN_KEY as the v0 primary", () => {
    const env = { CRM_TOKEN_KEY: KEY };
    const enc = encryptTokenWithKeyring("secret", env);
    expect(enc.startsWith("v0:")).toBe(true);
    expect(decryptTokenWithKeyring(enc, env)).toBe("secret");
  });

  it("decrypts legacy UNPREFIXED ciphertext (produced before versioning) via v0", () => {
    const legacyCiphertext = encryptToken("old-token", KEY); // explicit-key path = unprefixed
    expect(legacyCiphertext).not.toContain(":");
    expect(decryptTokenWithKeyring(legacyCiphertext, { CRM_TOKEN_KEY: KEY })).toBe("old-token");
  });

  it("supports rotation: new primary encrypts, old ciphertext still decrypts", () => {
    const before = { CRM_TOKEN_KEY: KEY };
    const oldEnc = encryptTokenWithKeyring("t1", before); // v0:...
    const after = { CRM_TOKEN_KEYS: `v1:${KEY2}`, CRM_TOKEN_KEY: KEY }; // rotate: v1 primary, v0 retained
    const newEnc = encryptTokenWithKeyring("t2", after);
    expect(newEnc.startsWith("v1:")).toBe(true);
    expect(decryptTokenWithKeyring(oldEnc, after)).toBe("t1"); // old key still decrypts old data
    expect(decryptTokenWithKeyring(newEnc, after)).toBe("t2"); // new key decrypts new data
  });

  it("rejects a ciphertext whose key version is no longer configured", () => {
    expect(() => decryptTokenWithKeyring("v9:AAAA", { CRM_TOKEN_KEY: KEY })).toThrow(/no key for version v9/);
  });

  it("throws when no key is configured at all", () => {
    expect(() => encryptTokenWithKeyring("x", {})).toThrow(/No CRM token key configured/);
  });
});

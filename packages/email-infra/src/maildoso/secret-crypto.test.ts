import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptSecret,
  encryptSecret,
  encryptSecretWithKeyring,
  decryptSecretWithKeyring,
} from "./secret-crypto";

const key = randomBytes(32).toString("hex");
const key2 = randomBytes(32).toString("hex");

describe("secret-crypto", () => {
  it("round-trips a secret", () => {
    const secret = "smtp-password-#$%123";
    const blob = encryptSecret(secret, key);
    expect(blob).not.toContain(secret);
    expect(decryptSecret(blob, key)).toBe(secret);
  });
  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });
  it("rejects a key that is not 32 bytes", () => {
    expect(() => encryptSecret("x", "abcd")).toThrow(/32 bytes/);
  });
  it("fails to decrypt with the wrong key (auth tag mismatch)", () => {
    const blob = encryptSecret("x", key);
    expect(() => decryptSecret(blob, randomBytes(32).toString("hex"))).toThrow();
  });
  it("rejects a malformed blob", () => {
    expect(() => decryptSecret("not-a-valid-blob", key)).toThrow(/malformed/);
  });
});

describe("secret-crypto keyring (rotation)", () => {
  it("round-trips with a versioned primary key", () => {
    const env = { OWNED_EMAIL_SECRET_KEYS: `v1:${key}` };
    const blob = encryptSecretWithKeyring("smtp-pw", env);
    expect(blob.startsWith("v1:")).toBe(true);
    expect(decryptSecretWithKeyring(blob, env)).toBe("smtp-pw");
  });

  it("decrypts legacy UNPREFIXED ciphertext via v0", () => {
    const legacy = encryptSecret("old-pw", key); // unprefixed iv:tag:ct
    expect(decryptSecretWithKeyring(legacy, { OWNED_EMAIL_SECRET_KEY: key })).toBe("old-pw");
  });

  it("rotates: new primary encrypts, old key still decrypts old data", () => {
    const oldEnc = encryptSecretWithKeyring("a", { OWNED_EMAIL_SECRET_KEY: key }); // v0
    const after = { OWNED_EMAIL_SECRET_KEYS: `v1:${key2}`, OWNED_EMAIL_SECRET_KEY: key };
    const newEnc = encryptSecretWithKeyring("b", after);
    expect(newEnc.startsWith("v1:")).toBe(true);
    expect(decryptSecretWithKeyring(oldEnc, after)).toBe("a");
    expect(decryptSecretWithKeyring(newEnc, after)).toBe("b");
  });

  it("rejects an unconfigured key version and a missing keyring", () => {
    expect(() => decryptSecretWithKeyring("v9:a:b:c", { OWNED_EMAIL_SECRET_KEY: key })).toThrow(/no key for version v9/);
    expect(() => encryptSecretWithKeyring("x", {})).toThrow(/No SMTP secret key configured/);
  });
});

import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./secret-crypto";

const key = randomBytes(32).toString("hex");

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

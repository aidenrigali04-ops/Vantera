import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for SMTP secrets at rest (each Maildoso mailbox's SMTP password). Mirrors the
 * CRM OAuth-token encryption pattern. Key = 32-byte hex (64 hex chars), e.g. OWNED_EMAIL_SECRET_KEY.
 * Wire format: `iv:authTag:ciphertext`, all hex.
 */
function loadKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("secret key must be 32 bytes (64 hex chars)");
  return key;
}

export function encryptSecret(plaintext: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(keyHex), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), ct.toString("hex")].join(":");
}

export function decryptSecret(blob: string, keyHex: string): string {
  const [ivHex, tagHex, ctHex] = blob.split(":");
  if (!ivHex || !tagHex || !ctHex) throw new Error("malformed secret blob");
  const decipher = createDecipheriv("aes-256-gcm", loadKey(keyHex), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
}

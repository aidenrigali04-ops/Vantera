import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for the OAuth tokens we store ourselves (first feature
// to hold third-party tokens — LinkedIn/email keep auth at the vendor). Keyed by
// CRM_TOKEN_KEY, a 32-byte value as 64 hex chars (generate: `openssl rand -hex 32`).
// Wire format (base64): [12-byte IV][16-byte GCM tag][ciphertext]. Tokens are never
// logged and never returned to the client.

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(keyHex: string | undefined): Buffer {
  if (!keyHex) {
    throw new Error("CRM_TOKEN_KEY is not set — cannot encrypt/decrypt CRM tokens.");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("CRM_TOKEN_KEY must be 32 bytes (64 hex chars).");
  }
  return key;
}

export function encryptToken(plaintext: string, keyHex = process.env.CRM_TOKEN_KEY): string {
  const key = resolveKey(keyHex);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(payload: string, keyHex = process.env.CRM_TOKEN_KEY): string {
  const key = resolveKey(keyHex);
  const raw = Buffer.from(payload, "base64");
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error("CRM token ciphertext is malformed.");
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

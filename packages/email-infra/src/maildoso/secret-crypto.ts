import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for SMTP secrets at rest (each Maildoso mailbox's SMTP password). Mirrors the CRM
 * OAuth-token keyring so secrets can be rotated, while staying backward-compatible with every
 * existing (unversioned) ciphertext.
 *
 * Wire formats:
 *   legacy   : "iv:tag:ct" (all hex)            — pre-rotation, no prefix
 *   versioned: "<keyId>:iv:tag:ct"              — keyId like v1, v2
 *
 * Env:
 *   OWNED_EMAIL_SECRET_KEY  — single 32-byte hex key, mapped to key id "v0".
 *   OWNED_EMAIL_SECRET_KEYS — optional rotation ring "v2:<hex>,v1:<hex>" (first = primary/encrypt).
 */

const LEGACY_KEY_ID = "v0";
const KEY_ID_RE = /^v\d+$/;

function toKey(keyHex: string | undefined): Buffer {
  if (!keyHex) throw new Error("OWNED_EMAIL_SECRET_KEY is not set — cannot encrypt/decrypt SMTP secrets.");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("secret key must be 32 bytes (64 hex chars)");
  return key;
}

interface Keyring {
  primaryId: string;
  keys: Map<string, Buffer>;
}

function loadKeyring(env: Record<string, string | undefined>): Keyring {
  const keys = new Map<string, Buffer>();
  let primaryId: string | undefined;

  const multi = env.OWNED_EMAIL_SECRET_KEYS?.trim();
  if (multi) {
    for (const entry of multi.split(",")) {
      const [rawId, rawHex] = entry.split(":");
      const id = rawId?.trim() ?? "";
      if (!KEY_ID_RE.test(id)) throw new Error(`OWNED_EMAIL_SECRET_KEYS: bad key id "${id}" (expected v<number>)`);
      keys.set(id, toKey(rawHex?.trim()));
      if (!primaryId) primaryId = id;
    }
  }

  const legacy = env.OWNED_EMAIL_SECRET_KEY?.trim();
  if (legacy) {
    if (!keys.has(LEGACY_KEY_ID)) keys.set(LEGACY_KEY_ID, toKey(legacy));
    if (!primaryId) primaryId = LEGACY_KEY_ID;
  }

  if (!primaryId) throw new Error("No SMTP secret key configured (set OWNED_EMAIL_SECRET_KEY or OWNED_EMAIL_SECRET_KEYS).");
  return { primaryId, keys };
}

function encryptRaw(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ct.toString("hex")].join(":");
}

function decryptRaw(blob: string, key: Buffer): string {
  const [ivHex, tagHex, ctHex] = blob.split(":");
  if (!ivHex || !tagHex || !ctHex) throw new Error("malformed secret blob");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
}

/** Split an optional "<keyId>:" prefix; unprefixed (legacy) ciphertext maps to v0. */
function splitVersion(payload: string): { keyId: string; blob: string } {
  const i = payload.indexOf(":");
  if (i > 0) {
    const id = payload.slice(0, i);
    if (KEY_ID_RE.test(id)) return { keyId: id, blob: payload.slice(i + 1) };
  }
  return { keyId: LEGACY_KEY_ID, blob: payload };
}

/** Encrypt with the env keyring's primary key, version-tagging the output. */
export function encryptSecretWithKeyring(plaintext: string, env: Record<string, string | undefined> = process.env): string {
  const { primaryId, keys } = loadKeyring(env);
  return `${primaryId}:${encryptRaw(plaintext, keys.get(primaryId)!)}`;
}

/** Decrypt using the env keyring, selecting the key by the ciphertext's version (or v0 if legacy). */
export function decryptSecretWithKeyring(payload: string, env: Record<string, string | undefined> = process.env): string {
  const { keys } = loadKeyring(env);
  const { keyId, blob } = splitVersion(payload);
  const key = keys.get(keyId);
  if (!key) throw new Error(`SMTP secret: no key for version ${keyId} (is it still in OWNED_EMAIL_SECRET_KEYS/OWNED_EMAIL_SECRET_KEY?)`);
  return decryptRaw(blob, key);
}

// Public single-key API (explicit-key callers + tests). Unprefixed legacy format on encrypt;
// tolerates a version prefix on decrypt.
export function encryptSecret(plaintext: string, keyHex: string): string {
  return encryptRaw(plaintext, toKey(keyHex));
}

export function decryptSecret(blob: string, keyHex: string): string {
  return decryptRaw(splitVersion(blob).blob, toKey(keyHex));
}

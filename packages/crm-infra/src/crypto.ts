import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for the OAuth tokens we store ourselves. Supports key
// rotation via a versioned keyring while staying backward-compatible with every existing
// (unversioned) ciphertext.
//
// Wire formats:
//   legacy  : base64([12-byte IV][16-byte GCM tag][ciphertext])        — pre-rotation, no prefix
//   versioned: "<keyId>:" + the same base64                            — keyId like v1, v2
//
// Env:
//   CRM_TOKEN_KEY   — single 32-byte hex key (openssl rand -hex 32). Mapped to key id "v0".
//   CRM_TOKEN_KEYS  — optional rotation ring "v2:<hex>,v1:<hex>": FIRST entry encrypts (primary),
//                     all entries decrypt. Keep CRM_TOKEN_KEY set (as v0) until a backfill
//                     re-encrypts every stored token onto the new primary.
// Tokens are never logged and never returned to the client.

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const LEGACY_KEY_ID = "v0";
const KEY_ID_RE = /^v\d+$/;

function toKey(keyHex: string | undefined): Buffer {
  if (!keyHex) throw new Error("CRM_TOKEN_KEY is not set — cannot encrypt/decrypt CRM tokens.");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("CRM_TOKEN_KEY must be 32 bytes (64 hex chars).");
  return key;
}

interface Keyring {
  primaryId: string;
  keys: Map<string, Buffer>;
}

function loadKeyring(env: Record<string, string | undefined>): Keyring {
  const keys = new Map<string, Buffer>();
  let primaryId: string | undefined;

  const multi = env.CRM_TOKEN_KEYS?.trim();
  if (multi) {
    for (const entry of multi.split(",")) {
      const [rawId, rawHex] = entry.split(":");
      const id = rawId?.trim() ?? "";
      if (!KEY_ID_RE.test(id)) throw new Error(`CRM_TOKEN_KEYS: bad key id "${id}" (expected v<number>)`);
      keys.set(id, toKey(rawHex?.trim()));
      if (!primaryId) primaryId = id; // first entry is the primary (encrypt) key
    }
  }

  const legacy = env.CRM_TOKEN_KEY?.trim();
  if (legacy) {
    if (!keys.has(LEGACY_KEY_ID)) keys.set(LEGACY_KEY_ID, toKey(legacy));
    if (!primaryId) primaryId = LEGACY_KEY_ID; // no ring → legacy key is primary (current state)
  }

  if (!primaryId) throw new Error("No CRM token key configured (set CRM_TOKEN_KEY or CRM_TOKEN_KEYS).");
  return { primaryId, keys };
}

function encryptRaw(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

function decryptRaw(blob: string, key: Buffer): string {
  const raw = Buffer.from(blob, "base64");
  if (raw.length < IV_LEN + TAG_LEN) throw new Error("CRM token ciphertext is malformed.");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
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
export function encryptTokenWithKeyring(plaintext: string, env: Record<string, string | undefined> = process.env): string {
  const { primaryId, keys } = loadKeyring(env);
  return `${primaryId}:${encryptRaw(plaintext, keys.get(primaryId)!)}`;
}

/** Decrypt using the env keyring, selecting the key by the ciphertext's version (or v0 if legacy). */
export function decryptTokenWithKeyring(payload: string, env: Record<string, string | undefined> = process.env): string {
  const { keys } = loadKeyring(env);
  const { keyId, blob } = splitVersion(payload);
  const key = keys.get(keyId);
  if (!key) throw new Error(`CRM token: no key for version ${keyId} (is it still in CRM_TOKEN_KEYS/CRM_TOKEN_KEY?)`);
  return decryptRaw(blob, key);
}

// Public API. With an explicit keyHex, use that single key (legacy unprefixed format) — the path
// tests and any explicit-key caller use. Without it, use the env keyring (the production path,
// supports rotation). Existing call sites pass no key, so they transparently gain rotation.
export function encryptToken(plaintext: string, keyHex?: string): string {
  if (keyHex !== undefined) return encryptRaw(plaintext, toKey(keyHex));
  return encryptTokenWithKeyring(plaintext, process.env);
}

export function decryptToken(payload: string, keyHex?: string): string {
  if (keyHex !== undefined) return decryptRaw(splitVersion(payload).blob, toKey(keyHex));
  return decryptTokenWithKeyring(payload, process.env);
}

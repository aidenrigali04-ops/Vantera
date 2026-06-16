# Encryption key rotation runbook

Vantera encrypts two kinds of secrets at rest with AES-256-GCM:

| Secret | Table.column | Module | Env |
|---|---|---|---|
| CRM OAuth tokens | `crm_connections.access_token_enc` / `refresh_token_enc` | `@vantera/crm-infra` `crypto.ts` | `CRM_TOKEN_KEY`, `CRM_TOKEN_KEYS` |
| Mailbox SMTP passwords | `mailboxes.smtp_secret` | `@vantera/email-infra` `secret-crypto.ts` | `OWNED_EMAIL_SECRET_KEY`, `OWNED_EMAIL_SECRET_KEYS` |

Both use a **versioned keyring**. Ciphertext is `"<keyId>:<base64-or-hex-body>"`; pre-rotation
ciphertext has no prefix and is treated as key id **v0** (= the single `*_KEY`). The keyring's
**first** entry is the *primary* (used to encrypt); **all** entries can decrypt. This makes
rotation a two-key window with a backfill in the middle — no downtime, no undecryptable data.

## When to rotate
- A key may have been exposed (leaked env, off-boarding, suspected compromise) — rotate now.
- Routine hygiene — quarterly (see `docs/production-readiness.md`).

## Procedure (example: CRM tokens; email is identical with `OWNED_EMAIL_SECRET_*`)

1. **Generate a new key**
   ```bash
   openssl rand -hex 32   # → NEWHEX
   ```

2. **Add it as the new primary, keep the old key for decrypt.** Set in every environment that
   holds the secret (Vercel + Trigger; see `project-vantera-env-wiring`):
   ```
   CRM_TOKEN_KEYS = v1:NEWHEX        # first entry = primary (encrypt)
   CRM_TOKEN_KEY  = <existing hex>   # stays → mapped to v0, still decrypts old ciphertext
   ```
   Deploy. From now on **new** writes are `v1:…`; **old** `v0`/unprefixed rows still decrypt.

3. **Backfill — re-encrypt every stored secret onto the new primary.** Read each row, decrypt
   with the keyring, re-encrypt with the keyring (now `v1`), write back. Idempotent: rows already
   on the primary version are skipped. Run it as a one-off (script or `node -e`) against the DB,
   e.g.:
   ```ts
   import { decryptTokenWithKeyring, encryptTokenWithKeyring } from "@vantera/crm-infra";
   for (const row of rowsWith("access_token_enc not null")) {
     if (row.access_token_enc.startsWith("v1:")) continue;       // already rotated
     const plain = decryptTokenWithKeyring(row.access_token_enc); // old key (v0) decrypts
     update(row.id, { access_token_enc: encryptTokenWithKeyring(plain) }); // → v1
   }
   ```
   Verify: `select count(*) ... where access_token_enc not like 'v1:%'` returns 0.

4. **Retire the old key.** Once the backfill verifies zero `v0` rows, drop the old key:
   ```
   CRM_TOKEN_KEYS = v1:NEWHEX
   CRM_TOKEN_KEY  =                # unset — v0 no longer needed
   ```
   Deploy. Done.

## Notes
- Never remove a key version while any ciphertext still references it — decrypt will throw
  `no key for version vN`. The backfill's zero-count check is the gate for step 4.
- The keyring is backward-compatible: with only `*_KEY` set (today's state) everything behaves
  exactly as before, just version-tagged as `v0` on new writes.
- A future automated backfill Trigger task can wrap step 3; until then it's a deliberate,
  supervised one-off (it rewrites every secret in the DB).

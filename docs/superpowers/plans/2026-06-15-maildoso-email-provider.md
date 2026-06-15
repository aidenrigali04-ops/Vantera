# Maildoso Single-Provider Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Smartlead with Maildoso as the sole `EmailInfra` provider — domains + mailboxes + per-mailbox SMTP sending + warmup — so that after merge the only remaining step to live email is a Maildoso subscription + API key.

**Architecture:** A new `MaildosoEmailInfra` implements the existing `EmailInfra` interface behind one thin `MaildosoApiClient` (the only file holding endpoint shapes). Maildoso mailboxes are per-mailbox SMTP accounts: `provision()` returns SMTP creds, the jobs layer encrypts them (AES-256-GCM) onto `mailboxes`, and `send()` decrypts via an injected `getSmtpCreds` callback so `email-infra` stays DB-free. Provisioning moves into a durable Trigger.dev task. Smartlead is deleted.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest, Drizzle + Supabase Postgres (RLS), Trigger.dev v4, nodemailer (SMTP transport), Next.js server actions.

**Spec:** `docs/superpowers/specs/2026-06-15-maildoso-email-provider-design.md`

**Branch:** `phase-maildoso-email` (already created off `main`).

---

## File Structure

**`packages/email-infra/`**
- `src/maildoso/secret-crypto.ts` (+ `.test.ts`) — **NEW (salvaged)** AES-256-GCM for SMTP secrets at rest.
- `src/maildoso/smtp-sender.ts` (+ `.test.ts`) — **NEW (salvaged)** `SmtpSender` + `SmtpTransport` seam.
- `src/maildoso/nodemailer-transport.ts` — **NEW** production `SmtpTransport` binding (nodemailer). Untested (thin I/O seam).
- `src/maildoso/api-client.ts` (+ `.test.ts`) — **NEW** `MaildosoApiClient`; the only place with endpoint paths/shapes.
- `src/maildoso/index.ts` (+ `.test.ts`) — **NEW** `MaildosoEmailInfra implements EmailInfra`.
- `src/types.ts` — **MODIFY** add `SmtpCredentials`, `ProvisionedMailbox`, `GetSmtpCreds`; change `provision()` return type.
- `src/in-memory.ts` — **MODIFY** `provision()` returns `ProvisionedMailbox[]` (fake creds).
- `src/index.ts` — **MODIFY** export Maildoso + new factory; drop Smartlead.
- `src/smartlead.ts`, `src/smartlead.test.ts` — **DELETE**.
- `package.json` — **MODIFY** add `nodemailer` + `@types/nodemailer`.

**`packages/db/`**
- `migrations/0021_mailbox_smtp_secret.sql` — **NEW** add SMTP columns + server-managed grants.
- `src/schema.ts` — **MODIFY** add columns to `mailboxes`.
- `src/schema.test.ts` — **MODIFY** grant guardrail test.

**`packages/jobs/`**
- `src/pipeline/types.ts` — **MODIFY** store methods + `GetSmtpCreds` dep type.
- `src/pipeline/pg-store.ts` — **MODIFY** persist (encrypt) / fetch (decrypt) / purge SMTP secrets.
- `src/pipeline/provision-email.ts` (+ `.test.ts`) — **NEW** pure provisioning core.
- `src/trigger/provision-email.ts` — **NEW** thin wrapper.
- `src/pipeline/deprovision.ts` (+ `.test.ts`) — **NEW** pure deprovision core (Maildoso delete + purge).
- `src/trigger/deprovision-account.ts` — **NEW** thin wrapper.
- `src/trigger/outreach-send.ts` — **MODIFY** wire `getSmtpCreds`.
- `src/trigger/process-account-deletion.ts` — **MODIFY** call deprovision in vendor-cleanup.

**`apps/web/`**
- `src/app/(app)/settings/channels/actions.ts` — **MODIFY** enqueue `provision-email` instead of inline provision.
- `src/app/api/webhooks/stripe/route.ts` — **MODIFY** enqueue deprovision on cancel/downgrade.
- `src/app/api/webhooks/email/route.ts` — **VERIFY** (uses the factory; should need no change).

**Root**
- `.env.example` — **MODIFY** swap `SMARTLEAD_*` → `MAILDOSO_API_KEY`, `OWNED_EMAIL_SECRET_KEY`, `OWNED_EMAIL_WEBHOOK_SECRET`.
- `packages/help-content/content/channels-email.md` (or existing email article) — **MODIFY** owned-provisioning copy (no vendor name).

---

## Task 1: Salvage secret-crypto

**Files:**
- Create: `packages/email-infra/src/maildoso/secret-crypto.ts`
- Test: `packages/email-infra/src/maildoso/secret-crypto.test.ts`

- [ ] **Step 1: Write the test** (`secret-crypto.test.ts`)

```ts
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
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/email-infra test secret-crypto` → FAIL ("Cannot find module ./secret-crypto").

- [ ] **Step 3: Write the implementation** (`secret-crypto.ts`)

```ts
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
```

- [ ] **Step 4: Run it, verify PASS** — `pnpm --filter @vantera/email-infra test secret-crypto` → PASS (5 tests).

- [ ] **Step 5: Commit** — `git add packages/email-infra/src/maildoso/secret-crypto.* && git commit -m "feat(email-infra): salvage secret-crypto for SMTP secrets at rest"`

---

## Task 2: Salvage smtp-sender

**Files:**
- Create: `packages/email-infra/src/maildoso/smtp-sender.ts`
- Test: `packages/email-infra/src/maildoso/smtp-sender.test.ts`

- [ ] **Step 1: Write the test** (`smtp-sender.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { SmtpSender, type SmtpCredentials, type SmtpMessage, type SmtpTransport } from "./smtp-sender";

const creds: SmtpCredentials = { host: "smtp.example.com", port: 587, username: "sdr0@a.com", password: "pw" };
const msg: SmtpMessage = { from: "sdr0@a.com", to: "lead@x.com", subject: "Hi", html: "<p>Body</p>" };

describe("SmtpSender", () => {
  it("sends through the injected transport and maps to SendResult", async () => {
    const calls: Array<{ creds: SmtpCredentials; msg: SmtpMessage }> = [];
    const transport: SmtpTransport = {
      async sendMail(c, m) { calls.push({ creds: c, msg: m }); return { messageId: "smtp_1" }; },
    };
    const res = await new SmtpSender(transport).send(creds, msg);
    expect(res.messageId).toBe("smtp_1");
    expect(typeof res.sentAt).toBe("string");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.creds.username).toBe("sdr0@a.com");
    expect(calls[0]!.msg.to).toBe("lead@x.com");
  });
  it("propagates transport failures", async () => {
    const transport: SmtpTransport = { async sendMail() { throw new Error("smtp auth failed"); } };
    await expect(new SmtpSender(transport).send(creds, msg)).rejects.toThrow(/smtp auth failed/);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/email-infra test smtp-sender` → FAIL.

- [ ] **Step 3: Write the implementation** (`smtp-sender.ts`)

```ts
import type { SendResult } from "../types";

/** Per-mailbox SMTP credentials. Maildoso exposes host/port/user/pass for each provisioned mailbox. */
export interface SmtpCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  /** true for implicit TLS (465); false for STARTTLS (587). Defaults by port if omitted. */
  secure?: boolean;
}

export interface SmtpMessage {
  from: string;
  to: string;
  subject: string;
  /** HTML body */
  html: string;
  /** extra headers, e.g. List-Unsubscribe (rule 11) */
  headers?: Record<string, string>;
}

/** Transport seam so SmtpSender is fully testable without a real SMTP library. */
export interface SmtpTransport {
  sendMail(creds: SmtpCredentials, msg: SmtpMessage): Promise<{ messageId: string }>;
}

/** Sends one email through a mailbox's own SMTP credentials — the Maildoso model. */
export class SmtpSender {
  constructor(private readonly transport: SmtpTransport) {}
  async send(creds: SmtpCredentials, msg: SmtpMessage): Promise<SendResult> {
    const { messageId } = await this.transport.sendMail(creds, msg);
    return { messageId, sentAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 4: Run it, verify PASS** — `pnpm --filter @vantera/email-infra test smtp-sender` → PASS (2 tests).

- [ ] **Step 5: Commit** — `git add packages/email-infra/src/maildoso/smtp-sender.* && git commit -m "feat(email-infra): salvage SmtpSender transport seam"`

---

## Task 3: nodemailer production transport

**Files:**
- Create: `packages/email-infra/src/maildoso/nodemailer-transport.ts`
- Modify: `packages/email-infra/package.json`

- [ ] **Step 1: Add deps** — in `packages/email-infra/package.json` add a `dependencies` block:

```json
  "dependencies": {
    "nodemailer": "^6.9.0"
  },
```

and to `devDependencies` add `"@types/nodemailer": "^6.4.0"`. Then run `pnpm install`.

- [ ] **Step 2: Write the transport** (`nodemailer-transport.ts`) — thin I/O seam, no unit test (covered by live smoke):

```ts
import nodemailer from "nodemailer";
import type { SmtpCredentials, SmtpMessage, SmtpTransport } from "./smtp-sender";

/** Production SmtpTransport: opens a per-call nodemailer connection with the mailbox's own creds. */
export class NodemailerTransport implements SmtpTransport {
  async sendMail(creds: SmtpCredentials, msg: SmtpMessage): Promise<{ messageId: string }> {
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure ?? creds.port === 465,
      auth: { user: creds.username, pass: creds.password },
    });
    const info = await transporter.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      headers: msg.headers,
    });
    return { messageId: info.messageId };
  }
}
```

- [ ] **Step 3: Type-check** — `pnpm --filter @vantera/email-infra type-check` → clean.

- [ ] **Step 4: Commit** — `git add packages/email-infra/package.json packages/email-infra/src/maildoso/nodemailer-transport.ts ../../pnpm-lock.yaml && git commit -m "feat(email-infra): nodemailer production SMTP transport"`

---

## Task 4: Extend EmailInfra types for SMTP provisioning

**Files:**
- Modify: `packages/email-infra/src/types.ts`

- [ ] **Step 1: Add types and change the provision return.** Append to `types.ts`:

```ts
import type { SmtpCredentials } from "./maildoso/smtp-sender";
export type { SmtpCredentials };

/** A provisioned mailbox plus the secret needed to send through it. The jobs layer persists
 *  `smtp` (encrypted) and never returns it to the browser. Read paths use plain `Mailbox`. */
export interface ProvisionedMailbox extends Mailbox {
  /** Present for SMTP providers (Maildoso). The in-memory fake also sets it so the persist path is tested. */
  smtp?: SmtpCredentials;
}

/** Resolves a mailbox's decrypted SMTP creds at send time. Wired in the jobs layer (pg-store). */
export type GetSmtpCreds = (mailboxId: string) => Promise<SmtpCredentials>;
```

Then change the interface method signature in `EmailInfra`:

```ts
  // was: provision(req: ProvisionRequest): Promise<Mailbox[]>;
  provision(req: ProvisionRequest): Promise<ProvisionedMailbox[]>;
```

- [ ] **Step 2: Type-check** — `pnpm --filter @vantera/email-infra type-check` → FAIL (in-memory + smartlead no longer match). Expected; fixed in Tasks 5 and 8.

- [ ] **Step 3: Commit** — `git add packages/email-infra/src/types.ts && git commit -m "feat(email-infra): ProvisionedMailbox + GetSmtpCreds types"`

---

## Task 5: Update InMemoryEmailInfra to return SMTP creds

**Files:**
- Modify: `packages/email-infra/src/in-memory.ts`
- Test: `packages/email-infra/src/in-memory.test.ts`

- [ ] **Step 1: Add a test** asserting provision returns a usable `smtp` cred. In `in-memory.test.ts`:

```ts
it("provision returns per-mailbox smtp creds", async () => {
  const infra = new InMemoryEmailInfra();
  const [mbx] = await infra.provision({ accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 1 });
  expect(mbx!.smtp).toMatchObject({ username: mbx!.address, port: 587 });
  expect(mbx!.smtp!.password).toBeTruthy();
});
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/email-infra test in-memory` → FAIL (`smtp` undefined).

- [ ] **Step 3: Update `provision()`** in `in-memory.ts`: change the return type to `ProvisionedMailbox[]`, import it, and set `smtp` on each created mailbox:

```ts
        const mailbox: ProvisionedMailbox = {
          id, address: `sdr${m}@${domain}`, domain,
          smtp: { host: "smtp.in-memory.test", port: 587, username: `sdr${m}@${domain}`, password: `pw_${id}` },
        };
```

Update the `created` array type to `ProvisionedMailbox[]` and the import line to include `ProvisionedMailbox`.

- [ ] **Step 4: Run it, verify PASS** — `pnpm --filter @vantera/email-infra test in-memory` → PASS.

- [ ] **Step 5: Commit** — `git add packages/email-infra/src/in-memory.* && git commit -m "feat(email-infra): in-memory provision returns smtp creds"`

---

## Task 6: MaildosoApiClient

**Files:**
- Create: `packages/email-infra/src/maildoso/api-client.ts`
- Test: `packages/email-infra/src/maildoso/api-client.test.ts`

> **Endpoint paths below are best-effort from public docs and marked `CONFIRM ON ACTIVATION`. Tests inject a fake `fetch`, so they pass regardless; only these path/shape constants change during the 30-min activation pass.**

- [ ] **Step 1: Write the test** (`api-client.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { MaildosoApiClient } from "./api-client";

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("MaildosoApiClient", () => {
  it("sends the API key as a Bearer header", async () => {
    const fetchMock = vi.fn(async () => okJson({ domain: "d.com" }));
    const client = new MaildosoApiClient({ apiKey: "k_test", fetchImpl: fetchMock });
    await client.ensureDomain("d.com");
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer k_test" });
  });

  it("createMailbox returns address + smtp creds", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ id: "mbx_9", email: "sdr0@d.com", smtp: { host: "smtp.maildoso.io", port: 587, username: "sdr0@d.com", password: "p" } })
    );
    const client = new MaildosoApiClient({ apiKey: "k", fetchImpl: fetchMock });
    const mbx = await client.createMailbox("d.com", "sdr0");
    expect(mbx).toMatchObject({ providerRef: "mbx_9", address: "sdr0@d.com", smtp: { username: "sdr0@d.com" } });
  });

  it("throws with status + body on non-2xx", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 422, text: async () => "bad domain" } as Response));
    const client = new MaildosoApiClient({ apiKey: "k", fetchImpl: fetchMock });
    await expect(client.ensureDomain("x")).rejects.toThrow(/422.*bad domain/);
  });

  it("getWarmup maps provider phase to the neutral shape", async () => {
    const fetchMock = vi.fn(async () => okJson({ warmup_state: "warming", daily_limit: 12 }));
    const client = new MaildosoApiClient({ apiKey: "k", fetchImpl: fetchMock });
    expect(await client.getWarmup("mbx_9")).toEqual({ phase: "warming", dailyCap: 12 });
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/email-infra test api-client` → FAIL.

- [ ] **Step 3: Write the implementation** (`api-client.ts`)

```ts
import type { SmtpCredentials } from "./smtp-sender";

export interface MaildosoApiClientConfig {
  apiKey: string;
  /** default https://api.maildoso.com — CONFIRM ON ACTIVATION (open-Q#1) */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface CreatedMailbox {
  providerRef: string;
  address: string;
  domain: string;
  smtp: SmtpCredentials;
}

/** The ONLY place that knows Maildoso's HTTP shape. Every path/field marked CONFIRM ON ACTIVATION
 *  is confirmed against developers.maildoso.com once the plan is active; nothing else changes. */
export class MaildosoApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: MaildosoApiClientConfig) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl ?? "https://api.maildoso.com"; // CONFIRM ON ACTIVATION (open-Q#1)
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, // CONFIRM (open-Q#1)
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`maildoso ${res.status}: ${await res.text()}`);
    return res.json();
  }

  /** Register or connect a sending domain (auto SPF/DKIM/DMARC). CONFIRM path/fields (open-Q#2). */
  async ensureDomain(domain: string): Promise<void> {
    await this.call("POST", "/v1/domains", { domain });
  }

  /** Create one mailbox on a domain; returns address + per-mailbox SMTP creds. CONFIRM (open-Q#3/#4). */
  async createMailbox(domain: string, localPart: string): Promise<CreatedMailbox> {
    const r = (await this.call("POST", "/v1/mailboxes", { domain, username: localPart })) as Record<string, any>;
    return {
      providerRef: String(r.id),
      address: String(r.email),
      domain,
      smtp: {
        host: String(r.smtp.host), port: Number(r.smtp.port),
        username: String(r.smtp.username), password: String(r.smtp.password),
        secure: r.smtp.secure ?? undefined,
      },
    };
  }

  /** Warmup state for a mailbox. CONFIRM path/fields (open-Q#5). */
  async getWarmup(providerRef: string): Promise<{ phase: "warming" | "ready"; dailyCap: number }> {
    const r = (await this.call("GET", `/v1/mailboxes/${providerRef}/warmup`)) as Record<string, any>;
    return { phase: r.warmup_state === "ready" ? "ready" : "warming", dailyCap: Number(r.daily_limit ?? 0) };
  }

  /** Delete a mailbox (deprovision-on-cancel). CONFIRM path (open-Q#6). */
  async deleteMailbox(providerRef: string): Promise<void> {
    await this.call("DELETE", `/v1/mailboxes/${providerRef}`);
  }

  /** Release a domain (deprovision-on-cancel). CONFIRM path (open-Q#6). */
  async releaseDomain(domain: string): Promise<void> {
    await this.call("DELETE", `/v1/domains/${encodeURIComponent(domain)}`);
  }
}
```

- [ ] **Step 4: Run it, verify PASS** — `pnpm --filter @vantera/email-infra test api-client` → PASS (4 tests).

- [ ] **Step 5: Commit** — `git add packages/email-infra/src/maildoso/api-client.* && git commit -m "feat(email-infra): MaildosoApiClient (endpoints flagged for activation)"`

---

## Task 7: MaildosoEmailInfra

**Files:**
- Create: `packages/email-infra/src/maildoso/index.ts`
- Test: `packages/email-infra/src/maildoso/index.test.ts`

- [ ] **Step 1: Write the test** (`index.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { MaildosoEmailInfra } from "./index";
import type { SmtpCredentials, SmtpTransport } from "./smtp-sender";
import type { MaildosoApiClient } from "./api-client";

const creds: SmtpCredentials = { host: "h", port: 587, username: "sdr0@d.com", password: "p" };

function fakeApi(): MaildosoApiClient {
  return {
    ensureDomain: vi.fn(async () => {}),
    createMailbox: vi.fn(async (domain: string, lp: string) => ({
      providerRef: `mbx_${lp}`, address: `${lp}@${domain}`, domain, smtp: creds,
    })),
    getWarmup: vi.fn(async () => ({ phase: "warming" as const, dailyCap: 12 })),
    deleteMailbox: vi.fn(async () => {}),
    releaseDomain: vi.fn(async () => {}),
  } as unknown as MaildosoApiClient;
}

describe("MaildosoEmailInfra", () => {
  it("provision creates N mailboxes per domain with smtp creds", async () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    const out = await infra.provision({ accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 2 });
    expect(out).toHaveLength(2);
    expect(out[0]!.smtp).toEqual(creds);
    expect(out[0]!.id).toBe(out[0]!.address); // id == providerRef-derived address ref (see impl)
  });

  it("send resolves creds via getSmtpCreds and sets List-Unsubscribe", async () => {
    const transport: SmtpTransport = { sendMail: vi.fn(async () => ({ messageId: "smtp_1" })) };
    const infra = new MaildosoEmailInfra({
      api: fakeApi(), webhookSecret: "whsec", transport,
      getSmtpCreds: async () => creds,
    });
    const res = await infra.send({
      mailboxId: "mbx_x", to: "lead@x.com", subject: "Hi", body: "<p>hi</p>",
      campaignId: "c1", leadId: "l1", unsubscribeUrl: "https://app/u/abc",
    });
    expect(res.messageId).toBe("smtp_1");
    const arg = (transport.sendMail as any).mock.calls[0][1];
    expect(arg.headers["List-Unsubscribe"]).toContain("https://app/u/abc");
  });

  it("send throws if getSmtpCreds was not wired", async () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    await expect(infra.send({ mailboxId: "m", to: "a@b.com", subject: "s", body: "b", campaignId: "c", leadId: "l" }))
      .rejects.toThrow(/getSmtpCreds/);
  });

  it("verifyWebhook is timing-safe and rejects a wrong secret", () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    expect(infra.verifyWebhook({ "x-maildoso-secret": "whsec" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-maildoso-secret": "wrong" }, "{}")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/email-infra test maildoso/index` → FAIL.

- [ ] **Step 3: Write the implementation** (`index.ts`)

```ts
import { timingSafeEqual } from "node:crypto";
import type {
  EmailEvent, EmailInfra, OutboundEmail, ProvisionRequest, ProvisionedMailbox, SendResult, WarmupStatus, GetSmtpCreds,
} from "../types";
import { MaildosoApiClient } from "./api-client";
import { SmtpSender, type SmtpTransport } from "./smtp-sender";

export interface MaildosoEmailInfraConfig {
  api: MaildosoApiClient;
  webhookSecret: string;
  /** Required for send(); omitted on provision-only construction. */
  getSmtpCreds?: GetSmtpCreds;
  /** Defaults to NodemailerTransport in the factory; tests inject a fake. */
  transport?: SmtpTransport;
}

export class MaildosoEmailInfra implements EmailInfra {
  private readonly api: MaildosoApiClient;
  private readonly webhookSecret: string;
  private readonly getSmtpCreds?: GetSmtpCreds;
  private readonly sender?: SmtpSender;

  constructor(cfg: MaildosoEmailInfraConfig) {
    this.api = cfg.api;
    this.webhookSecret = cfg.webhookSecret;
    this.getSmtpCreds = cfg.getSmtpCreds;
    this.sender = cfg.transport ? new SmtpSender(cfg.transport) : undefined;
  }

  async provision(req: ProvisionRequest): Promise<ProvisionedMailbox[]> {
    const out: ProvisionedMailbox[] = [];
    for (let d = 0; d < req.domainCount; d++) {
      const domain = `outbound-${req.accountId.slice(0, 8)}-${d}.maildoso.app`; // CONFIRM domain-naming (open-Q#2)
      await this.api.ensureDomain(domain);
      for (let m = 0; m < req.mailboxesPerDomain; m++) {
        const created = await this.api.createMailbox(domain, `sdr${m}`);
        out.push({ id: created.providerRef, address: created.address, domain: created.domain, smtp: created.smtp });
      }
    }
    return out;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    if (!this.getSmtpCreds || !this.sender) {
      throw new Error("MaildosoEmailInfra.send requires getSmtpCreds + transport (wire in the jobs factory)");
    }
    const creds = await this.getSmtpCreds(email.mailboxId);
    const headers: Record<string, string> = {};
    if (email.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${email.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    return this.sender.send(creds, {
      from: creds.username, to: email.to, subject: email.subject, html: email.body, headers,
    });
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    const w = await this.api.getWarmup(mailboxId);
    return { mailboxId, phase: w.phase, dailyCap: w.dailyCap };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["x-maildoso-secret"]; // CONFIRM header name (open-Q#7)
    if (!presented) return false;
    const a = Buffer.from(presented);
    const b = Buffer.from(this.webhookSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEventWebhook(payload: unknown): EmailEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.event_id !== "string" || typeof p.mailbox_ref !== "string") return null; // CONFIRM (open-Q#7)
    const base = { providerEventId: p.event_id, mailboxRef: p.mailbox_ref };
    switch (p.event_type) {
      case "reply":
        return { type: "reply", ...base, from: String(p.from ?? ""), body: String(p.body ?? ""),
                 receivedAt: String(p.received_at ?? new Date().toISOString()), messageRef: (p.message_ref as string) ?? null };
      case "bounce":
        return { type: "bounce", ...base, recipient: String(p.recipient ?? "") };
      case "complaint":
        return { type: "complaint", ...base, recipient: String(p.recipient ?? "") };
      default:
        return null;
    }
  }
}
```

- [ ] **Step 4: Run it, verify PASS** — `pnpm --filter @vantera/email-infra test maildoso/index` → PASS.

- [ ] **Step 5: Commit** — `git add packages/email-infra/src/maildoso/index.* && git commit -m "feat(email-infra): MaildosoEmailInfra implements EmailInfra"`

---

## Task 8: Factory + index exports; delete Smartlead

**Files:**
- Modify: `packages/email-infra/src/index.ts`
- Delete: `packages/email-infra/src/smartlead.ts`, `packages/email-infra/src/smartlead.test.ts`

- [ ] **Step 1: Delete Smartlead** — `git rm packages/email-infra/src/smartlead.ts packages/email-infra/src/smartlead.test.ts`

- [ ] **Step 2: Rewrite `index.ts`**

```ts
export * from "./types";
export { InMemoryEmailInfra } from "./in-memory";
export { MaildosoEmailInfra } from "./maildoso/index";
export { MaildosoApiClient } from "./maildoso/api-client";

import type { EmailInfra, GetSmtpCreds } from "./types";
import { MaildosoEmailInfra } from "./maildoso/index";
import { MaildosoApiClient } from "./maildoso/api-client";
import { NodemailerTransport } from "./maildoso/nodemailer-transport";

/** The only construction point product code may use (white-label, rule 03).
 *  Pass `getSmtpCreds` from the jobs layer for the send path; omit it for provision-only callers. */
export function createEmailInfraFromEnv(opts?: { getSmtpCreds?: GetSmtpCreds }): EmailInfra {
  const apiKey = process.env.MAILDOSO_API_KEY;
  const webhookSecret = process.env.OWNED_EMAIL_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) throw new Error("email infra env vars missing (MAILDOSO_API_KEY, OWNED_EMAIL_WEBHOOK_SECRET)");
  return new MaildosoEmailInfra({
    api: new MaildosoApiClient({ apiKey }),
    webhookSecret,
    transport: new NodemailerTransport(),
    getSmtpCreds: opts?.getSmtpCreds,
  });
}
```

- [ ] **Step 3: Type-check + test the package** — `pnpm --filter @vantera/email-infra type-check && pnpm --filter @vantera/email-infra test` → all PASS, no Smartlead references.

- [ ] **Step 4: Commit** — `git add packages/email-infra/src && git commit -m "feat(email-infra): Maildoso factory; delete Smartlead adapter"`

---

## Task 9: Migration 0021 + schema columns + grant guardrail

**Files:**
- Create: `packages/db/migrations/0021_mailbox_smtp_secret.sql`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/schema.test.ts`

- [ ] **Step 1: Write the migration** (`0021_mailbox_smtp_secret.sql`)

```sql
-- Maildoso per-mailbox SMTP credentials. smtp_secret is an AES-256-GCM blob (iv:tag:ct).
-- Server-managed: provisioning writes these via the service role in a Trigger task; clients
-- never read or write them (RLS already scopes mailboxes per account; no column grant to authenticated).
ALTER TABLE mailboxes
  ADD COLUMN smtp_secret text,
  ADD COLUMN smtp_host text,
  ADD COLUMN smtp_port integer,
  ADD COLUMN smtp_username text;

-- Explicitly deny client access to the secret columns (defense-in-depth alongside RLS).
REVOKE ALL (smtp_secret, smtp_host, smtp_port, smtp_username) ON mailboxes FROM authenticated, anon;
```

- [ ] **Step 2: Add columns to `schema.ts`** — inside the `mailboxes` `pgTable` column block (after `dailySendLimit`):

```ts
    smtpSecret: text("smtp_secret"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpUsername: text("smtp_username"),
```

- [ ] **Step 3: Write the grant guardrail test** — in `schema.test.ts`, mirroring the existing `0013` grant test, assert `0021` revokes the secret columns from `authenticated`:

```ts
it("0021 revokes mailbox SMTP secret columns from clients", () => {
  const sql = readFileSync(join(MIGRATIONS, "0021_mailbox_smtp_secret.sql"), "utf8");
  expect(sql).toMatch(/REVOKE ALL \(smtp_secret, smtp_host, smtp_port, smtp_username\) ON mailboxes FROM authenticated/);
});
```

(Use the same `MIGRATIONS`/`readFileSync` setup already imported at the top of `schema.test.ts`.)

- [ ] **Step 4: Run tests** — `pnpm --filter @vantera/db test` → PASS.

- [ ] **Step 5: Commit** — `git add packages/db/migrations/0021_mailbox_smtp_secret.sql packages/db/src/schema.ts packages/db/src/schema.test.ts && git commit -m "feat(db): 0021 mailbox SMTP secret columns (server-managed)"`

---

## Task 10: pg-store SMTP secret persistence

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts`
- Test: `packages/jobs/src/pipeline/pg-store.test.ts`

- [ ] **Step 1: Add store-method signatures to `types.ts`** (the store interface). Add:

```ts
  /** Persist provisioned mailboxes with their SMTP secret encrypted at rest. */
  saveProvisionedMailboxes(accountId: string, mailboxes: ProvisionedMailbox[]): Promise<void>;
  /** Decrypt and return a mailbox's SMTP creds for the send path. */
  getMailboxSmtpCreds(mailboxId: string): Promise<SmtpCredentials>;
  /** Purge SMTP secrets + provider refs for an account's mailboxes (deprovision). Returns provider refs. */
  collectMailboxProviderRefs(accountId: string): Promise<{ providerRef: string; domain: string }[]>;
```

Import `ProvisionedMailbox`, `SmtpCredentials` from `@vantera/email-infra` at the top of `types.ts`.

- [ ] **Step 2: Write the failing test** in `pg-store.test.ts` using the existing fake-db harness — assert encrypt-on-save / decrypt-on-read round-trips and that the stored blob is not plaintext:

```ts
it("round-trips SMTP creds encrypted (save then get)", async () => {
  process.env.OWNED_EMAIL_SECRET_KEY = "11".repeat(32);
  const store = createPgStore(db);
  await store.saveProvisionedMailboxes("acc_1", [{
    id: "mbx_1", address: "sdr0@d.com", domain: "d.com",
    smtp: { host: "h", port: 587, username: "sdr0@d.com", password: "secretpw" },
  }]);
  const row = db._table("mailboxes").find((r: any) => r.provider_ref === "mbx_1");
  expect(row.smtp_secret).not.toContain("secretpw");
  expect(await store.getMailboxSmtpCreds(row.id)).toMatchObject({ username: "sdr0@d.com", password: "secretpw" });
});
```

(Adapt `db._table` to the existing fake-db accessor used elsewhere in `pg-store.test.ts`.)

- [ ] **Step 3: Run it, verify it fails** — `pnpm --filter @vantera/jobs test pg-store` → FAIL.

- [ ] **Step 4: Implement in `pg-store.ts`** — add the three methods. Use `encryptSecret`/`decryptSecret` from `@vantera/email-infra` and `process.env.OWNED_EMAIL_SECRET_KEY`:

```ts
import { encryptSecret, decryptSecret } from "@vantera/email-infra";

function secretKey(): string {
  const k = process.env.OWNED_EMAIL_SECRET_KEY;
  if (!k) throw new Error("OWNED_EMAIL_SECRET_KEY is required for mailbox SMTP secrets");
  return k;
}

// inside createPgStore(db) return object:
async saveProvisionedMailboxes(accountId, mailboxes) {
  for (const m of mailboxes) {
    await db.insert(schema.mailboxes).values({
      accountId, emailAddress: m.address, domain: m.domain, providerRef: m.id, status: "warming",
      smtpSecret: m.smtp ? encryptSecret(m.smtp.password, secretKey()) : null,
      smtpHost: m.smtp?.host ?? null, smtpPort: m.smtp?.port ?? null, smtpUsername: m.smtp?.username ?? null,
    });
  }
},
async getMailboxSmtpCreds(mailboxId) {
  const [row] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.id, mailboxId)).limit(1);
  if (!row?.smtpSecret || !row.smtpHost || !row.smtpPort || !row.smtpUsername) {
    throw new Error(`mailbox ${mailboxId} has no SMTP credentials`);
  }
  return { host: row.smtpHost, port: row.smtpPort, username: row.smtpUsername, password: decryptSecret(row.smtpSecret, secretKey()) };
},
async collectMailboxProviderRefs(accountId) {
  const rows = await db.select({ providerRef: schema.mailboxes.providerRef, domain: schema.mailboxes.domain })
    .from(schema.mailboxes).where(eq(schema.mailboxes.accountId, accountId));
  return rows.filter((r) => r.providerRef).map((r) => ({ providerRef: r.providerRef!, domain: r.domain ?? "" }));
},
```

- [ ] **Step 5: Run it, verify PASS** — `pnpm --filter @vantera/jobs test pg-store` → PASS.

- [ ] **Step 6: Commit** — `git add packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.* && git commit -m "feat(jobs): pg-store SMTP secret persistence (encrypt/decrypt)"`

---

## Task 11: provision-email pipeline core

**Files:**
- Create: `packages/jobs/src/pipeline/provision-email.ts`
- Test: `packages/jobs/src/pipeline/provision-email.test.ts`

- [ ] **Step 1: Write the test** (`provision-email.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { runProvisionEmail } from "./provision-email";
import { InMemoryEmailInfra } from "@vantera/email-infra";

describe("runProvisionEmail", () => {
  it("provisions and persists mailboxes for the account", async () => {
    const saved: any[] = [];
    const store = { saveProvisionedMailboxes: vi.fn(async (_a: string, m: any[]) => { saved.push(...m); }) };
    const out = await runProvisionEmail(
      { accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 2 },
      { store: store as any, emailInfra: new InMemoryEmailInfra() }
    );
    expect(out.created).toBe(2);
    expect(store.saveProvisionedMailboxes).toHaveBeenCalledOnce();
    expect(saved[0].smtp.password).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/jobs test provision-email` → FAIL.

- [ ] **Step 3: Implement** (`provision-email.ts`)

```ts
import type { EmailInfra } from "@vantera/email-infra";

export interface ProvisionEmailPayload { accountId: string; domainCount: number; mailboxesPerDomain: number; }
export interface ProvisionEmailDeps {
  store: { saveProvisionedMailboxes(accountId: string, mailboxes: Awaited<ReturnType<EmailInfra["provision"]>>): Promise<void> };
  emailInfra: EmailInfra;
}

/** Provision domains + mailboxes via the provider, persist them (SMTP secret encrypted by the store). */
export async function runProvisionEmail(payload: ProvisionEmailPayload, deps: ProvisionEmailDeps): Promise<{ created: number }> {
  const mailboxes = await deps.emailInfra.provision({
    accountId: payload.accountId, domainCount: payload.domainCount, mailboxesPerDomain: payload.mailboxesPerDomain,
  });
  await deps.store.saveProvisionedMailboxes(payload.accountId, mailboxes);
  return { created: mailboxes.length };
}
```

- [ ] **Step 4: Run it, verify PASS** — `pnpm --filter @vantera/jobs test provision-email` → PASS.

- [ ] **Step 5: Commit** — `git add packages/jobs/src/pipeline/provision-email.* && git commit -m "feat(jobs): provision-email pipeline core"`

---

## Task 12: provision-email trigger wrapper

**Files:**
- Create: `packages/jobs/src/trigger/provision-email.ts`

- [ ] **Step 1: Write the wrapper** (thin; logic lives in the core — structure.test.ts enforces this):

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { runProvisionEmail, type ProvisionEmailPayload } from "../pipeline/provision-email";
import { createPgStore } from "../pipeline/pg-store";

/** Durable email provisioning (domain + N mailboxes). Long, retryable work — never in a route (rule 10). */
export const provisionEmail = task({
  id: "provision-email",
  maxDuration: 600,
  run: async (payload: ProvisionEmailPayload) => {
    const store = createPgStore(createDb());
    const outcome = await runProvisionEmail(payload, { store, emailInfra: createEmailInfraFromEnv() });
    logger.info("email provisioned", { accountId: payload.accountId, ...outcome });
    return outcome;
  },
});
```

- [ ] **Step 2: Run the structure guard** — `pnpm --filter @vantera/jobs test structure` → PASS (wrapper imports its core).

- [ ] **Step 3: Commit** — `git add packages/jobs/src/trigger/provision-email.ts && git commit -m "feat(jobs): provision-email durable trigger task"`

---

## Task 13: Channels action enqueues provisioning

**Files:**
- Modify: `apps/web/src/app/(app)/settings/channels/actions.ts:120-181`

- [ ] **Step 1: Replace the inline provision** in `provisionEmailSending`. Keep the existing fast gates (`validateProvisionCounts`, `canProvision`, plan `gate`, account/`sender_address` resolution). Replace the `createEmailInfraFromEnv().provision(...)` + `supabase.from("mailboxes").insert(rows)` block with an enqueue:

```ts
import { tasks } from "@trigger.dev/sdk";
// ...after the gates pass and `account.id` is resolved from the session:
await tasks.trigger("provision-email", {
  accountId: account.id,
  domainCount,
  mailboxesPerDomain,
});
return { success: "Email setup started — your mailboxes will appear here as they finish provisioning and begin warming up." };
```

Remove the now-unused `createEmailInfraFromEnv` import from this file.

- [ ] **Step 2: Type-check the app** — `pnpm --filter web type-check` → clean.

- [ ] **Step 3: Update the validation test** if one asserted the old success string — `pnpm --filter web test channels` → PASS.

- [ ] **Step 4: Commit** — `git add "apps/web/src/app/(app)/settings/channels/actions.ts" && git commit -m "feat(web): channels provisioning enqueues durable task"`

---

## Task 14: Wire getSmtpCreds into the send path

**Files:**
- Modify: `packages/jobs/src/trigger/outreach-send.ts`

- [ ] **Step 1: Pass the store-backed callback** into the factory:

```ts
    const store = createPgStore(createDb());
    const outcome = await runOutreachSend(payload, {
      store,
      emailInfra: createEmailInfraFromEnv({ getSmtpCreds: (mailboxId) => store.getMailboxSmtpCreds(mailboxId) }),
      linkedinInfra: createLinkedInInfraFromEnv(),
      appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
```

- [ ] **Step 2: Type-check** — `pnpm --filter @vantera/jobs type-check` → clean.

- [ ] **Step 3: Run send tests** — `pnpm --filter @vantera/jobs test outreach-send` → PASS (suppression boundary intact).

- [ ] **Step 4: Commit** — `git add packages/jobs/src/trigger/outreach-send.ts && git commit -m "feat(jobs): wire mailbox SMTP creds into the send path"`

---

## Task 15: Deprovision-on-cancel (COGS + compliance)

**Files:**
- Create: `packages/jobs/src/pipeline/deprovision.ts` (+ `.test.ts`)
- Create: `packages/jobs/src/trigger/deprovision-account.ts`
- Modify: `packages/jobs/src/trigger/process-account-deletion.ts` (vendor-cleanup hook)
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Write the core test** (`deprovision.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { runDeprovisionAccount } from "./deprovision";

describe("runDeprovisionAccount", () => {
  it("deletes each mailbox + releases each domain, then purges secrets", async () => {
    const api = { deleteMailbox: vi.fn(async () => {}), releaseDomain: vi.fn(async () => {}) };
    const store = {
      collectMailboxProviderRefs: vi.fn(async () => [{ providerRef: "mbx_1", domain: "d.com" }, { providerRef: "mbx_2", domain: "d.com" }]),
      purgeMailboxes: vi.fn(async () => {}),
    };
    await runDeprovisionAccount({ accountId: "acc_1" }, { api: api as any, store: store as any });
    expect(api.deleteMailbox).toHaveBeenCalledTimes(2);
    expect(api.releaseDomain).toHaveBeenCalledTimes(1); // unique domains
    expect(store.purgeMailboxes).toHaveBeenCalledWith("acc_1");
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `pnpm --filter @vantera/jobs test deprovision` → FAIL.

- [ ] **Step 3: Implement the core** (`deprovision.ts`)

```ts
import type { MaildosoApiClient } from "@vantera/email-infra";

export interface DeprovisionDeps {
  api: Pick<MaildosoApiClient, "deleteMailbox" | "releaseDomain">;
  store: { collectMailboxProviderRefs(accountId: string): Promise<{ providerRef: string; domain: string }[]>; purgeMailboxes(accountId: string): Promise<void> };
}

/** Delete the account's mailboxes + release its domains at the provider, then purge local rows/secrets. */
export async function runDeprovisionAccount(payload: { accountId: string }, deps: DeprovisionDeps): Promise<void> {
  const refs = await deps.store.collectMailboxProviderRefs(payload.accountId);
  for (const r of refs) await deps.api.deleteMailbox(r.providerRef);
  for (const domain of new Set(refs.map((r) => r.domain).filter(Boolean))) await deps.api.releaseDomain(domain);
  await deps.store.purgeMailboxes(payload.accountId);
}
```

- [ ] **Step 4: Add `purgeMailboxes`** to `pg-store.ts` (deletes the account's mailbox rows; secrets go with them) + its signature in `types.ts`:

```ts
async purgeMailboxes(accountId) {
  await db.delete(schema.mailboxes).where(eq(schema.mailboxes.accountId, accountId));
},
```

- [ ] **Step 5: Run it, verify PASS** — `pnpm --filter @vantera/jobs test deprovision` → PASS.

- [ ] **Step 6: Write the trigger wrapper** (`deprovision-account.ts`)

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv, MaildosoApiClient } from "@vantera/email-infra";
import { createPgStore } from "../pipeline/pg-store";
import { runDeprovisionAccount } from "../pipeline/deprovision";

export const deprovisionAccount = task({
  id: "deprovision-account",
  maxDuration: 300,
  run: async (payload: { accountId: string }) => {
    const store = createPgStore(createDb());
    const api = new MaildosoApiClient({ apiKey: process.env.MAILDOSO_API_KEY! });
    await runDeprovisionAccount(payload, { api, store });
    logger.info("account email deprovisioned", { accountId: payload.accountId });
  },
});
```

(Keep the `createEmailInfraFromEnv` import only if used; otherwise import just `MaildosoApiClient`.)

- [ ] **Step 7: Hook the deletion path** — in `process-account-deletion.ts`, replace the "no vendors connected yet" log with `await tasks.trigger("deprovision-account", { accountId: request.account_id })` (import `tasks`), before the hard delete.

- [ ] **Step 8: Hook billing cancel/downgrade** — in `stripe/route.ts`, where a subscription becomes `canceled`/lapsed (today: sets `outreach_paused`), also enqueue `await tasks.trigger("deprovision-account", { accountId })`. **Downgrade nuance:** only deprovision the *excess* mailboxes over the new plan's cap. For this pass, deprovision on full cancel/lapse only; leave a `// TODO(downgrade): partial deprovision to new cap` is NOT allowed — instead gate it: enqueue only when the new plan has zero mailbox entitlement, else skip. Implement that conditional inline.

- [ ] **Step 9: Tests + commit** — `pnpm --filter @vantera/jobs test deprovision && pnpm --filter web type-check` → PASS. `git add -A && git commit -m "feat(jobs): deprovision-on-cancel (delete mailboxes + release domains + purge)"`

---

## Task 16: Verify the email webhook route

**Files:**
- Verify: `apps/web/src/app/api/webhooks/email/route.ts`

- [ ] **Step 1: Read the route** and confirm it builds the adapter via `createEmailInfraFromEnv()` and calls `verifyWebhook(headers, rawBody)` then `parseEventWebhook(JSON.parse(body))`. With Maildoso as the factory provider, the route works unchanged. If it referenced Smartlead-specific header names directly (it should not — that lives in the adapter), remove that coupling.

- [ ] **Step 2: Run the route's test (if present)** — `pnpm --filter web test webhooks/email` → PASS. If the test posts a Smartlead-shaped header, update it to `x-maildoso-secret` and the Maildoso event shape.

- [ ] **Step 3: Commit** (only if changed) — `git add apps/web/src/app/api/webhooks/email && git commit -m "test(web): email webhook uses Maildoso shape"`

---

## Task 17: Env manifest + help content

**Files:**
- Modify: `.env.example`
- Modify: `packages/help-content/content/channels-email.md` (or the existing email-provisioning article)

- [ ] **Step 1: `.env.example`** — remove `SMARTLEAD_API_KEY` and `SMARTLEAD_WEBHOOK_SECRET`; add under the email-infra section:

```bash
# Maildoso — app.maildoso.ai → Settings → API (email-infra; single provider: domains+mailboxes+SMTP+warmup)
MAILDOSO_API_KEY=
# AES-256-GCM key (32-byte hex) encrypting per-mailbox SMTP passwords at rest
OWNED_EMAIL_SECRET_KEY=
# Shared secret for inbound webhook verification (x-maildoso-secret header)
OWNED_EMAIL_WEBHOOK_SECRET=
```

- [ ] **Step 2: Help article** — update the email-provisioning article so copy reflects owned provisioning (mailboxes warm up automatically, ~15/day cap, no vendor name — rule 03 white-label). Run `pnpm --filter @vantera/help-content test` (whitelabel/article tests) → PASS.

- [ ] **Step 3: Commit** — `git add .env.example packages/help-content && git commit -m "docs: Maildoso env manifest + email provisioning help copy"`

---

## Task 18: Full gate + audits

- [ ] **Step 1: Full gate** — `pnpm lint && pnpm type-check && pnpm test && pnpm build` → all green. (`next build` may need network for fonts; run web build where fonts are reachable.)
- [ ] **Step 2: rls-auditor** on the `0021` diff (note the column REVOKE).
- [ ] **Step 3: whitelabel-auditor** on `/settings/channels` + the help article — assert no "Maildoso" / "Smartlead" on any user surface.
- [ ] **Step 4: Confirm suppression test still passes** — `pnpm --filter @vantera/jobs test copy-draft outreach-send` → suppression-at-boundary green.
- [ ] **Step 5: Commit any audit fixes**, then push the branch and open a PR titled `Maildoso single-provider email`.

---

## Activation checklist (post-merge, needs the subscription — NOT code)
1. Subscribe to Maildoso; set `MAILDOSO_API_KEY` in Vercel + Trigger.dev.
2. Generate + set `OWNED_EMAIL_SECRET_KEY` (`openssl rand -hex 32`) and `OWNED_EMAIL_WEBHOOK_SECRET` in both.
3. Open `developers.maildoso.com`; confirm the 8 endpoint shapes against `api-client.ts` (auth header, base URL, domain/mailbox/warmup/delete paths, response fields, webhook vs IMAP). Adjust only `api-client.ts` (+ `parseEventWebhook` field names if webhooks exist; otherwise schedule the IMAP-poll fast-follow).
4. `pnpm --filter @vantera/jobs exec trigger deploy` (or the release flow) so `provision-email` / `deprovision-account` are live.
5. Live smoke: provision 1 mailbox → confirm row + warming status → send to a seed inbox → reply → confirm inbound event → forged-secret webhook returns 401.
```

## Self-Review

**Spec coverage:** provider decision (T8 delete Smartlead, T6–8 Maildoso) ✓; per-mailbox SMTP Option 1 (T2,4,10,14) ✓; schema/grants (T9) ✓; provisioning front door → durable task (T11–13) ✓; send + List-Unsubscribe + footer (T7,14 — footer already applied upstream in `outreach-send`/`email-footer.ts`) ✓; inbound webhook + IMAP fallback flagged (T7,16 + activation #3) ✓; deprovision-on-cancel (T15) ✓; warmup gating (unchanged upstream; `warmupStatus` reads Maildoso, T7) ✓; env + help + white-label (T17,18) ✓; testing/TDD throughout ✓.

**Type consistency:** `ProvisionedMailbox`/`GetSmtpCreds`/`SmtpCredentials` defined in T4, used consistently in T5/7/10/11; `MaildosoApiClient` method names (`ensureDomain`, `createMailbox`, `getWarmup`, `deleteMailbox`, `releaseDomain`) match across T6/7/15; store methods (`saveProvisionedMailboxes`, `getMailboxSmtpCreds`, `collectMailboxProviderRefs`, `purgeMailboxes`) match across T10/11/15.

**Placeholder scan:** the only deferred items are the `CONFIRM ON ACTIVATION` endpoint constants — externally blocked by design, isolated to `api-client.ts`, with concrete best-effort code so every step is runnable now. T15 Step 8 explicitly forbids a TODO and requires the conditional inline.

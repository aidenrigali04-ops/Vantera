# Owned Email Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-built email provider (`OwnedEmailInfra`) behind the existing `email-infra` interface that buys domains (Cloudflare), writes DNS, provisions Google Workspace mailboxes, and outsources only warmup — so cold outreach sends from domains/mailboxes Vantera owns, with all product code unchanged.

**Architecture:** A new `packages/email-infra/src/owned/` adapter composes four injected sub-layers (`registrar`, `dns`, `mailbox`, `warmup`), each with its own interface + in-memory fake + real adapter. `OwnedEmailInfra.provision()` orchestrates the six provisioning steps and returns `Mailbox[]` (id = email address). `createEmailInfraFromEnv()` switches provider on `EMAIL_PROVIDER`. A Trigger.dev provisioning task persists results into a new `sending_domains` table + the existing `mailboxes` table. The pipeline, scheduler, send path, suppression boundary, and webhook handlers are untouched.

**Tech Stack:** TypeScript (strict), Vitest, Drizzle + Supabase Postgres (RLS), Trigger.dev v4, Cloudflare API (registrar + DNS), Google Admin SDK Directory API + Gmail API, a warmup-network API (e.g. Mailreach/Warmy), Next.js App Router (settings UI).

**Provider/key facts that every task relies on:**
- `EmailInfra` interface lives in `packages/email-infra/src/types.ts` — **do not change it**. Methods: `provision`, `send`, `warmupStatus`, `verifyWebhook`, `parseEventWebhook`. Types: `Mailbox {id,address,domain}`, `ProvisionRequest {accountId,domainCount,mailboxesPerDomain}`, `OutboundEmail`, `SendResult {messageId,sentAt}`, `WarmupStatus {mailboxId,phase,dailyCap}`, `EmailEvent` (union).
- The owned adapter uses **the mailbox email address as the `Mailbox.id` / `provider_ref`** so send (`users.messages.send` userId), `warmupStatus(id)`, and inbound `mailboxRef` all key off the same value. `pg-store.findMailboxByProviderRef` already matches inbound events by `provider_ref`.
- Vendor names (Cloudflare/Google/warmup) NEVER appear on user-facing surfaces (white-label, rules 03–05).
- Run `/vantera-db-migrations` discipline for Task 1; new tables get RLS in the same migration with a guardrail test.
- Test style: mirror `packages/email-infra/src/smartlead.test.ts` — `fetchMock`/`fetchError` helpers, inject `fetchFn`.

---

## File structure (created / modified)

```
packages/db/migrations/0017_owned_email_infra.sql      CREATE — sending_domains, infra_workspace_tenants, mailboxes.domain_id
packages/db/src/schema.ts                               MODIFY — add tables + column, relations
packages/db/src/schema.test.ts                          MODIFY — RLS guardrail for sending_domains

packages/email-infra/src/owned/registrar.ts             CREATE — DomainRegistrar interface + InMemoryRegistrar + CloudflareRegistrar
packages/email-infra/src/owned/registrar.test.ts        CREATE
packages/email-infra/src/owned/dns.ts                   CREATE — DnsManager interface + InMemoryDns + CloudflareDns
packages/email-infra/src/owned/dns.test.ts              CREATE
packages/email-infra/src/owned/mailbox.ts               CREATE — MailboxProvisioner interface + InMemoryMailboxProvisioner + GoogleMailboxProvisioner
packages/email-infra/src/owned/mailbox.test.ts          CREATE
packages/email-infra/src/owned/warmup.ts                CREATE — WarmupService interface + InMemoryWarmup + ApiWarmup
packages/email-infra/src/owned/warmup.test.ts           CREATE
packages/email-infra/src/owned/gmail-send.ts            CREATE — GmailSender interface + InMemoryGmailSender + GoogleGmailSender
packages/email-infra/src/owned/gmail-send.test.ts       CREATE
packages/email-infra/src/owned/index.ts                 CREATE — OwnedEmailInfra implements EmailInfra (orchestration)
packages/email-infra/src/owned/index.test.ts            CREATE
packages/email-infra/src/index.ts                       MODIFY — export owned; EMAIL_PROVIDER switch in createEmailInfraFromEnv
packages/email-infra/src/factory.test.ts                CREATE — provider switch test

packages/jobs/src/pipeline/provision-email.ts           CREATE — pure orchestration: call infra.provision → persist
packages/jobs/src/pipeline/provision-email.test.ts      CREATE
packages/jobs/src/pipeline/types.ts                     MODIFY — ProvisionEmailStore/Deps/Summary
packages/jobs/src/pipeline/pg-store.ts                  MODIFY — provision persistence methods
packages/jobs/src/trigger/provision-email.ts            CREATE — thin Trigger task wrapper

apps/web/src/app/(app)/settings/channels/actions.ts     MODIFY — suggestDomains + startEmailProvisioning actions
apps/web/src/app/(app)/settings/channels/*              MODIFY — domain suggest/confirm UI + warmup status list

packages/help-content/content/channels-setup.md         MODIFY — owned-provisioning UX copy (knowledge-sync, rule 09)

.env.example                                            MODIFY — EMAIL_PROVIDER, CLOUDFLARE_API_TOKEN, GOOGLE_* , WARMUP_API_KEY
```

> **Note on `index.ts`:** the current env factory lives at the bottom of `packages/email-infra/src/smartlead.ts` (`createEmailInfraFromEnv`). Task 5 moves it to a dedicated `index.ts` barrel. If the package has no `index.ts` yet, create it and re-export `./types`, `./in-memory`, `./smartlead`, `./owned`.

---

## Task 1: Migration — `sending_domains`, `infra_workspace_tenants`, `mailboxes.domain_id`

**Files:**
- Create: `packages/db/migrations/0017_owned_email_infra.sql`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/db/src/schema.test.ts`

- [ ] **Step 1: Write the failing RLS guardrail test**

In `packages/db/src/schema.test.ts`, add to the existing RLS-coverage describe block (match the file's existing helper that asserts a table has RLS + member-select / admin-manage policies — mirror the `mailboxes` assertion already there):

```ts
it("sending_domains has RLS with member select + admin manage", () => {
  const sql = readMigration("0017_owned_email_infra.sql");
  expect(sql).toMatch(/alter table public\.sending_domains enable row level security/);
  expect(sql).toMatch(/create policy sending_domains_select[\s\S]*is_account_member\(account_id\)/);
  expect(sql).toMatch(/create policy sending_domains_manage[\s\S]*is_account_admin\(account_id\)/);
});

it("infra_workspace_tenants has RLS enabled with no authenticated policy (service-role only)", () => {
  const sql = readMigration("0017_owned_email_infra.sql");
  expect(sql).toMatch(/alter table public\.infra_workspace_tenants enable row level security/);
  expect(sql).not.toMatch(/create policy infra_workspace_tenants_\w+ on public\.infra_workspace_tenants[\s\S]*to authenticated/);
});
```

> If `readMigration` does not already exist in the test file, add a tiny helper: `const readMigration = (f: string) => readFileSync(join(__dirname, "../migrations", f), "utf8");` (import `readFileSync` from `node:fs`, `join` from `node:path`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/db test -- schema.test.ts`
Expected: FAIL — migration file 0017 does not exist (ENOENT) or assertions unmatched.

- [ ] **Step 3: Write the migration**

Create `packages/db/migrations/0017_owned_email_infra.sql`:

```sql
-- Migration #17: owned email infrastructure (rule 03). Self-built provider — Vantera owns
-- domains + DNS + Google Workspace mailboxes; warmup outsourced. Vendor-neutral columns (white-label).

-- per-account sending domains (tenant-scoped, RLS)
create table public.sending_domains (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  domain text not null,
  status text not null check (status in ('verifying', 'active', 'error')) default 'verifying',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sending_domains_account_domain_idx on public.sending_domains (account_id, domain);
create index sending_domains_account_status_idx on public.sending_domains (account_id, status);

alter table public.sending_domains enable row level security;

create policy sending_domains_select on public.sending_domains
  for select to authenticated using (public.is_account_member(account_id));
create policy sending_domains_manage on public.sending_domains
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger sending_domains_set_updated_at
  before update on public.sending_domains
  for each row execute function public.set_updated_at();

-- link mailboxes to their sending domain
alter table public.mailboxes
  add column domain_id uuid references public.sending_domains(id) on delete set null;
create index mailboxes_domain_idx on public.mailboxes (domain_id);

-- Vantera-owned Google Workspace tenant pool that purchased domains are attached to.
-- Internal infra config, NOT customer data: RLS enabled with NO authenticated policy,
-- so only the service role (jobs) can read/write it.
create table public.infra_workspace_tenants (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  customer_domain_count integer not null default 0,
  domain_cap integer not null default 20,
  created_at timestamptz not null default now()
);

alter table public.infra_workspace_tenants enable row level security;
```

- [ ] **Step 4: Mirror the schema in Drizzle**

In `packages/db/src/schema.ts`, after the `mailboxes` table definition (~line 423) add:

```ts
export const sendingDomains = pgTable(
  "sending_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    status: text("status", { enum: ["verifying", "active", "error"] })
      .notNull()
      .default("verifying"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sending_domains_account_domain_idx").on(t.accountId, t.domain),
    index("sending_domains_account_status_idx").on(t.accountId, t.status),
  ]
);

export const infraWorkspaceTenants = pgTable("infra_workspace_tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  customerDomainCount: integer("customer_domain_count").notNull().default(0),
  domainCap: integer("domain_cap").notNull().default(20),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Then add `domainId` to the existing `mailboxes` column block:

```ts
    domainId: uuid("domain_id").references(() => sendingDomains.id, { onDelete: "set null" }),
```

(place it next to `domain`, and add `index("mailboxes_domain_idx").on(t.domainId)` to the mailboxes index array.)

- [ ] **Step 5: Run the guardrail test to verify it passes**

Run: `pnpm --filter @vantera/db test -- schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check the db package**

Run: `pnpm --filter @vantera/db type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/migrations/0017_owned_email_infra.sql packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "feat(db): sending_domains + infra_workspace_tenants + mailboxes.domain_id (owned email infra)"
```

---

## Task 2: Sub-layer interfaces + in-memory fakes

Each sub-layer is a tiny interface with an in-memory fake (the rule-13 provider pattern). Real adapters come in Task 4. Build all four fakes first so the orchestrator (Task 3) is testable.

**Files:**
- Create: `packages/email-infra/src/owned/registrar.ts`, `dns.ts`, `mailbox.ts`, `warmup.ts`, `gmail-send.ts` (+ matching `.test.ts`)

- [ ] **Step 1: Write failing tests for the fakes**

`packages/email-infra/src/owned/registrar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryRegistrar } from "./registrar";

describe("InMemoryRegistrar", () => {
  it("reports availability and records purchases", async () => {
    const r = new InMemoryRegistrar({ taken: ["taken.com"] });
    expect(await r.isAvailable("free.com")).toBe(true);
    expect(await r.isAvailable("taken.com")).toBe(false);
    await r.buy("free.com");
    expect(r.purchased).toContain("free.com");
    await expect(r.buy("taken.com")).rejects.toThrow(/unavailable/);
  });
});
```

`packages/email-infra/src/owned/dns.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryDns } from "./dns";

describe("InMemoryDns", () => {
  it("writes the email auth record set for a domain", async () => {
    const dns = new InMemoryDns();
    await dns.writeEmailRecords("acme.com", { dkimName: "google._domainkey", dkimValue: "v=DKIM1; k=rsa; p=AAAA" });
    const records = dns.recordsFor("acme.com");
    expect(records.find((r) => r.type === "MX")?.value).toContain("aspmx.l.google.com");
    expect(records.some((r) => r.type === "TXT" && r.value.includes("v=spf1") && r.value.includes("_spf.google.com"))).toBe(true);
    expect(records.some((r) => r.type === "TXT" && r.name.startsWith("_dmarc"))).toBe(true);
    expect(records.some((r) => r.type === "TXT" && r.name === "google._domainkey")).toBe(true);
  });
});
```

`packages/email-infra/src/owned/mailbox.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryMailboxProvisioner } from "./mailbox";

describe("InMemoryMailboxProvisioner", () => {
  it("adds+verifies a domain and creates users, returning addresses", async () => {
    const p = new InMemoryMailboxProvisioner();
    const dkim = await p.addAndVerifyDomain("acme.com");
    expect(dkim.dkimName).toBeTruthy();
    const created = await p.createUsers("acme.com", ["sdr0", "sdr1"]);
    expect(created).toEqual(["sdr0@acme.com", "sdr1@acme.com"]);
    expect(p.verifiedDomains).toContain("acme.com");
  });
});
```

`packages/email-infra/src/owned/warmup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryWarmup } from "./warmup";

describe("InMemoryWarmup", () => {
  it("enrolls a mailbox and reports warming then ready", async () => {
    const w = new InMemoryWarmup();
    await w.enroll("sdr0@acme.com");
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "warming", dailyCap: 10 });
    w.markReady("sdr0@acme.com", 50);
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "ready", dailyCap: 50 });
  });
});
```

`packages/email-infra/src/owned/gmail-send.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryGmailSender } from "./gmail-send";

describe("InMemoryGmailSender", () => {
  it("records the send and returns a message id", async () => {
    const s = new InMemoryGmailSender();
    const res = await s.sendRaw("sdr0@acme.com", { to: "lead@x.com", subject: "Hi", body: "Body", headers: {} });
    expect(res.messageId).toBeTruthy();
    expect(s.sent[0]).toMatchObject({ from: "sdr0@acme.com", to: "lead@x.com" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vantera/email-infra test -- owned/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the interfaces + fakes**

`packages/email-infra/src/owned/registrar.ts`:

```ts
/** Buys/owns domains. Cloudflare Registrar in prod; vendor-neutral here. */
export interface DomainRegistrar {
  isAvailable(domain: string): Promise<boolean>;
  buy(domain: string): Promise<void>;
}

export class InMemoryRegistrar implements DomainRegistrar {
  readonly purchased: string[] = [];
  private readonly taken: Set<string>;
  constructor(opts: { taken?: string[] } = {}) {
    this.taken = new Set(opts.taken ?? []);
  }
  async isAvailable(domain: string): Promise<boolean> {
    return !this.taken.has(domain) && !this.purchased.includes(domain);
  }
  async buy(domain: string): Promise<void> {
    if (!(await this.isAvailable(domain))) throw new Error(`domain unavailable: ${domain}`);
    this.purchased.push(domain);
  }
}
```

`packages/email-infra/src/owned/dns.ts`:

```ts
export interface DnsRecord { type: "MX" | "TXT" | "CNAME"; name: string; value: string; priority?: number }
export interface DkimRecord { dkimName: string; dkimValue: string }

/** Writes the Google-Workspace email auth record set for a domain. */
export interface DnsManager {
  writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void>;
}

/** Shared record builder so the fake and the real adapter stay identical. */
export function buildEmailRecords(domain: string, dkim: DkimRecord): DnsRecord[] {
  return [
    { type: "MX", name: domain, value: "aspmx.l.google.com", priority: 1 },
    { type: "MX", name: domain, value: "alt1.aspmx.l.google.com", priority: 5 },
    { type: "TXT", name: domain, value: "v=spf1 include:_spf.google.com ~all" },
    { type: "TXT", name: dkim.dkimName, value: dkim.dkimValue },
    { type: "TXT", name: `_dmarc.${domain}`, value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@" + domain },
  ];
}

export class InMemoryDns implements DnsManager {
  private readonly records = new Map<string, DnsRecord[]>();
  async writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void> {
    this.records.set(domain, buildEmailRecords(domain, dkim));
  }
  recordsFor(domain: string): DnsRecord[] {
    return this.records.get(domain) ?? [];
  }
}
```

`packages/email-infra/src/owned/mailbox.ts`:

```ts
import type { DkimRecord } from "./dns";

/** Creates + verifies a domain on a Workspace tenant and provisions users. */
export interface MailboxProvisioner {
  /** add domain to a tenant, publish/verify, return its DKIM record for DNS */
  addAndVerifyDomain(domain: string): Promise<DkimRecord>;
  /** create users (local-parts) on a verified domain; returns full addresses */
  createUsers(domain: string, localParts: string[]): Promise<string[]>;
}

export class InMemoryMailboxProvisioner implements MailboxProvisioner {
  readonly verifiedDomains: string[] = [];
  async addAndVerifyDomain(domain: string): Promise<DkimRecord> {
    this.verifiedDomains.push(domain);
    return { dkimName: `google._domainkey.${domain}`, dkimValue: "v=DKIM1; k=rsa; p=TESTKEY" };
  }
  async createUsers(domain: string, localParts: string[]): Promise<string[]> {
    return localParts.map((lp) => `${lp}@${domain}`);
  }
}
```

`packages/email-infra/src/owned/warmup.ts`:

```ts
export interface WarmupSnapshot { phase: "warming" | "ready"; dailyCap: number }

/** Outsourced warmup network. Keyed by mailbox email address. */
export interface WarmupService {
  enroll(address: string): Promise<void>;
  status(address: string): Promise<WarmupSnapshot>;
}

export class InMemoryWarmup implements WarmupService {
  private readonly state = new Map<string, WarmupSnapshot>();
  async enroll(address: string): Promise<void> {
    this.state.set(address, { phase: "warming", dailyCap: 10 });
  }
  async status(address: string): Promise<WarmupSnapshot> {
    return this.state.get(address) ?? { phase: "warming", dailyCap: 0 };
  }
  markReady(address: string, dailyCap: number): void {
    this.state.set(address, { phase: "ready", dailyCap });
  }
}
```

`packages/email-infra/src/owned/gmail-send.ts`:

```ts
export interface RawMessage { to: string; subject: string; body: string; headers: Record<string, string> }
export interface GmailSendResult { messageId: string }

/** Sends via Gmail API as a specific mailbox (userId = its email address). */
export interface GmailSender {
  sendRaw(fromAddress: string, msg: RawMessage): Promise<GmailSendResult>;
}

export class InMemoryGmailSender implements GmailSender {
  readonly sent: Array<{ from: string } & RawMessage> = [];
  private counter = 0;
  async sendRaw(fromAddress: string, msg: RawMessage): Promise<GmailSendResult> {
    this.sent.push({ from: fromAddress, ...msg });
    return { messageId: `gmsg_${++this.counter}` };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @vantera/email-infra test -- owned/`
Expected: PASS (5 fake test files).

- [ ] **Step 5: Commit**

```bash
git add packages/email-infra/src/owned/{registrar,dns,mailbox,warmup,gmail-send}.ts packages/email-infra/src/owned/{registrar,dns,mailbox,warmup,gmail-send}.test.ts
git commit -m "feat(email-infra): owned sub-layer interfaces + in-memory fakes"
```

---

## Task 3: `OwnedEmailInfra` orchestration

**Files:**
- Create: `packages/email-infra/src/owned/index.ts`, `packages/email-infra/src/owned/index.test.ts`

- [ ] **Step 1: Write the failing orchestration test**

`packages/email-infra/src/owned/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OwnedEmailInfra } from "./index";
import { InMemoryRegistrar } from "./registrar";
import { InMemoryDns } from "./dns";
import { InMemoryMailboxProvisioner } from "./mailbox";
import { InMemoryWarmup } from "./warmup";
import { InMemoryGmailSender } from "./gmail-send";

const build = () => {
  const registrar = new InMemoryRegistrar();
  const dns = new InMemoryDns();
  const mailbox = new InMemoryMailboxProvisioner();
  const warmup = new InMemoryWarmup();
  const sender = new InMemoryGmailSender();
  const infra = new OwnedEmailInfra({
    registrar, dns, mailbox, warmup, sender,
    webhookSecret: "whsec",
    chooseDomains: (accountId, count) => Array.from({ length: count }, (_, i) => `get-${accountId}-${i}.com`),
    localParts: (n) => Array.from({ length: n }, (_, i) => `sdr${i}`),
  });
  return { infra, registrar, dns, mailbox, warmup, sender };
};

describe("OwnedEmailInfra.provision", () => {
  it("buys domains, writes DNS, creates+enrolls mailboxes, returns Mailbox[] keyed by address", async () => {
    const { infra, registrar, dns, mailbox, warmup } = build();
    const result = await infra.provision({ accountId: "acct1", domainCount: 2, mailboxesPerDomain: 2 });

    expect(result).toHaveLength(4);
    // id === address (Gmail userId), domain populated
    expect(result[0].id).toBe(result[0].address);
    expect(registrar.purchased).toEqual(["get-acct1-0.com", "get-acct1-1.com"]);
    expect(dns.recordsFor("get-acct1-0.com").length).toBeGreaterThan(0);
    expect(mailbox.verifiedDomains).toContain("get-acct1-0.com");
    expect(await warmup.status(result[0].address)).toEqual({ phase: "warming", dailyCap: 10 });
  });
});

describe("OwnedEmailInfra.send", () => {
  it("sends via Gmail (userId=address) and sets List-Unsubscribe when provided", async () => {
    const { infra, sender } = build();
    const res = await infra.send({
      mailboxId: "sdr0@get-acct1-0.com", to: "lead@x.com", subject: "Hi", body: "Body",
      campaignId: "c", leadId: "l", unsubscribeUrl: "https://u/x",
    });
    expect(res.messageId).toBeTruthy();
    expect(typeof res.sentAt).toBe("string");
    expect(sender.sent[0].from).toBe("sdr0@get-acct1-0.com");
    expect(sender.sent[0].headers["List-Unsubscribe"]).toBe("<https://u/x>");
    expect(sender.sent[0].headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("OwnedEmailInfra.warmupStatus", () => {
  it("maps the warmup snapshot to WarmupStatus", async () => {
    const { infra, warmup } = build();
    await warmup.enroll("sdr0@get-acct1-0.com");
    warmup.markReady("sdr0@get-acct1-0.com", 40);
    expect(await infra.warmupStatus("sdr0@get-acct1-0.com")).toEqual({
      mailboxId: "sdr0@get-acct1-0.com", phase: "ready", dailyCap: 40,
    });
  });
});

describe("OwnedEmailInfra.verifyWebhook / parseEventWebhook", () => {
  it("verifies a matching secret and parses a reply event", () => {
    const { infra } = build();
    expect(infra.verifyWebhook({ "x-webhook-secret": "whsec" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "nope" }, "{}")).toBe(false);
    const ev = infra.parseEventWebhook({
      event_id: "e1", mailbox_ref: "sdr0@get-acct1-0.com", event_type: "reply",
      from: "lead@x.com", body: "yes", received_at: "2026-06-14T00:00:00Z", message_ref: "m1",
    });
    expect(ev).toMatchObject({ type: "reply", mailboxRef: "sdr0@get-acct1-0.com", from: "lead@x.com" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/email-infra test -- owned/index`
Expected: FAIL — `OwnedEmailInfra` not found.

- [ ] **Step 3: Implement `OwnedEmailInfra`**

`packages/email-infra/src/owned/index.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";
import type { EmailEvent, EmailInfra, Mailbox, OutboundEmail, ProvisionRequest, SendResult, WarmupStatus } from "../types";
import { InMemoryEmailInfra } from "../in-memory";
import type { DomainRegistrar } from "./registrar";
import type { DnsManager } from "./dns";
import type { MailboxProvisioner } from "./mailbox";
import type { WarmupService } from "./warmup";
import type { GmailSender } from "./gmail-send";

export interface OwnedConfig {
  registrar: DomainRegistrar;
  dns: DnsManager;
  mailbox: MailboxProvisioner;
  warmup: WarmupService;
  sender: GmailSender;
  webhookSecret: string;
  /** brand-adjacent domain names to buy for an account */
  chooseDomains: (accountId: string, count: number) => string[];
  /** local-parts (before @) for the mailboxes on each domain */
  localParts: (countPerDomain: number) => string[];
}

export class OwnedEmailInfra implements EmailInfra {
  // Reuse the in-memory fake's vendor-neutral webhook parser — identical shape contract.
  private readonly events = new InMemoryEmailInfra();

  constructor(private readonly cfg: OwnedConfig) {}

  async provision(req: ProvisionRequest): Promise<Mailbox[]> {
    const domains = this.cfg.chooseDomains(req.accountId, req.domainCount);
    const locals = this.cfg.localParts(req.mailboxesPerDomain);
    const out: Mailbox[] = [];
    for (const domain of domains) {
      if (!(await this.cfg.registrar.isAvailable(domain))) throw new Error(`domain unavailable: ${domain}`);
      await this.cfg.registrar.buy(domain);
      const dkim = await this.cfg.mailbox.addAndVerifyDomain(domain);
      await this.cfg.dns.writeEmailRecords(domain, dkim);
      const addresses = await this.cfg.mailbox.createUsers(domain, locals);
      for (const address of addresses) {
        await this.cfg.warmup.enroll(address);
        out.push({ id: address, address, domain }); // id === address (Gmail userId)
      }
    }
    return out;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    const headers: Record<string, string> = {};
    if (email.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${email.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const res = await this.cfg.sender.sendRaw(email.mailboxId, {
      to: email.to, subject: email.subject, body: email.body, headers,
    });
    return { messageId: res.messageId, sentAt: new Date().toISOString() };
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    const snap = await this.cfg.warmup.status(mailboxId);
    return { mailboxId, phase: snap.phase, dailyCap: snap.dailyCap };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["x-webhook-secret"];
    if (!presented) return false;
    const digest = (v: string) => createHash("sha256").update(v).digest();
    return timingSafeEqual(digest(this.cfg.webhookSecret), digest(presented));
  }

  parseEventWebhook(payload: unknown): EmailEvent | null {
    return this.events.parseEventWebhook(payload);
  }
}
```

> **Why reuse `InMemoryEmailInfra.parseEventWebhook`:** the inbound webhook payload shape for the owned provider is ours to define, so we adopt the same vendor-neutral shape the fake already documents (`event_id`/`mailbox_ref`/`event_type`). This keeps a single source of truth for the event contract; `process-inbound` is unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vantera/email-infra test -- owned/index`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/email-infra/src/owned/index.ts packages/email-infra/src/owned/index.test.ts
git commit -m "feat(email-infra): OwnedEmailInfra orchestration over owned sub-layers"
```

---

## Task 4: Real adapters (Cloudflare, Google, warmup API, Gmail send)

These call external HTTP APIs. Tests inject `fetchFn` and assert request shape + response mapping (mirror `smartlead.test.ts`). **Each real adapter implements the same interface as its fake from Task 2.**

> **Verify-against-live-docs note:** the endpoint paths and JSON field names below are from the documented Cloudflare v4 API, Google Admin SDK Directory API, and Gmail API. Confirm exact field names against current docs while implementing; the *interface contract and tests* are authoritative and must not change.

**Files:**
- Modify: `registrar.ts`, `dns.ts`, `mailbox.ts`, `warmup.ts`, `gmail-send.ts` (append real classes); their `.test.ts` (append real-adapter describes).

- [ ] **Step 1: Write failing tests for `CloudflareRegistrar` + `CloudflareDns`**

Append to `registrar.test.ts`:

```ts
import { vi } from "vitest";
import { CloudflareRegistrar } from "./registrar";

const cfFetch = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 400, json: async () => body, text: async () => "" })) as unknown as typeof fetch;

describe("CloudflareRegistrar", () => {
  it("isAvailable true when the registrar reports available", async () => {
    const r = new CloudflareRegistrar({ apiToken: "t", accountId: "a", fetchFn: cfFetch({ result: { available: true } }) });
    expect(await r.isAvailable("free.com")).toBe(true);
  });
  it("buy throws on a non-ok response", async () => {
    const r = new CloudflareRegistrar({ apiToken: "t", accountId: "a", fetchFn: cfFetch({ success: false, errors: [{ message: "nope" }] }, false) });
    await expect(r.buy("x.com")).rejects.toThrow(/registrar/i);
  });
});
```

Append to `dns.test.ts`:

```ts
import { vi } from "vitest";
import { CloudflareDns, buildEmailRecords } from "./dns";

describe("CloudflareDns", () => {
  it("POSTs one DNS record per built record into the domain's zone", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => { calls.push(url); return { ok: true, status: 200, json: async () => ({ result: { id: "z1" } }), text: async () => "" }; }) as unknown as typeof fetch;
    const dns = new CloudflareDns({ apiToken: "t", fetchFn });
    await dns.writeEmailRecords("acme.com", { dkimName: "google._domainkey.acme.com", dkimValue: "v=DKIM1;p=K" });
    const expected = buildEmailRecords("acme.com", { dkimName: "google._domainkey.acme.com", dkimValue: "v=DKIM1;p=K" }).length;
    const recordPosts = calls.filter((u) => u.includes("/dns_records"));
    expect(recordPosts.length).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/email-infra test -- owned/registrar owned/dns`
Expected: FAIL — `CloudflareRegistrar`/`CloudflareDns` not exported.

- [ ] **Step 3: Implement the Cloudflare adapters**

Append to `registrar.ts`:

```ts
export interface CloudflareRegistrarConfig { apiToken: string; accountId: string; fetchFn?: typeof fetch; baseUrl?: string }

export class CloudflareRegistrar implements DomainRegistrar {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: CloudflareRegistrarConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.cloudflare.com/client/v4";
  }
  private h() { return { Authorization: `Bearer ${this.cfg.apiToken}`, "Content-Type": "application/json" }; }
  async isAvailable(domain: string): Promise<boolean> {
    const res = await this.fetchFn(`${this.base}/accounts/${this.cfg.accountId}/registrar/domains/${domain}`, { headers: this.h() });
    if (!res.ok) return false;
    const data = (await res.json()) as { result?: { available?: boolean } };
    return data.result?.available === true;
  }
  async buy(domain: string): Promise<void> {
    const res = await this.fetchFn(`${this.base}/accounts/${this.cfg.accountId}/registrar/domains/${domain}`, {
      method: "PUT", headers: this.h(), body: JSON.stringify({ enabled: true, auto_renew: true }),
    });
    if (!res.ok) throw new Error(`registrar purchase failed for ${domain}: ${res.status}`);
  }
}
```

Append to `dns.ts`:

```ts
export interface CloudflareDnsConfig { apiToken: string; fetchFn?: typeof fetch; baseUrl?: string }

export class CloudflareDns implements DnsManager {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: CloudflareDnsConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.cloudflare.com/client/v4";
  }
  private h() { return { Authorization: `Bearer ${this.cfg.apiToken}`, "Content-Type": "application/json" }; }
  private async zoneId(domain: string): Promise<string> {
    const res = await this.fetchFn(`${this.base}/zones?name=${domain}`, { headers: this.h() });
    const data = (await res.json()) as { result?: Array<{ id: string }> };
    const id = data.result?.[0]?.id;
    if (!id) throw new Error(`no Cloudflare zone for ${domain}`);
    return id;
  }
  async writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void> {
    const zone = await this.zoneId(domain);
    for (const r of buildEmailRecords(domain, dkim)) {
      const res = await this.fetchFn(`${this.base}/zones/${zone}/dns_records`, {
        method: "POST", headers: this.h(),
        body: JSON.stringify({ type: r.type, name: r.name, content: r.value, priority: r.priority }),
      });
      if (!res.ok) throw new Error(`dns write failed (${r.type} ${r.name}): ${res.status}`);
    }
  }
}
```

- [ ] **Step 4: Run Cloudflare tests to verify pass**

Run: `pnpm --filter @vantera/email-infra test -- owned/registrar owned/dns`
Expected: PASS.

- [ ] **Step 5: Write failing tests + implement `GoogleMailboxProvisioner`**

Append to `mailbox.test.ts`:

```ts
import { vi } from "vitest";
import { GoogleMailboxProvisioner } from "./mailbox";

describe("GoogleMailboxProvisioner", () => {
  it("creates users for each local-part via the Directory API and returns addresses", async () => {
    const bodies: string[] = [];
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) bodies.push(init.body as string);
      return { ok: true, status: 200, json: async () => ({ primaryEmail: "x" }), text: async () => "" };
    }) as unknown as typeof fetch;
    const p = new GoogleMailboxProvisioner({ tenantLabel: "t1", getAccessToken: async () => "tok", fetchFn });
    const created = await p.createUsers("acme.com", ["sdr0", "sdr1"]);
    expect(created).toEqual(["sdr0@acme.com", "sdr1@acme.com"]);
    expect(bodies.some((b) => b.includes("sdr0@acme.com"))).toBe(true);
  });
});
```

Append to `mailbox.ts`:

```ts
export interface GoogleMailboxConfig {
  tenantLabel: string;
  getAccessToken: () => Promise<string>; // OAuth2 / service-account w/ domain-wide delegation
  fetchFn?: typeof fetch;
  baseUrl?: string;
  passwordFn?: () => string;
}

export class GoogleMailboxProvisioner implements MailboxProvisioner {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: GoogleMailboxConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://admin.googleapis.com/admin/directory/v1";
  }
  private async h() { return { Authorization: `Bearer ${await this.cfg.getAccessToken()}`, "Content-Type": "application/json" }; }

  async addAndVerifyDomain(domain: string): Promise<DkimRecord> {
    const headers = await this.h();
    const add = await this.fetchFn(`${this.base}/customer/my_customer/domains`, {
      method: "POST", headers, body: JSON.stringify({ domainName: domain }),
    });
    if (!add.ok && add.status !== 409) throw new Error(`domain add failed ${domain}: ${add.status}`);
    // DKIM key generation is via the Gmail/postmaster admin surface; return the published selector record.
    // Implementation detail: generate via the Email Settings API and read the public key.
    const dkim = await this.fetchFn(`${this.base}/customer/my_customer/domains/${domain}/dkim`, { headers });
    const data = dkim.ok ? ((await dkim.json()) as { name?: string; publicKey?: string }) : {};
    return {
      dkimName: data.name ?? `google._domainkey.${domain}`,
      dkimValue: data.publicKey ?? "",
    };
  }

  async createUsers(domain: string, localParts: string[]): Promise<string[]> {
    const headers = await this.h();
    const out: string[] = [];
    for (const lp of localParts) {
      const primaryEmail = `${lp}@${domain}`;
      const res = await this.fetchFn(`${this.base}/users`, {
        method: "POST", headers,
        body: JSON.stringify({
          primaryEmail,
          name: { givenName: lp, familyName: "Sender" },
          password: (this.cfg.passwordFn ?? (() => crypto.randomUUID()))(),
        }),
      });
      if (!res.ok && res.status !== 409) throw new Error(`user create failed ${primaryEmail}: ${res.status}`);
      out.push(primaryEmail);
    }
    return out;
  }
}
```

> Add `import { randomUUID } from "node:crypto";` at the top of `mailbox.ts` and use `randomUUID` instead of `crypto.randomUUID` to avoid a global dependency.

- [ ] **Step 6: Write failing tests + implement `ApiWarmup` and `GoogleGmailSender`**

Append to `warmup.test.ts`:

```ts
import { vi } from "vitest";
import { ApiWarmup } from "./warmup";

describe("ApiWarmup", () => {
  it("maps a ready status payload to a snapshot", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ state: "ready", daily_limit: 45 }), text: async () => "" })) as unknown as typeof fetch;
    const w = new ApiWarmup({ apiKey: "k", fetchFn });
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "ready", dailyCap: 45 });
  });
});
```

Append to `warmup.ts`:

```ts
export interface ApiWarmupConfig { apiKey: string; fetchFn?: typeof fetch; baseUrl?: string }

export class ApiWarmup implements WarmupService {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: ApiWarmupConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.warmup.example/v1";
  }
  private h() { return { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" }; }
  async enroll(address: string): Promise<void> {
    const res = await this.fetchFn(`${this.base}/mailboxes`, { method: "POST", headers: this.h(), body: JSON.stringify({ email: address }) });
    if (!res.ok && res.status !== 409) throw new Error(`warmup enroll failed ${address}: ${res.status}`);
  }
  async status(address: string): Promise<WarmupSnapshot> {
    const res = await this.fetchFn(`${this.base}/mailboxes/${encodeURIComponent(address)}`, { headers: this.h() });
    if (!res.ok) return { phase: "warming", dailyCap: 0 };
    const data = (await res.json()) as { state?: string; daily_limit?: number };
    return { phase: data.state === "ready" ? "ready" : "warming", dailyCap: typeof data.daily_limit === "number" ? data.daily_limit : 0 };
  }
}
```

Append to `gmail-send.test.ts`:

```ts
import { vi } from "vitest";
import { GoogleGmailSender } from "./gmail-send";

describe("GoogleGmailSender", () => {
  it("POSTs a base64url raw message to the sender's Gmail send endpoint", async () => {
    let calledUrl = "";
    const fetchFn = vi.fn(async (url: string) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ id: "gmsg_1" }), text: async () => "" }; }) as unknown as typeof fetch;
    const s = new GoogleGmailSender({ getAccessToken: async () => "tok", fetchFn });
    const res = await s.sendRaw("sdr0@acme.com", { to: "lead@x.com", subject: "Hi", body: "Body", headers: { "List-Unsubscribe": "<u>" } });
    expect(res.messageId).toBe("gmsg_1");
    expect(calledUrl).toContain("/users/sdr0@acme.com/messages/send");
  });
});
```

Append to `gmail-send.ts`:

```ts
export interface GoogleGmailConfig { getAccessToken: () => Promise<string>; fetchFn?: typeof fetch; baseUrl?: string }

export class GoogleGmailSender implements GmailSender {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: GoogleGmailConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://gmail.googleapis.com/gmail/v1";
  }
  async sendRaw(fromAddress: string, msg: RawMessage): Promise<GmailSendResult> {
    const headerLines = [
      `From: ${fromAddress}`,
      `To: ${msg.to}`,
      `Subject: ${msg.subject}`,
      ...Object.entries(msg.headers).map(([k, v]) => `${k}: ${v}`),
      "Content-Type: text/html; charset=UTF-8",
    ].join("\r\n");
    const mime = `${headerLines}\r\n\r\n${msg.body}`;
    const raw = Buffer.from(mime).toString("base64url");
    const res = await this.fetchFn(`${this.base}/users/${encodeURIComponent(fromAddress)}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.cfg.getAccessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) throw new Error(`gmail send failed from ${fromAddress}: ${res.status}`);
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error("gmail send response missing id");
    return { messageId: data.id };
  }
}
```

- [ ] **Step 7: Run all owned tests to verify pass**

Run: `pnpm --filter @vantera/email-infra test -- owned/`
Expected: PASS (all fake + real adapter tests).

- [ ] **Step 8: Commit**

```bash
git add packages/email-infra/src/owned/
git commit -m "feat(email-infra): Cloudflare/Google/warmup/Gmail real adapters for owned infra"
```

---

## Task 5: Provider switch in the env factory

**Files:**
- Modify/Create: `packages/email-infra/src/index.ts` (barrel + factory)
- Create: `packages/email-infra/src/factory.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing factory test**

`packages/email-infra/src/factory.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailInfraFromEnv } from "./index";
import { SmartleadEmailInfra } from "./smartlead";
import { OwnedEmailInfra } from "./owned/index";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs(); });

describe("createEmailInfraFromEnv", () => {
  it("returns SmartleadEmailInfra when EMAIL_PROVIDER is smartlead (default)", () => {
    vi.stubEnv("EMAIL_PROVIDER", "smartlead");
    vi.stubEnv("SMARTLEAD_API_KEY", "k");
    vi.stubEnv("SMARTLEAD_WEBHOOK_SECRET", "s");
    expect(createEmailInfraFromEnv()).toBeInstanceOf(SmartleadEmailInfra);
  });

  it("returns OwnedEmailInfra when EMAIL_PROVIDER is owned", () => {
    vi.stubEnv("EMAIL_PROVIDER", "owned");
    vi.stubEnv("OWNED_EMAIL_WEBHOOK_SECRET", "s");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "t");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a");
    vi.stubEnv("WARMUP_API_KEY", "w");
    vi.stubEnv("GOOGLE_WORKSPACE_TENANT_LABEL", "t1");
    expect(createEmailInfraFromEnv()).toBeInstanceOf(OwnedEmailInfra);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/email-infra test -- factory`
Expected: FAIL — `./index` has no `createEmailInfraFromEnv`, or `OwnedEmailInfra` not wired.

- [ ] **Step 3: Create the barrel + switch; remove the old factory from `smartlead.ts`**

Create `packages/email-infra/src/index.ts`:

```ts
export * from "./types";
export { InMemoryEmailInfra } from "./in-memory";
export { SmartleadEmailInfra } from "./smartlead";
export { OwnedEmailInfra } from "./owned/index";

import type { EmailInfra } from "./types";
import { SmartleadEmailInfra } from "./smartlead";
import { OwnedEmailInfra } from "./owned/index";
import { CloudflareRegistrar } from "./owned/registrar";
import { CloudflareDns } from "./owned/dns";
import { GoogleMailboxProvisioner } from "./owned/mailbox";
import { ApiWarmup } from "./owned/warmup";
import { GoogleGmailSender } from "./owned/gmail-send";
import { googleAccessToken } from "./owned/google-auth";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`email infra env var missing: ${name}`);
  return v;
}

/** Brand-adjacent domain naming + mailbox local-parts, shared by adapter and provisioning UX. */
const chooseDomains = (accountId: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${accountId.slice(0, 6)}-mail${i}.com`);
const localParts = (n: number) => Array.from({ length: n }, (_, i) => `sdr${i}`);

/** The only construction point product code may use (white-label, rule 03). */
export function createEmailInfraFromEnv(): EmailInfra {
  const provider = process.env.EMAIL_PROVIDER ?? "smartlead";
  if (provider === "owned") {
    const getAccessToken = () => googleAccessToken(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));
    return new OwnedEmailInfra({
      registrar: new CloudflareRegistrar({ apiToken: requireEnv("CLOUDFLARE_API_TOKEN"), accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID") }),
      dns: new CloudflareDns({ apiToken: requireEnv("CLOUDFLARE_API_TOKEN") }),
      mailbox: new GoogleMailboxProvisioner({ tenantLabel: requireEnv("GOOGLE_WORKSPACE_TENANT_LABEL"), getAccessToken }),
      warmup: new ApiWarmup({ apiKey: requireEnv("WARMUP_API_KEY") }),
      sender: new GoogleGmailSender({ getAccessToken }),
      webhookSecret: requireEnv("OWNED_EMAIL_WEBHOOK_SECRET"),
      chooseDomains,
      localParts,
    });
  }
  return new SmartleadEmailInfra({
    apiKey: requireEnv("SMARTLEAD_API_KEY"),
    webhookSecret: requireEnv("SMARTLEAD_WEBHOOK_SECRET"),
  });
}
```

Create a minimal `packages/email-infra/src/owned/google-auth.ts` (service-account → access token; tested only indirectly — keep it tiny and dependency-light):

```ts
/** Exchanges a service-account JSON (with domain-wide delegation) for an access token.
 *  Uses google-auth-library if present; the function is intentionally thin so it can be
 *  swapped/mocked. */
export async function googleAccessToken(serviceAccountJson: string): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user",
      "https://www.googleapis.com/auth/admin.directory.domain",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("failed to obtain Google access token");
  return token.token;
}
```

Add `google-auth-library` to `packages/email-infra/package.json` dependencies (`pnpm --filter @vantera/email-infra add google-auth-library`).

Remove the now-duplicated `createEmailInfraFromEnv` from the bottom of `smartlead.ts` (lines 176–182) so there is one factory.

- [ ] **Step 4: Run the factory test to verify pass**

Run: `pnpm --filter @vantera/email-infra test -- factory`
Expected: PASS.

- [ ] **Step 5: Update any importers of the old factory path**

Run: `grep -rn "createEmailInfraFromEnv" packages apps | grep -v node_modules`
For each hit importing from `@vantera/email-infra/smartlead` or `./smartlead`, change the import to `@vantera/email-infra` (the barrel). Confirm the package `exports`/`main` in `packages/email-infra/package.json` points to `src/index.ts` (or build output); if it only exported `smartlead`, update it to `index`.

- [ ] **Step 6: Run the full package test + type-check**

Run: `pnpm --filter @vantera/email-infra test && pnpm --filter @vantera/email-infra type-check`
Expected: PASS, no type errors.

- [ ] **Step 7: Update `.env.example`**

Add under an `# Email infra` section:

```
EMAIL_PROVIDER=smartlead            # smartlead | owned
# owned provider (Path B — self-built)
OWNED_EMAIL_WEBHOOK_SECRET=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=        # service account w/ domain-wide delegation (single-line JSON)
GOOGLE_WORKSPACE_TENANT_LABEL=
WARMUP_API_KEY=
```

- [ ] **Step 8: Commit**

```bash
git add packages/email-infra/src/index.ts packages/email-infra/src/owned/google-auth.ts packages/email-infra/src/smartlead.ts packages/email-infra/src/factory.test.ts packages/email-infra/package.json .env.example
git commit -m "feat(email-infra): EMAIL_PROVIDER switch (owned|smartlead) in single env factory"
```

---

## Task 6: Provisioning pipeline + Trigger task + persistence

`EmailInfra.provision()` does the slow external orchestration; this task wraps it in a durable Trigger.dev task (no timeout) and persists the results. Pure core + thin wrapper (rule 13).

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (add interfaces)
- Create: `packages/jobs/src/pipeline/provision-email.ts`, `packages/jobs/src/pipeline/provision-email.test.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (persistence)
- Create: `packages/jobs/src/trigger/provision-email.ts`

- [ ] **Step 1: Add types to `pipeline/types.ts`**

Append:

```ts
export interface ProvisionEmailStore {
  /** upsert a sending_domains row, return its id */
  upsertSendingDomain(accountId: string, domain: string): Promise<string>;
  markDomainActive(domainId: string, at: Date): Promise<void>;
  /** insert a mailbox row in 'warming' (skip if (accountId,email) already exists) */
  insertMailbox(m: { accountId: string; domainId: string; emailAddress: string; providerRef: string }): Promise<void>;
}

export interface ProvisionEmailDeps {
  store: ProvisionEmailStore;
  emailInfra: Pick<import("@vantera/email-infra").EmailInfra, "provision">;
  now?: () => Date;
}

export interface ProvisionEmailSummary {
  status: "completed";
  domains: number;
  mailboxes: number;
}
```

- [ ] **Step 2: Write the failing pipeline test**

`packages/jobs/src/pipeline/provision-email.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runProvisionEmail } from "./provision-email";
import type { ProvisionEmailStore } from "./types";

function fakeStore() {
  const domains = new Map<string, string>(); // domain -> id
  const mailboxes: Array<{ emailAddress: string; domainId: string }> = [];
  const activated: string[] = [];
  const store: ProvisionEmailStore = {
    async upsertSendingDomain(_acct, domain) {
      if (!domains.has(domain)) domains.set(domain, `dom_${domains.size + 1}`);
      return domains.get(domain)!;
    },
    async markDomainActive(id) { activated.push(id); },
    async insertMailbox(m) { mailboxes.push({ emailAddress: m.emailAddress, domainId: m.domainId }); },
  };
  return { store, domains, mailboxes, activated };
}

describe("runProvisionEmail", () => {
  it("persists one domain row per distinct domain and one mailbox row per address", async () => {
    const { store, mailboxes, activated } = fakeStore();
    const emailInfra = {
      provision: async () => [
        { id: "sdr0@a.com", address: "sdr0@a.com", domain: "a.com" },
        { id: "sdr1@a.com", address: "sdr1@a.com", domain: "a.com" },
        { id: "sdr0@b.com", address: "sdr0@b.com", domain: "b.com" },
      ],
    };
    const summary = await runProvisionEmail(
      { store, emailInfra },
      { accountId: "acct1", domainCount: 2, mailboxesPerDomain: 2 },
    );
    expect(summary).toEqual({ status: "completed", domains: 2, mailboxes: 3 });
    expect(mailboxes).toHaveLength(3);
    expect(activated).toHaveLength(2); // both domains marked active
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @vantera/jobs test -- provision-email`
Expected: FAIL — `runProvisionEmail` not found.

- [ ] **Step 4: Implement the pure core**

`packages/jobs/src/pipeline/provision-email.ts`:

```ts
import type { ProvisionEmailDeps, ProvisionEmailSummary } from "./types";

export async function runProvisionEmail(
  deps: ProvisionEmailDeps,
  req: { accountId: string; domainCount: number; mailboxesPerDomain: number },
): Promise<ProvisionEmailSummary> {
  const now = deps.now ?? (() => new Date());
  const mailboxes = await deps.emailInfra.provision(req);

  const domainIds = new Map<string, string>();
  for (const mb of mailboxes) {
    if (!domainIds.has(mb.domain)) {
      domainIds.set(mb.domain, await deps.store.upsertSendingDomain(req.accountId, mb.domain));
    }
    await deps.store.insertMailbox({
      accountId: req.accountId,
      domainId: domainIds.get(mb.domain)!,
      emailAddress: mb.address,
      providerRef: mb.id,
    });
  }
  for (const id of domainIds.values()) await deps.store.markDomainActive(id, now());

  return { status: "completed", domains: domainIds.size, mailboxes: mailboxes.length };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @vantera/jobs test -- provision-email`
Expected: PASS.

- [ ] **Step 6: Implement persistence in `pg-store.ts`**

Add the three methods to the object returned by `createPgStore` (match the file's existing Drizzle style; import `sendingDomains`, `mailboxes` from `@vantera/db` schema). New mailboxes default `status='warming'`, `warmupStartedAt=now()`:

```ts
  async upsertSendingDomain(accountId: string, domain: string): Promise<string> {
    const [row] = await db
      .insert(sendingDomains)
      .values({ accountId, domain, status: "verifying" })
      .onConflictDoUpdate({ target: [sendingDomains.accountId, sendingDomains.domain], set: { updatedAt: new Date() } })
      .returning({ id: sendingDomains.id });
    return row.id;
  },
  async markDomainActive(domainId: string, at: Date): Promise<void> {
    await db.update(sendingDomains).set({ status: "active", verifiedAt: at }).where(eq(sendingDomains.id, domainId));
  },
  async insertMailbox(m): Promise<void> {
    await db
      .insert(mailboxes)
      .values({ accountId: m.accountId, domainId: m.domainId, emailAddress: m.emailAddress, providerRef: m.providerRef, status: "warming", warmupStartedAt: new Date() })
      .onConflictDoNothing({ target: [mailboxes.accountId, mailboxes.emailAddress] });
  },
```

- [ ] **Step 7: Write the thin Trigger wrapper**

`packages/jobs/src/trigger/provision-email.ts` (mirror `send-dispatch.ts` wiring; this is an event task, not a cron):

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { runProvisionEmail } from "../pipeline/provision-email";
import { createPgStore } from "../pipeline/pg-store";

export const provisionEmail = task({
  id: "provision-email",
  run: async (payload: { accountId: string; domainCount: number; mailboxesPerDomain: number }) => {
    const store = createPgStore(createDb());
    const summary = await runProvisionEmail({ store, emailInfra: createEmailInfraFromEnv() }, payload);
    logger.info("email provisioning complete", { accountId: payload.accountId, ...summary });
    return summary;
  },
});
```

- [ ] **Step 8: Verify the thin-task structure guard + run jobs gate**

Run: `pnpm --filter @vantera/jobs test && pnpm --filter @vantera/jobs type-check`
Expected: PASS — including `structure.test.ts` (the new trigger imports its core from `../pipeline/`).

- [ ] **Step 9: Commit**

```bash
git add packages/jobs/src/pipeline/provision-email.ts packages/jobs/src/pipeline/provision-email.test.ts packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/trigger/provision-email.ts
git commit -m "feat(jobs): durable email-provisioning task + sending_domains/mailbox persistence"
```

---

## Task 7: Channels UI — provision flow + plan gate + warmup status

The `/settings/channels` page exists (provisional, Phase 5). Wire real provisioning behind it. Reuse the Phase 6 entitlement check that already gates mailbox creation.

**Files:**
- Modify: `apps/web/src/app/(app)/settings/channels/actions.ts`
- Modify: the channels page/components under `apps/web/src/app/(app)/settings/channels/`
- Test: colocated `actions.test.ts` (validation only — server actions stay thin)

- [ ] **Step 1: Locate the existing surface**

Run: `ls apps/web/src/app/\(app\)/settings/channels/ && grep -rn "mailbox\|provision\|entitlement\|getEntitlements\|plan" apps/web/src/app/\(app\)/settings/channels/`
Read the existing `actions.ts` and page to match patterns (how it resolves the account from session via RLS, how Phase 6 gates mailbox count). Note the entitlement helper name (e.g. `resolveEntitlements`/`assertWithinPlan`) — reuse it; do not invent a new gate.

- [ ] **Step 2: Write the failing validation test**

`apps/web/src/app/(app)/settings/channels/actions.test.ts` (pure validation function, no DB):

```ts
import { describe, expect, it } from "vitest";
import { validateProvisionInput } from "./actions";

describe("validateProvisionInput", () => {
  it("accepts in-range counts", () => {
    expect(validateProvisionInput({ domainCount: 2, mailboxesPerDomain: 2 })).toEqual({ ok: true });
  });
  it("rejects zero or excessive counts", () => {
    expect(validateProvisionInput({ domainCount: 0, mailboxesPerDomain: 2 }).ok).toBe(false);
    expect(validateProvisionInput({ domainCount: 1, mailboxesPerDomain: 99 }).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @vantera/web test -- channels/actions`
Expected: FAIL — `validateProvisionInput` not exported.

- [ ] **Step 4: Implement the validation + server actions**

In `actions.ts` add the pure validator and two `"use server"` actions. Keep logic thin; account always from session (rule 13 — never accept accountId):

```ts
import { z } from "zod";
import { tasks } from "@trigger.dev/sdk";
// ...existing imports: session/account resolver, entitlement helper...

const provisionSchema = z.object({
  domainCount: z.number().int().min(1).max(10),
  mailboxesPerDomain: z.number().int().min(1).max(5),
});

export function validateProvisionInput(input: { domainCount: number; mailboxesPerDomain: number }):
  | { ok: true }
  | { ok: false; error: string } {
  const r = provisionSchema.safeParse(input);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues[0]?.message ?? "invalid" };
}

export async function startEmailProvisioning(input: { domainCount: number; mailboxesPerDomain: number }) {
  const v = validateProvisionInput(input);
  if (!v.ok) return { error: v.error };
  const { accountId } = await requireAccount(); // existing session resolver
  // Phase 6 plan gate — reuse the existing entitlement check for total mailbox capacity:
  await assertMailboxCapacity(accountId, input.domainCount * input.mailboxesPerDomain); // existing helper name from Step 1
  await tasks.trigger("provision-email", { accountId, ...input });
  return { ok: true };
}
```

> Replace `requireAccount` / `assertMailboxCapacity` with the **actual** helper names found in Step 1. If no capacity helper exists on this path, call the same entitlement resolver Phase 6 uses on the mailbox create-path.

- [ ] **Step 5: Wire the UI**

In the channels page email section, replace the provisional copy with: a small form (number of domains, mailboxes per domain) → "Set up email sending" button calling `startEmailProvisioning`; and a list of the account's `sending_domains` + `mailboxes` with status badges. Use the existing warmup status copy from `channels-setup.md` ("Warming up — building sender reputation" / "Ready"). **No vendor names** anywhere (white-label). Fetch domains/mailboxes via the existing server-component data pattern on the page (RLS-scoped select). Match the locked spacing scale (rule 07) for the form card.

- [ ] **Step 6: Run web validation test + type-check + lint**

Run: `pnpm --filter @vantera/web test -- channels/actions && pnpm --filter @vantera/web type-check && pnpm --filter @vantera/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/settings/channels"
git commit -m "feat(web): channels email provisioning flow (plan-gated) + warmup status"
```

---

## Task 8: Help content, white-label audit, full gate

**Files:**
- Modify: `packages/help-content/content/channels-setup.md`

- [ ] **Step 1: Update the help article (knowledge-sync, rule 09)**

Edit the "Email sending" section of `channels-setup.md` to describe the provisioning choice (how many domains/mailboxes), that domains are registered for the workspace, the 2–4 week warmup, and that mailboxes join the rotation when Ready. Keep it vendor-neutral. Keep the existing frontmatter (`title`/`surface`/`routes`).

- [ ] **Step 2: Verify help-content tests pass (no vendor names)**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS — `articles.test.ts` (no vendor-name leak) green.

- [ ] **Step 3: White-label audit of changed surfaces**

Run: `grep -rniE "smartlead|cloudflare|google workspace|gmail|mailreach|warmy|warmbox" apps/web/src packages/help-content/content | grep -v node_modules`
Expected: no matches in user-facing strings (code identifiers/comments in `packages/email-infra` are allowed; UI copy and help content must be clean).

- [ ] **Step 4: Full monorepo gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 5: Update the roadmap**

In `docs/roadmap.md`, add an "Owned Email Infrastructure" entry (provider swap behind `email-infra`, Path B, lightweight tenancy now / reseller later) and check it off. Note remaining-before-ship: live smoke test with real Cloudflare/Google/warmup creds (not runnable in CI), and the Google Workspace reseller application as a parallel follow-up.

- [ ] **Step 6: Commit**

```bash
git add packages/help-content/content/channels-setup.md docs/roadmap.md
git commit -m "docs(email): owned-provisioning help article + roadmap entry"
```

---

## Deferred (explicitly NOT in this plan — from spec follow-ups)

- **Gmail reply/bounce ingestion (fast-follow plan).** This plan delivers the *event-parsing contract* (`OwnedEmailInfra.parseEventWebhook` produces normalized `EmailEvent`s consumed by the existing `process-inbound` task) but NOT the *ingestion wiring*: a Google Cloud Pub/Sub topic, per-mailbox Gmail `users.watch` registration, a watch-renewal cron (watches expire ~7 days), `history.list` diffing to pull new messages, and MIME parsing into our normalized `{event_id, mailbox_ref, event_type, ...}` shape posted to the inbound webhook. Until this ships, the owned provider sends and provisions but does not yet feed replies/bounces back — so auto-suppression on bounce and reply classification stay on the Smartlead path. This is the recommended immediate next plan after this one.
- Google Workspace **Reseller** API path (per-customer isolated tenants) — swap `mailbox.ts` later behind the same interface.
- `sending_domains_purchased` Stripe add-on (per-domain billing beyond plan tiers).
- Microsoft 365 mailbox adapter (second provider).
- Domain expiry / auto-renew monitoring surface; `registrar_ref`/`expires_at` columns when that lands.
- Live per-adapter smoke test with real credentials (ship gate, like Phase 5).
- Tenant-pool rotation logic using `infra_workspace_tenants.domain_cap` (v1 uses a single configured tenant via `GOOGLE_WORKSPACE_TENANT_LABEL`).

# Phase 5 — Live Channel Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry approved drafts across the live send boundary (Smartlead email + Unipile LinkedIn), with replies, unsubscribes, and compliance reactions flowing back in.

**Architecture:** A `send-dispatch` Trigger.dev cron scans due `scheduled_sends`, applies every gate (kill switch, account pause, suppression, safety limits, warmup), assigns jittered times, and fans out `outreach-send` tasks that re-check suppression at the provider boundary. Inbound webhooks land on thin verified Next.js routes, dedupe through `webhook_events`, and a `process-inbound` task routes events (reply classification via a new agent brain, bounces/complaints/unsubscribes → suppression). All vendor specifics stay inside `packages/email-infra` / `packages/linkedin-infra` (rule 03/04 white-label).

**Tech Stack:** Trigger.dev v4, Drizzle/Supabase Postgres, Next.js App Router route handlers, `@vantera/ai` via agent-brains, Vitest.

**Constraints carried from the owner:**
- **All UI in this phase is a provisional mockup** — functional but plainly styled; the owner will restyle later. Don't invest in visual polish; do keep it working.
- Work on local `main`, commit after every task, **never stage `.env.example` blindly** (concurrent sessions; inspect before staging — `git add` specific files only).
- Spec: `docs/superpowers/specs/2026-06-11-phase-5-live-channel-adapters-design.md`. Rules 03/04/11/13 apply. Use the `vantera-db-migrations` skill for Task 1 and run the `rls-auditor` agent on the migration diff before committing it.

**Verification gate for every task:** run the focused test file; full `pnpm lint && pnpm type-check && pnpm test && pnpm build` at Task 21.

---

## File map (created → responsibility)

| File | Responsibility |
|---|---|
| `packages/db/migrations/0009_live_sends.sql` | webhook_events, sender_address, linkedin sequencing state, linkedin_stage, source rename |
| `packages/db/src/schema.ts` | drizzle mirror of 0009 |
| `packages/jobs/src/pipeline/safety-limits.ts` | + LinkedIn message cap (`kind` param) |
| `packages/email-infra/src/{types,in-memory,smartlead}.ts` | extended interface, fake, Smartlead adapter |
| `packages/linkedin-infra/src/{types,in-memory,unipile}.ts` | extended interface, fake, Unipile adapter |
| `packages/agent-brains/src/copy/linkedin.ts` | + follow-up message in LinkedInDraft |
| `packages/agent-brains/src/reply/classify.ts` | reply classification brain (pre-checks + AI) |
| `packages/jobs/src/pipeline/{copy-draft,send-dispatch,outreach-send,inbound,email-footer}.ts` | pure cores |
| `packages/jobs/src/pipeline/pg-store.ts` | drizzle impls of new store interfaces |
| `packages/jobs/src/trigger/{send-dispatch,outreach-send,process-inbound}.ts` | thin wrappers |
| `apps/web/src/app/api/webhooks/{email,linkedin}/route.ts` + `apps/web/src/server/inbound-webhooks.ts` | verified, deduped webhook intake |
| `apps/web/src/app/api/unsubscribe/[token]/route.ts` + `apps/web/src/server/unsubscribe.ts` | one-click unsubscribe |
| `apps/web/src/app/(app)/settings/channels/*` | provisioning/connect/pause UI (mockup) |
| `packages/help-content/content/{channels-setup,send-modes,replies-unsubscribes}.md` | knowledge-sync |

---

### Task 1: Migration 0009 + Drizzle schema

**Files:**
- Create: `packages/db/migrations/0009_live_sends.sql`
- Modify: `packages/db/src/schema.ts` (accounts block ~L24, leads ~L125, scheduledSends ~L265, new webhookEvents after appSettings ~L341)
- Test: `packages/db/src/schema.test.ts` (existing guardrails must stay green)

Invoke the `vantera-db-migrations` skill first; run the `rls-auditor` agent on the diff before the commit step.

- [ ] **Step 1: Write the migration**

```sql
-- Migration #10: Phase 5 live send boundary — webhook idempotency, CAN-SPAM sender
-- address, LinkedIn invite→accept→message sequencing, whitelabel source rename.

-- customer's physical mailing address for the cold-email footer (rule 11):
-- {line1, line2?, city, region, postal, country}. Email dispatch refuses accounts
-- without it.
alter table public.accounts add column sender_address jsonb;

-- LinkedIn sequencing state (rule 04/08): set by the send task / accepted-webhook.
alter table public.leads add column linkedin_invited_at timestamptz;
alter table public.leads add column linkedin_connected_at timestamptz;

-- whitelabel follow-up (Phase 4 audit): neutral discovery source. The inline check
-- from 0002 is named leads_source_check by Postgres convention.
alter table public.leads drop constraint if exists leads_source_check;
update public.leads set source = 'discovery' where source = 'explorium';
alter table public.leads alter column source set default 'discovery';
alter table public.leads
  add constraint leads_source_check check (source in ('discovery', 'manual', 'import'));

-- LinkedIn drafts come in pairs: stage 'invite' (connection note) and stage
-- 'message' (follow-up, parked until the lead accepts). Null for email.
alter table public.scheduled_sends
  add column linkedin_stage text check (linkedin_stage in ('invite', 'message'));

-- retention(webhook_events): debugging + idempotency only; purged after 30 days by
-- the retention-purge job (rule 11). Service-role only — RLS enabled, NO policies
-- (same pattern as app_settings).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('email', 'linkedin')),
  provider_event_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- one processing per provider event; doubles as the dedupe gate
create unique index webhook_events_source_event_idx
  on public.webhook_events (source, provider_event_id);
create index webhook_events_received_idx on public.webhook_events (received_at);

alter table public.webhook_events enable row level security;
```

- [ ] **Step 2: Mirror in Drizzle** — in `packages/db/src/schema.ts`: add to `accounts`: `senderAddress: jsonb("sender_address"),` (after `websiteScannedAt`); add to `leads` (after `linkedinUrl`): `linkedinInvitedAt: timestamp("linkedin_invited_at", { withTimezone: true }), linkedinConnectedAt: timestamp("linkedin_connected_at", { withTimezone: true }),`; change `leads.source` enum to `["discovery", "manual", "import"]` with `.default("discovery")`; add to `scheduledSends` (after `styleFlags`): `linkedinStage: text("linkedin_stage", { enum: ["invite", "message"] }),`; add after `appSettings`:

```ts
// webhook intake idempotency + debugging; service-role only (RLS, no policies);
// retention: purged after 30 days by retention-purge (rule 11)
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: ["email", "linkedin"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_source_event_idx").on(t.source, t.providerEventId)]
);
```

- [ ] **Step 3: Fix the one source-string producer** — `packages/jobs/src/pipeline/pg-store.ts:96` `source: "explorium"` → `source: "discovery"`. Run `grep -rn "explorium" packages/ apps/ --include="*.ts" --include="*.tsx"` — remaining hits must be inside `packages/prospect-data` (the vendor adapter) only.

- [ ] **Step 4: Run guardrails** — `pnpm --filter @vantera/db test` and `pnpm --filter @vantera/jobs test`. Expected: PASS (schema.test.ts RLS guardrail sees `enable row level security` for webhook_events).

- [ ] **Step 5: Apply to the dev Supabase project** (batyjchztbrqzkcvhkmk) with the same tooling used for 0008 (see `vantera-db-migrations` skill; migrations 0000–0008 already applied).

- [ ] **Step 6: Commit** — `git add packages/db/migrations/0009_live_sends.sql packages/db/src/schema.ts packages/jobs/src/pipeline/pg-store.ts && git commit -m "0009: webhook_events, sender address, LinkedIn sequencing state, source rename to 'discovery'"`

---

### Task 2: Safety limits — LinkedIn message cap

**Files:**
- Modify: `packages/jobs/src/pipeline/safety-limits.ts`
- Test: `packages/jobs/src/pipeline/safety-limits.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the existing suite):

```ts
describe("linkedin message cap", () => {
  it("caps messages at 25/day regardless of account age", () => {
    expect(dailyAllowance("linkedin", 365, undefined, "message")).toBe(25);
    expect(dailyAllowance("linkedin", 3, undefined, "message")).toBe(25);
  });
  it("requested lowers but never raises the message cap", () => {
    expect(dailyAllowance("linkedin", 365, 10, "message")).toBe(10);
    expect(dailyAllowance("linkedin", 365, 500, "message")).toBe(25);
  });
  it("defaults to invite behavior when kind is omitted", () => {
    expect(dailyAllowance("linkedin", 3)).toBe(5); // ramp step unchanged
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @vantera/jobs test safety-limits` — expected FAIL (extra argument).

- [ ] **Step 3: Implement** — add the export and `kind` param:

```ts
export const LINKEDIN_STEADY_DAILY_MESSAGES = 25; // conservative; non-configurable (rule 04)

export type LinkedInSendKind = "invite" | "message";

function channelCeiling(
  channel: SafetyChannel,
  accountAgeDays: number,
  kind: LinkedInSendKind
): number {
  if (channel === "email") return EMAIL_STEADY_DAILY_PER_MAILBOX;
  if (kind === "message") return LINKEDIN_STEADY_DAILY_MESSAGES;
  const step = LINKEDIN_RAMP.find((s) => accountAgeDays < s.maxAgeDays);
  return step ? step.daily : LINKEDIN_STEADY_DAILY_INVITES;
}

export function dailyAllowance(
  channel: SafetyChannel,
  accountAgeDays: number,
  requested?: number,
  kind: LinkedInSendKind = "invite"
): number {
  const ceiling = channelCeiling(channel, Math.max(0, accountAgeDays), kind);
  if (requested === undefined) return ceiling;
  return Math.max(0, Math.min(requested, ceiling));
}
```

- [ ] **Step 4: Run** the same test file — expected PASS.
- [ ] **Step 5: Commit** — `git add packages/jobs/src/pipeline/safety-limits.ts packages/jobs/src/pipeline/safety-limits.test.ts && git commit -m "Safety limits: LinkedIn daily message cap alongside invite ramp (rule 04)"`

---

### Task 3: `EmailInfra` interface extensions + fake

**Files:**
- Modify: `packages/email-infra/src/types.ts`, `packages/email-infra/src/in-memory.ts`, `packages/email-infra/src/index.ts`
- Test: `packages/email-infra/src/in-memory.test.ts`

- [ ] **Step 1: Extend types** — append to `types.ts`:

```ts
/** One inbound provider event, already vendor-neutral. providerEventId feeds webhook_events dedupe. */
export type EmailEvent =
  | { type: "reply"; providerEventId: string; mailboxRef: string; from: string; body: string; receivedAt: string; messageRef: string | null }
  | { type: "bounce"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "complaint"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "unsubscribe"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "warmup_update"; providerEventId: string; mailboxRef: string; phase: "warming" | "ready"; dailyCap: number };
```

and extend the interfaces:

```ts
export interface OutboundEmail {
  mailboxId: string; // provider-side mailbox ref
  to: string;
  subject: string;
  body: string;
  campaignId: string;
  leadId: string;
  /** RFC 8058 one-click target; adapters set List-Unsubscribe headers from it */
  unsubscribeUrl?: string;
}

export interface EmailInfra {
  provision(req: ProvisionRequest): Promise<Mailbox[]>;
  send(email: OutboundEmail): Promise<SendResult>;
  warmupStatus(mailboxId: string): Promise<WarmupStatus>;
  parseReplyWebhook(payload: unknown): InboundReply | null;
  /** reject forged payloads BEFORE parsing; constant-time compare on the shared secret */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): EmailEvent | null;
}
```

- [ ] **Step 2: Write failing fake tests** (append to `in-memory.test.ts`):

```ts
describe("webhook events", () => {
  const infra = new InMemoryEmailInfra("test-secret");

  it("verifies the shared secret header", () => {
    expect(infra.verifyWebhook({ "x-webhook-secret": "test-secret" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "forged" }, "{}")).toBe(false);
    expect(infra.verifyWebhook({}, "{}")).toBe(false);
  });

  it("parses a reply event", () => {
    const event = infra.parseEventWebhook({
      event_id: "evt_1", event_type: "reply", mailbox_ref: "mbx_1",
      from: "prospect@acme.com", body: "tell me more", received_at: "2026-06-11T10:00:00Z",
      message_ref: "msg_9",
    });
    expect(event).toEqual({
      type: "reply", providerEventId: "evt_1", mailboxRef: "mbx_1",
      from: "prospect@acme.com", body: "tell me more",
      receivedAt: "2026-06-11T10:00:00Z", messageRef: "msg_9",
    });
  });

  it("parses bounce/complaint/unsubscribe/warmup events and rejects junk", () => {
    expect(
      infra.parseEventWebhook({ event_id: "evt_2", event_type: "bounce", mailbox_ref: "m", recipient: "a@b.c" })
    ).toEqual({ type: "bounce", providerEventId: "evt_2", mailboxRef: "m", recipient: "a@b.c" });
    expect(
      infra.parseEventWebhook({ event_id: "evt_3", event_type: "warmup_update", mailbox_ref: "m", phase: "ready", daily_cap: 40 })
    ).toEqual({ type: "warmup_update", providerEventId: "evt_3", mailboxRef: "m", phase: "ready", dailyCap: 40 });
    expect(infra.parseEventWebhook(null)).toBeNull();
    expect(infra.parseEventWebhook({ event_type: "reply" })).toBeNull();
  });
});
```

- [ ] **Step 3: Run** `pnpm --filter @vantera/email-infra test` — expected FAIL (constructor + methods missing).

- [ ] **Step 4: Implement in the fake** — give `InMemoryEmailInfra` a `constructor(private readonly webhookSecret = "in-memory-secret") {}`, then:

```ts
verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
  return headers["x-webhook-secret"] === this.webhookSecret;
}

parseEventWebhook(payload: unknown): EmailEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.event_id !== "string" || typeof p.mailbox_ref !== "string") return null;
  const base = { providerEventId: p.event_id, mailboxRef: p.mailbox_ref };
  switch (p.event_type) {
    case "reply":
      if (typeof p.from !== "string" || typeof p.body !== "string" || typeof p.received_at !== "string") return null;
      return { type: "reply", ...base, from: p.from, body: p.body, receivedAt: p.received_at,
        messageRef: typeof p.message_ref === "string" ? p.message_ref : null };
    case "bounce":
    case "complaint":
    case "unsubscribe":
      if (typeof p.recipient !== "string") return null;
      return { type: p.event_type, ...base, recipient: p.recipient };
    case "warmup_update":
      if ((p.phase !== "warming" && p.phase !== "ready") || typeof p.daily_cap !== "number") return null;
      return { type: "warmup_update", ...base, phase: p.phase, dailyCap: p.daily_cap };
    default:
      return null;
  }
}
```

- [ ] **Step 5: Run** the package tests — expected PASS (existing tests still construct `new InMemoryEmailInfra()` fine via the default).
- [ ] **Step 6: Commit** — `git add packages/email-infra/src && git commit -m "email-infra: webhook verification + vendor-neutral event parsing on the interface"`

---

### Task 4: Smartlead adapter

**Files:**
- Create: `packages/email-infra/src/smartlead.ts`, `packages/email-infra/src/smartlead.test.ts`
- Modify: `packages/email-infra/src/index.ts`

Adapter is fixture-tested; CI never calls Smartlead. The fetch fn is injected for tests. Vendor name never leaves this package: the factory export is `createEmailInfraFromEnv()`.

- [ ] **Step 1: Write failing tests** — `smartlead.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { SmartleadEmailInfra } from "./smartlead";

const fetchMock = (responses: Record<string, unknown>) =>
  vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      const key = Object.keys(responses).find((k) => url.includes(k));
      if (!key) throw new Error(`unmocked url: ${url}`);
      return responses[key];
    },
  })) as unknown as typeof fetch;

const infra = (responses: Record<string, unknown>) =>
  new SmartleadEmailInfra({ apiKey: "sk_test", webhookSecret: "whsec", fetchFn: fetchMock(responses) });

describe("SmartleadEmailInfra", () => {
  it("send posts to the reply/send endpoint and returns the message ref", async () => {
    const i = infra({ "/email-accounts/mbx_1/send": { message_id: "sl_msg_1", sent_at: "2026-06-11T10:00:00Z" } });
    const result = await i.send({
      mailboxId: "mbx_1", to: "a@b.c", subject: "hi", body: "hello",
      campaignId: "c1", leadId: "l1", unsubscribeUrl: "https://app/u/t1",
    });
    expect(result.messageId).toBe("sl_msg_1");
  });

  it("warmupStatus maps provider fields to the neutral shape", async () => {
    const i = infra({ "/email-accounts/mbx_1/warmup-stats": { warmup_status: "COMPLETED", max_email_per_day: 40 } });
    expect(await i.warmupStatus("mbx_1")).toEqual({ mailboxId: "mbx_1", phase: "ready", dailyCap: 40 });
  });

  it("verifyWebhook accepts the shared secret and rejects forgeries", () => {
    const i = infra({});
    expect(i.verifyWebhook({ "x-smartlead-secret": "whsec" }, "{}")).toBe(true);
    expect(i.verifyWebhook({ "x-smartlead-secret": "nope" }, "{}")).toBe(false);
  });

  it("parses Smartlead reply/bounce/unsubscribe webhooks into neutral events", () => {
    const i = infra({});
    expect(
      i.parseEventWebhook({
        webhook_id: "wh_1", event_type: "EMAIL_REPLY", email_account_id: "mbx_1",
        from_email: "p@acme.com", reply_body: "interested", event_timestamp: "2026-06-11T10:00:00Z",
        message_id: "sl_msg_1",
      })
    ).toEqual({
      type: "reply", providerEventId: "wh_1", mailboxRef: "mbx_1", from: "p@acme.com",
      body: "interested", receivedAt: "2026-06-11T10:00:00Z", messageRef: "sl_msg_1",
    });
    expect(
      i.parseEventWebhook({ webhook_id: "wh_2", event_type: "EMAIL_BOUNCE", email_account_id: "mbx_1", lead_email: "p@acme.com" })
    ).toEqual({ type: "bounce", providerEventId: "wh_2", mailboxRef: "mbx_1", recipient: "p@acme.com" });
    expect(i.parseEventWebhook({ event_type: "UNKNOWN" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @vantera/email-infra test smartlead` — expected FAIL (module missing).

- [ ] **Step 3: Implement `smartlead.ts`.** Skeleton (the executor fills the four endpoint paths against https://server.smartlead.ai/api/v1 — provision via SmartSenders order endpoints, send via the email-account send endpoint, warmup via warmup-stats; keep every Smartlead-specific name inside this file):

```ts
import type { EmailEvent, EmailInfra, InboundReply, Mailbox, OutboundEmail, ProvisionRequest, SendResult, WarmupStatus } from "./types";

export interface SmartleadConfig {
  apiKey: string;
  webhookSecret: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

export class SmartleadEmailInfra implements EmailInfra {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  constructor(private readonly cfg: SmartleadConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.baseUrl = cfg.baseUrl ?? "https://server.smartlead.ai/api/v1";
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await this.fetchFn(`${this.baseUrl}${path}${sep}api_key=${this.cfg.apiKey}`, {
      headers: { "content-type": "application/json" },
      ...init,
    });
    if (!res.ok) throw new Error(`email provider error ${res.status} on ${path}`);
    return (await res.json()) as T;
  }
  // ... provision / send / warmupStatus / parseReplyWebhook / verifyWebhook / parseEventWebhook
}

/** The only construction point product code may use (white-label, rule 03). */
export function createEmailInfraFromEnv(): EmailInfra {
  const apiKey = process.env.SMARTLEAD_API_KEY;
  const webhookSecret = process.env.SMARTLEAD_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) throw new Error("email infra env vars missing");
  return new SmartleadEmailInfra({ apiKey, webhookSecret });
}
```

`verifyWebhook` compares `headers["x-smartlead-secret"]` to `cfg.webhookSecret` (lowercase the header lookup). `parseEventWebhook` maps `EMAIL_REPLY → reply`, `EMAIL_BOUNCE → bounce`, `EMAIL_SPAM_COMPLAINT → complaint` (recipient from `lead_email`), `LEAD_UNSUBSCRIBED → unsubscribe`, `WARMUP_STATUS → warmup_update` (`COMPLETED → ready`, else `warming`); `webhook_id` (fallback: `event_type + event_timestamp`) becomes `providerEventId`. `send` sets `List-Unsubscribe`/`List-Unsubscribe-Post` headers from `unsubscribeUrl` in the request body's custom headers field.

- [ ] **Step 4: Run** `pnpm --filter @vantera/email-infra test` — expected PASS.
- [ ] **Step 5: Export** — `index.ts` adds `export { createEmailInfraFromEnv } from "./smartlead";` (the class itself is NOT exported from the package index).
- [ ] **Step 6: Commit** — `git add packages/email-infra/src && git commit -m "email-infra: Smartlead adapter behind createEmailInfraFromEnv (rule 03)"`

---

### Task 5: `LinkedInInfra` interface extensions + fake

**Files:**
- Modify: `packages/linkedin-infra/src/types.ts`, `packages/linkedin-infra/src/in-memory.ts`
- Test: `packages/linkedin-infra/src/in-memory.test.ts`

- [ ] **Step 1: Extend types** — append to `types.ts`:

```ts
export type LinkedInEvent =
  | { type: "reply"; providerEventId: string; connectedAccountRef: string; fromProfileUrl: string; body: string; receivedAt: string }
  | { type: "relationship_accepted"; providerEventId: string; connectedAccountRef: string; profileUrl: string }
  | { type: "account_status"; providerEventId: string; connectedAccountRef: string; status: "active" | "disconnected"; profileUrl: string | null; displayName: string | null; vanteraAccountId: string | null };
```

and add to the `LinkedInInfra` interface:

```ts
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): LinkedInEvent | null;
```

Document on `createHostedAuthLink(accountId)`: the `accountId` rides through the provider as hosted-auth metadata and comes back as `vanteraAccountId` on `account_status` events — that is how a connected identity is attributed to a tenant.

- [ ] **Step 2: Write failing fake tests** (append to `in-memory.test.ts`):

```ts
describe("webhook events", () => {
  const infra = new InMemoryLinkedInInfra("li-secret");

  it("verifies the shared secret", () => {
    expect(infra.verifyWebhook({ "x-webhook-secret": "li-secret" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "bad" }, "{}")).toBe(false);
  });

  it("parses reply, relationship and account events", () => {
    expect(
      infra.parseEventWebhook({
        event_id: "le_1", event_type: "reply", connected_account: "li_acc_1",
        from_profile_url: "https://linkedin.com/in/jane", body: "sure", received_at: "2026-06-11T11:00:00Z",
      })
    ).toEqual({
      type: "reply", providerEventId: "le_1", connectedAccountRef: "li_acc_1",
      fromProfileUrl: "https://linkedin.com/in/jane", body: "sure", receivedAt: "2026-06-11T11:00:00Z",
    });
    expect(
      infra.parseEventWebhook({ event_id: "le_2", event_type: "relationship_accepted", connected_account: "li_acc_1", profile_url: "https://linkedin.com/in/jane" })
    ).toEqual({ type: "relationship_accepted", providerEventId: "le_2", connectedAccountRef: "li_acc_1", profileUrl: "https://linkedin.com/in/jane" });
    expect(
      infra.parseEventWebhook({ event_id: "le_3", event_type: "account_status", connected_account: "li_acc_1", status: "active", profile_url: null, display_name: "Jane Doe", metadata_account_id: "acct-uuid" })
    ).toEqual({ type: "account_status", providerEventId: "le_3", connectedAccountRef: "li_acc_1", status: "active", profileUrl: null, displayName: "Jane Doe", vanteraAccountId: "acct-uuid" });
    expect(infra.parseEventWebhook({})).toBeNull();
  });
});
```

- [ ] **Step 3: Run** `pnpm --filter @vantera/linkedin-infra test` — expected FAIL.

- [ ] **Step 4: Implement in the fake** — constructor `(private readonly webhookSecret = "in-memory-secret")`; `verifyWebhook` mirrors the email fake; `parseEventWebhook` mirrors the email fake's shape-checking switch over `event_type` (`reply` requires `from_profile_url`/`body`/`received_at`; `relationship_accepted` requires `profile_url`; `account_status` requires `status` in `('active','disconnected')`, maps `metadata_account_id → vanteraAccountId`, `display_name → displayName`).

- [ ] **Step 5: Run** package tests — expected PASS.
- [ ] **Step 6: Commit** — `git add packages/linkedin-infra/src && git commit -m "linkedin-infra: webhook verification + neutral reply/relationship/account events"`

---

### Task 6: Unipile adapter

**Files:**
- Create: `packages/linkedin-infra/src/unipile.ts`, `packages/linkedin-infra/src/unipile.test.ts`
- Modify: `packages/linkedin-infra/src/index.ts`

Same pattern as Task 4: injected `fetchFn`, fixture tests, factory export `createLinkedInInfraFromEnv()` (reads `UNIPILE_API_KEY`, `UNIPILE_DSN`, `UNIPILE_WEBHOOK_SECRET`), class not exported from the index.

- [ ] **Step 1: Write failing tests** covering: `createHostedAuthLink` posts to `/api/v1/hosted/accounts/link` with `{ providers: ["LINKEDIN"], name: accountId, ... }` and returns `{ url, expiresAt }`; `sendInvite` posts to `/api/v1/users/invite` (note trimmed by caller, adapter passes through); `sendMessage` posts a chat message; `verifyWebhook` checks `x-unipile-secret` against the config secret; `parseEventWebhook` maps Unipile `new_message` → `reply`, `new_relation` → `relationship_accepted`, account `CREATION_SUCCESS`/`DISCONNECTED` notifications → `account_status` with `vanteraAccountId` from the hosted-auth `name` field. Use the same `fetchMock` helper shape as `smartlead.test.ts` (repeat it in this file — packages don't share test helpers).

- [ ] **Step 2: Run** `pnpm --filter @vantera/linkedin-infra test unipile` — expected FAIL.

- [ ] **Step 3: Implement `unipile.ts`:**

```ts
import type { HostedAuthLink, InviteRequest, LinkedInEvent, LinkedInInfra, MessageRequest, InboundLinkedInReply, SendOutcome } from "./types";

export interface UnipileConfig {
  apiKey: string;
  dsn: string; // e.g. api1.unipile.com:13211
  webhookSecret: string;
  fetchFn?: typeof fetch;
}

export class UnipileLinkedInInfra implements LinkedInInfra {
  private readonly fetchFn: typeof fetch;
  constructor(private readonly cfg: UnipileConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchFn(`https://${this.cfg.dsn}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-api-key": this.cfg.apiKey, ...init?.headers },
    });
    if (!res.ok) throw new Error(`linkedin provider error ${res.status} on ${path}`);
    return (await res.json()) as T;
  }
  // createHostedAuthLink / sendInvite / sendMessage / parseReplyWebhook / verifyWebhook / parseEventWebhook
}

export function createLinkedInInfraFromEnv(): LinkedInInfra {
  const { UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_WEBHOOK_SECRET } = process.env;
  if (!UNIPILE_API_KEY || !UNIPILE_DSN || !UNIPILE_WEBHOOK_SECRET) {
    throw new Error("linkedin infra env vars missing");
  }
  return new UnipileLinkedInInfra({ apiKey: UNIPILE_API_KEY, dsn: UNIPILE_DSN, webhookSecret: UNIPILE_WEBHOOK_SECRET });
}
```

- [ ] **Step 4: Run** package tests — expected PASS.
- [ ] **Step 5: Export the factory from `index.ts`; commit** — `git add packages/linkedin-infra/src && git commit -m "linkedin-infra: Unipile adapter behind createLinkedInInfraFromEnv (rule 04)"`

---

### Task 7: copy-draft — LinkedIn two-row drafts + send modes

The LinkedIn brain already returns `connectionNote` AND `followupMessage` (`packages/agent-brains/src/copy/linkedin.ts`) — Phase 3 only stored the note. Now both become rows, and `automatic` mode skips review for clean drafts.

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`, `packages/jobs/src/pipeline/copy-draft.ts`
- Test: `packages/jobs/src/pipeline/copy-draft.test.ts`

- [ ] **Step 1: Extend types** — in `types.ts`: `CopyContext.agent` gains `sendMode: "review" | "automatic";` (pg-store reads it from the agent's campaign row in Task 13); `NewScheduledSend` becomes:

```ts
export interface NewScheduledSend {
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "email" | "linkedin";
  subject: string | null;
  body: string;
  /** automatic mode inserts clean drafts as 'approved'; style-flagged drafts always review */
  status: "pending_review" | "approved";
  /** invite/message pair for LinkedIn (0009); null for email */
  linkedinStage: "invite" | "message" | null;
  styleFlags: string | null;
}
```

- [ ] **Step 2: Write failing tests** (extend the existing fake-store suite in `copy-draft.test.ts`, mirroring its helpers):

```ts
it("inserts an invite AND a message row per LinkedIn lead", async () => {
  // fake draftLinkedInFn returns { connectionNote: "note", followupMessage: "follow-up", violations: [] }
  await runCopyDraft(payload, deps);
  const linkedin = store.inserted.filter((s) => s.channel === "linkedin");
  expect(linkedin.map((s) => s.linkedinStage)).toEqual(["invite", "message"]);
  expect(linkedin[0].body).toBe("note");
  expect(linkedin[1].body).toBe("follow-up");
});

it("automatic mode inserts clean drafts as approved", async () => {
  // ctx.agent.sendMode = "automatic"; drafts with no violations
  await runCopyDraft(payload, deps);
  expect(store.inserted.every((s) => s.status === "approved")).toBe(true);
});

it("automatic mode still routes style-flagged drafts to review", async () => {
  // draftEmailFn returns violations: [{ rule: "buzzword", detail: "…" }]
  await runCopyDraft(payload, deps);
  expect(store.inserted[0].status).toBe("pending_review");
});
```

- [ ] **Step 3: Run** `pnpm --filter @vantera/jobs test copy-draft` — expected FAIL.

- [ ] **Step 4: Implement** — in `copy-draft.ts` add:

```ts
function draftStatus(
  sendMode: "review" | "automatic",
  violations: unknown[]
): "pending_review" | "approved" {
  return sendMode === "automatic" && violations.length === 0 ? "approved" : "pending_review";
}
```

Email insert gains `status: draftStatus(ctx.agent.sendMode, draft.violations), linkedinStage: null`. The LinkedIn branch becomes two inserts sharing one suppression check and one `draftLinkedInFn` call:

```ts
const draft = await deps.draftLinkedInFn(input);
const status = draftStatus(ctx.agent.sendMode, draft.violations);
const flags = draft.violations.length > 0 ? describeViolations(draft.violations) : null;
const common = { accountId, campaignId, leadId: lead.id, channel: "linkedin" as const, subject: null, status, styleFlags: flags };
await deps.store.insertScheduledSend({ ...common, linkedinStage: "invite", body: draft.connectionNote });
await deps.store.insertScheduledSend({ ...common, linkedinStage: "message", body: draft.followupMessage });
leadDrafted += 1;
```

Update the stale Phase-3 comments ("first touch only…", "stops at pending_review until Phase 5"). `pg-store.insertScheduledSend` passes `linkedinStage` through (one-line change here; full pg-store work is Task 13).

- [ ] **Step 5: Run** `pnpm --filter @vantera/jobs test copy-draft` — expected PASS (existing tests updated for the extra row where they count inserts).
- [ ] **Step 6: Commit** — `git add packages/jobs/src/pipeline && git commit -m "copy-draft: LinkedIn invite+message draft pair, automatic send mode (flagged drafts still review)"`

---

### Task 8: Reply classification brain

**Files:**
- Create: `packages/agent-brains/src/reply/classify.ts`, `packages/agent-brains/src/reply/classify.test.ts`
- Modify: `packages/agent-brains/src/index.ts` (export)

Mirror the copy-brain conventions: zod schema exported next to the brain, `model` injectable with `getModel()` default, mock model in tests (same mock pattern as `copy/email.test.ts`). Purity guardrail (`purity.test.ts`) applies automatically.

- [ ] **Step 1: Write failing tests:**

```ts
import { describe, expect, it } from "vitest";
import { classifyReply, preClassify } from "./classify";

describe("preClassify (deterministic, no model call)", () => {
  it("catches unsubscribe requests", () => {
    expect(preClassify("please remove me from your list")?.classification).toBe("unsubscribe");
    expect(preClassify("STOP EMAILING ME")?.classification).toBe("unsubscribe");
  });
  it("catches out-of-office auto-replies", () => {
    expect(preClassify("I am out of office until Monday")?.classification).toBe("out_of_office");
    expect(preClassify("Automatic reply: on parental leave")?.classification).toBe("out_of_office");
  });
  it("passes everything else to the model", () => {
    expect(preClassify("sounds interesting, tell me more")).toBeNull();
  });
});

describe("classifyReply", () => {
  it("returns the pre-classification without calling the model", async () => {
    const verdict = await classifyReply("unsubscribe please", neverCallModel);
    expect(verdict.classification).toBe("unsubscribe");
  });
  it("uses the model for nuanced replies", async () => {
    const verdict = await classifyReply(
      "sounds interesting, tell me more",
      mockModelReturning({ classification: "interested", rationale: "asks to learn more" })
    );
    expect(verdict.classification).toBe("interested");
  });
});
```

(`neverCallModel` throws if invoked; `mockModelReturning` follows the `MockLanguageModel` setup already used in `copy/email.test.ts` — copy that helper style.)

- [ ] **Step 2: Run** `pnpm --filter @vantera/agent-brains test reply` — expected FAIL.

- [ ] **Step 3: Implement `classify.ts`:**

```ts
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";

export const replyVerdictSchema = z.object({
  classification: z.enum(["interested", "not_interested", "neutral", "out_of_office", "unsubscribe", "other"]),
  rationale: z.string().max(300),
});
export type ReplyVerdict = z.infer<typeof replyVerdictSchema>;

const UNSUB_PATTERNS = [/unsubscribe/i, /remove me/i, /take me off/i, /stop (emailing|messaging|contacting)/i, /don'?t contact/i];
const OOO_PATTERNS = [/out of (the )?office/i, /on (annual|parental|sick) leave/i, /auto(matic)?[- ]?reply/i];

/** Deterministic first pass: legal-significance phrases never depend on a model. */
export function preClassify(body: string): ReplyVerdict | null {
  if (UNSUB_PATTERNS.some((p) => p.test(body))) {
    return { classification: "unsubscribe", rationale: "explicit removal request" };
  }
  if (OOO_PATTERNS.some((p) => p.test(body))) {
    return { classification: "out_of_office", rationale: "auto-responder phrasing" };
  }
  return null;
}

const SYSTEM = `You classify a prospect's reply to B2B outreach.
interested = wants to learn more or accepts the ask. not_interested = a clear no, polite or hard.
neutral = ambiguous, or a question without commitment. out_of_office = auto-responder.
unsubscribe = asks to stop contact. other = wrong person, forwarded, anything else.
Rationale: one short sentence.`;

export async function classifyReply(
  body: string,
  model: LanguageModel = getModel()
): Promise<ReplyVerdict> {
  const pre = preClassify(body);
  if (pre) return pre;
  const { object } = await generateObject({
    model,
    schema: replyVerdictSchema,
    system: SYSTEM,
    prompt: `Reply:\n${body.slice(0, 2000)}`,
    maxOutputTokens: 200,
  });
  return object;
}
```

- [ ] **Step 4: Run** the test file — expected PASS. Also run `pnpm --filter @vantera/agent-brains test purity` — PASS.
- [ ] **Step 5: Export** from `packages/agent-brains/src/index.ts`: `export { classifyReply, preClassify, replyVerdictSchema, type ReplyVerdict } from "./reply/classify";`
- [ ] **Step 6: Commit** — `git add packages/agent-brains/src && git commit -m "Reply brain: deterministic unsubscribe/OOO pre-checks + AI classification"`

---

### Task 9: Email compliance footer

**Files:**
- Create: `packages/jobs/src/pipeline/email-footer.ts`, `packages/jobs/src/pipeline/email-footer.test.ts`

- [ ] **Step 1: Write failing tests:**

```ts
import { describe, expect, it } from "vitest";
import { appendComplianceFooter, formatSenderAddress, parseSenderAddress } from "./email-footer";

const address = { line1: "100 Main St", line2: "Suite 4", city: "Austin", region: "TX", postal: "78701", country: "USA" };

describe("compliance footer (rule 11: unsubscribe + physical address)", () => {
  it("formats the address on one line, skipping empty parts", () => {
    expect(formatSenderAddress(address)).toBe("100 Main St, Suite 4, Austin, TX 78701, USA");
    expect(formatSenderAddress({ ...address, line2: null, region: null })).toBe("100 Main St, Austin 78701, USA");
  });
  it("appends address and unsubscribe link after the body", () => {
    const out = appendComplianceFooter("Hi Jane,\n\nshort pitch", "https://app.example.com/api/unsubscribe/tok1", address);
    expect(out).toContain("short pitch");
    expect(out).toMatch(/100 Main St.*Austin/);
    expect(out).toContain("https://app.example.com/api/unsubscribe/tok1");
    expect(out.indexOf("short pitch")).toBeLessThan(out.indexOf("unsubscribe/tok1"));
  });
  it("parseSenderAddress rejects rows missing required fields", () => {
    expect(parseSenderAddress({ line1: "x", city: "y", postal: "1", country: "US" })).not.toBeNull();
    expect(parseSenderAddress({ city: "y" })).toBeNull();
    expect(parseSenderAddress(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @vantera/jobs test email-footer` — expected FAIL.

- [ ] **Step 3: Implement:**

```ts
/** rule 11: every cold email carries an unsubscribe link + the customer's physical address. */

export interface SenderAddress {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal: string;
  country: string;
}

export function parseSenderAddress(value: unknown): SenderAddress | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.line1 !== "string" || typeof v.city !== "string" ||
    typeof v.postal !== "string" || typeof v.country !== "string"
  ) {
    return null;
  }
  return {
    line1: v.line1,
    line2: typeof v.line2 === "string" ? v.line2 : null,
    city: v.city,
    region: typeof v.region === "string" ? v.region : null,
    postal: v.postal,
    country: v.country,
  };
}

export function formatSenderAddress(a: SenderAddress): string {
  // "Austin, TX 78701" — region+postal share a space, city joins with a comma
  const cityLine = [a.city, [a.region, a.postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(", ");
}

export function appendComplianceFooter(body: string, unsubscribeUrl: string, address: SenderAddress): string {
  return `${body}\n\n--\n${formatSenderAddress(address)}\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`;
}
```

- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** — `git add packages/jobs/src/pipeline/email-footer.ts packages/jobs/src/pipeline/email-footer.test.ts && git commit -m "Compliance footer: physical address + unsubscribe link appended at send time (rule 11)"`

---

### Task 10: `send-dispatch` core (the gatekeeper)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (new store interfaces)
- Create: `packages/jobs/src/pipeline/send-dispatch.ts`, `packages/jobs/src/pipeline/send-dispatch.test.ts`

- [ ] **Step 1: Add types to `types.ts`:**

```ts
export interface DispatchableSend {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "email" | "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: "approved" | "scheduled";
  accountPaused: boolean;
  hasSenderAddress: boolean;
  campaignStatus: string;
  leadInvitedAt: Date | null;
  leadConnectedAt: Date | null;
}

export interface SendDispatchStore {
  isKillSwitchOn(): Promise<boolean>;
  /** approved rows + scheduled rows whose scheduled_for is older than staleCutoff (lost-task recovery) */
  getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]>;
  /** Σ over ACTIVE mailboxes of min(daily_send_limit ?? cap, cap) − sends recorded today */
  getEmailCapacity(accountId: string, dayStart: Date): Promise<number>;
  /** null = no active LinkedIn identity */
  getLinkedInAccountAgeDays(accountId: string, now: Date): Promise<number | null>;
  countLinkedInSentToday(accountId: string, kind: "invite" | "message", dayStart: Date): Promise<number>;
  markScheduled(sendId: string, scheduledFor: Date): Promise<void>;
  cancelSend(sendId: string, error: string): Promise<void>;
}

export interface SendDispatchDeps {
  store: SendDispatchStore;
  /** wrapper triggers the outreach-send task with a delay */
  enqueue: (sendId: string, runAt: Date) => Promise<void>;
  now?: () => Date;
}

export interface SendDispatchSummary {
  status: "halted" | "completed";
  scheduled: number;
  canceled: number;
  skipped: number;
}
```

- [ ] **Step 2: Write failing tests** — fake store as a plain object with arrays; key cases:

```ts
it("does nothing when the platform kill switch is on", async () => {
  store.killSwitch = true;
  expect((await runSendDispatch(deps)).status).toBe("halted");
  expect(enqueued).toHaveLength(0);
});

it("skips paused accounts and inactive campaigns", async () => { /* accountPaused / campaignStatus 'paused' rows → skipped, none enqueued */ });

it("skips email for accounts without a sender address", async () => { /* hasSenderAddress false → skipped */ });

it("schedules emails up to the account's mailbox capacity", async () => {
  store.emailCapacity = 2; // 3 approved email rows
  const summary = await runSendDispatch(deps);
  expect(summary.scheduled).toBe(2);
  expect(summary.skipped).toBe(1);
});

it("respects LinkedIn invite ramp and message cap separately", async () => { /* age 3d → invite budget 5; message rows gated by connectedAt */ });

it("parks message rows until the lead is connected", async () => { /* leadConnectedAt null, invitedAt recent → skipped, not canceled */ });

it("cancels message rows whose invite expired unaccepted", async () => {
  // leadInvitedAt 31 days ago, leadConnectedAt null
  const summary = await runSendDispatch(deps);
  expect(summary.canceled).toBe(1);
  expect(store.cancellations[0].error).toMatch(/expired/);
});

it("assigns strictly increasing jittered times", async () => {
  // 3 schedulable rows → scheduledFor values strictly increasing, all > now
});

it("skips invite rows for already-invited leads (stale recovery safety)", async () => { /* leadInvitedAt set on an invite row → skipped */ });
```

- [ ] **Step 3: Run** `pnpm --filter @vantera/jobs test send-dispatch` — expected FAIL.

- [ ] **Step 4: Implement `send-dispatch.ts`:**

```ts
import { dailyAllowance, paceWithJitter } from "./safety-limits";
import type { DispatchableSend, SendDispatchDeps, SendDispatchSummary } from "./types";

export const INVITE_EXPIRY_DAYS = 30;
export const STALE_TASK_MINUTES = 30;
const BASE_GAP_MS = 15 * 60_000; // ~human pacing between sends per account

function seedFrom(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function dayStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The send gatekeeper (rules 04/11): every outbound send passes here first.
 * Kill switch → nothing moves. Caps clamp, never raise. Times jitter like a human.
 */
export async function runSendDispatch(deps: SendDispatchDeps): Promise<SendDispatchSummary> {
  const now = deps.now?.() ?? new Date();
  if (await deps.store.isKillSwitchOn()) {
    return { status: "halted", scheduled: 0, canceled: 0, skipped: 0 };
  }
  const staleCutoff = new Date(now.getTime() - STALE_TASK_MINUTES * 60_000);
  const sends = await deps.store.getDispatchableSends(staleCutoff);
  const dayStart = dayStartUtc(now);

  const byAccount = new Map<string, DispatchableSend[]>();
  for (const s of sends) {
    const list = byAccount.get(s.accountId) ?? [];
    list.push(s);
    byAccount.set(s.accountId, list);
  }

  let scheduled = 0;
  let canceled = 0;
  let skipped = 0;

  for (const [accountId, rows] of byAccount) {
    if (rows[0]?.accountPaused) {
      skipped += rows.length;
      continue;
    }
    const active = rows.filter((r) => r.campaignStatus === "active");
    skipped += rows.length - active.length;
    let offsetMs = 0;

    const schedule = async (row: DispatchableSend) => {
      offsetMs += paceWithJitter(BASE_GAP_MS, seedFrom(row.id));
      const runAt = new Date(now.getTime() + offsetMs);
      await deps.store.markScheduled(row.id, runAt);
      await deps.enqueue(row.id, runAt);
      scheduled += 1;
    };

    // email
    const emails = active.filter((r) => r.channel === "email");
    if (emails.length > 0) {
      if (!emails[0].hasSenderAddress) {
        skipped += emails.length; // rule 11: no physical address, no cold email
      } else {
        let capacity = await deps.store.getEmailCapacity(accountId, dayStart);
        for (const row of emails) {
          if (capacity <= 0) {
            skipped += 1;
            continue;
          }
          await schedule(row);
          capacity -= 1;
        }
      }
    }

    // linkedin
    const lis = active.filter((r) => r.channel === "linkedin");
    if (lis.length > 0) {
      const ageDays = await deps.store.getLinkedInAccountAgeDays(accountId, now);
      if (ageDays === null) {
        skipped += lis.length; // no connected identity
        continue;
      }
      let inviteBudget =
        dailyAllowance("linkedin", ageDays) -
        (await deps.store.countLinkedInSentToday(accountId, "invite", dayStart));
      let messageBudget =
        dailyAllowance("linkedin", ageDays, undefined, "message") -
        (await deps.store.countLinkedInSentToday(accountId, "message", dayStart));

      for (const row of lis) {
        if (row.linkedinStage === "message") {
          if (!row.leadConnectedAt) {
            const invitedMs = row.leadInvitedAt ? now.getTime() - row.leadInvitedAt.getTime() : 0;
            if (row.leadInvitedAt && invitedMs > INVITE_EXPIRY_DAYS * 86_400_000) {
              await deps.store.cancelSend(row.id, "invite expired unaccepted");
              canceled += 1;
            } else {
              skipped += 1; // parked until acceptance
            }
            continue;
          }
          if (messageBudget <= 0) {
            skipped += 1;
            continue;
          }
          messageBudget -= 1;
        } else {
          if (row.leadInvitedAt) {
            skipped += 1; // invite already went out (stale-row safety)
            continue;
          }
          if (inviteBudget <= 0) {
            skipped += 1;
            continue;
          }
          inviteBudget -= 1;
        }
        await schedule(row);
      }
    }
  }

  return { status: "completed", scheduled, canceled, skipped };
}
```

- [ ] **Step 5: Run** the test file — expected PASS.
- [ ] **Step 6: Commit** — `git add packages/jobs/src/pipeline && git commit -m "send-dispatch core: kill switch, pause, caps, warmup capacity, LinkedIn sequencing, jittered pacing"`

---

### Task 11: `outreach-send` core (the boundary)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`
- Create: `packages/jobs/src/pipeline/outreach-send.ts`, `packages/jobs/src/pipeline/outreach-send.test.ts`

- [ ] **Step 1: Add types to `types.ts`:**

```ts
import type { SenderAddress } from "./email-footer";
import type { EmailInfra } from "@vantera/email-infra";
import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface SendContext {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "email" | "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: string;
  subject: string | null;
  body: string | null;
  campaignStatus: string;
  accountPaused: boolean;
  senderAddress: SenderAddress | null;
  lead: { email: string | null; linkedinUrl: string | null };
}

export interface OutreachSendStore {
  getSendContext(sendId: string): Promise<SendContext | null>;
  isKillSwitchOn(): Promise<boolean>;
  isSuppressed(accountId: string, kind: "email" | "linkedin", value: string): Promise<boolean>;
  /** optimistic claim: scheduled → sending; false means another run owns it */
  claimSending(sendId: string): Promise<boolean>;
  revertToApproved(sendId: string): Promise<void>;
  markSent(sendId: string): Promise<void>;
  markFailed(sendId: string, error: string): Promise<void>;
  markSuppressed(sendId: string): Promise<void>;
  pickActiveMailbox(accountId: string): Promise<{ id: string; providerRef: string | null; status: string } | null>;
  getActiveLinkedInIdentity(accountId: string): Promise<{ id: string; providerRef: string; status: string } | null>;
  createUnsubscribeToken(accountId: string, leadId: string, email: string): Promise<string>;
  recordOutreachSend(rec: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "email" | "linkedin";
    mailboxId?: string;
    linkedinAccountId?: string;
    messageRef: string | null;
  }): Promise<void>;
  setLeadInvited(leadId: string, at: Date): Promise<void>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "queued" | "suppressed" | "skipped" | "sent"): Promise<void>;
}

export interface OutreachSendDeps {
  store: OutreachSendStore;
  emailInfra: EmailInfra;
  linkedinInfra: LinkedInInfra;
  appUrl: string;
  now?: () => Date;
}

export type OutreachSendOutcome = "sent" | "suppressed" | "parked" | "failed" | "skipped";
```

(`CopyDraftStore.setCampaignLeadStatus` already exists with `"queued" | "suppressed" | "skipped"` — widen that union to include `"sent"` so one signature serves both. The `EmailInfra`/`LinkedInInfra` type imports require adding `@vantera/email-infra` and `@vantera/linkedin-infra` as workspace dependencies in `packages/jobs/package.json` if they aren't already.)

- [ ] **Step 2: Write failing tests.** Use `InMemoryEmailInfra`/`InMemoryLinkedInInfra` as the infra deps and a fake store. The guardrail cases (rule 11 definition of done):

```ts
it("NEVER sends to a suppressed lead — rule 11", async () => {
  store.suppressed.add("prospect@acme.com");
  const outcome = await runOutreachSend({ sendId: "s1" }, deps);
  expect(outcome).toBe("suppressed");
  expect(emailInfra.sentEmails).toHaveLength(0);
  expect(store.statuses.s1).toBe("suppressed");
});

it("parks the send when the kill switch flips on after dispatch", async () => {
  store.killSwitch = true;
  expect(await runOutreachSend({ sendId: "s1" }, deps)).toBe("parked");
  expect(emailInfra.sentEmails).toHaveLength(0);
  expect(store.statuses.s1).toBe("approved"); // reverted, retried next tick
});

it("never sends from a warming mailbox", async () => {
  store.mailbox = { id: "m1", providerRef: "ref1", status: "warming" };
  expect(await runOutreachSend({ sendId: "s1" }, deps)).toBe("parked");
  expect(emailInfra.sentEmails).toHaveLength(0);
});

it("appends unsubscribe link + physical address to every email", async () => {
  await runOutreachSend({ sendId: "s1" }, deps);
  const sent = emailInfra.sentEmails[0];
  expect(sent.body).toContain("/api/unsubscribe/");
  expect(sent.body).toContain("100 Main St");
  expect(sent.unsubscribeUrl).toMatch(/\/api\/unsubscribe\//);
});

it("LinkedIn invite truncates the note to 200 chars and records linkedin_invited_at", async () => { /* stage 'invite', 300-char body */ });
it("LinkedIn message goes through sendMessage", async () => { /* stage 'message' */ });
it("provider failure marks the row failed with the error", async () => { /* infra.send throws */ });
it("does not double-send when the claim is lost", async () => { /* claimSending false → skipped, no provider call */ });
it("records the audit row on success", async () => { /* outreach_sends record with messageRef */ });
```

- [ ] **Step 3: Run** — expected FAIL.

- [ ] **Step 4: Implement `outreach-send.ts`:**

```ts
import { appendComplianceFooter } from "./email-footer";
import { normalizeLinkedInUrl } from "./copy-draft";
import type { OutreachSendDeps, OutreachSendOutcome } from "./types";

export const LINKEDIN_NOTE_MAX = 200;

/**
 * One live send. Re-checks suppression, kill switch, pause and identity health
 * immediately before the provider call (rule 11) — dispatch-time checks are not
 * trusted across the delay.
 */
export async function runOutreachSend(
  payload: { sendId: string },
  deps: OutreachSendDeps
): Promise<OutreachSendOutcome> {
  const now = deps.now?.() ?? new Date();
  const ctx = await deps.store.getSendContext(payload.sendId);
  if (!ctx || ctx.status !== "scheduled") return "skipped";

  if ((await deps.store.isKillSwitchOn()) || ctx.accountPaused || ctx.campaignStatus !== "active") {
    await deps.store.revertToApproved(ctx.id);
    return "parked";
  }

  const target =
    ctx.channel === "email"
      ? ctx.lead.email?.toLowerCase() ?? null
      : ctx.lead.linkedinUrl ? normalizeLinkedInUrl(ctx.lead.linkedinUrl) : null;
  if (!target) {
    await deps.store.markFailed(ctx.id, "missing contact info");
    return "failed";
  }
  if (await deps.store.isSuppressed(ctx.accountId, ctx.channel, target)) {
    await deps.store.markSuppressed(ctx.id);
    await deps.store.setCampaignLeadStatus(ctx.campaignId, ctx.leadId, "suppressed");
    return "suppressed";
  }

  if (!(await deps.store.claimSending(ctx.id))) return "skipped";

  try {
    if (ctx.channel === "email") {
      const mailbox = await deps.store.pickActiveMailbox(ctx.accountId);
      // belt-and-braces: the store filters to active, the core refuses anything else
      if (!mailbox || mailbox.status !== "active" || !mailbox.providerRef || !ctx.senderAddress) {
        await deps.store.revertToApproved(ctx.id);
        return "parked";
      }
      const token = await deps.store.createUnsubscribeToken(ctx.accountId, ctx.leadId, target);
      const unsubscribeUrl = `${deps.appUrl}/api/unsubscribe/${token}`;
      const body = appendComplianceFooter(ctx.body ?? "", unsubscribeUrl, ctx.senderAddress);
      const result = await deps.emailInfra.send({
        mailboxId: mailbox.providerRef,
        to: target,
        subject: ctx.subject ?? "",
        body,
        campaignId: ctx.campaignId,
        leadId: ctx.leadId,
        unsubscribeUrl,
      });
      await deps.store.markSent(ctx.id);
      await deps.store.recordOutreachSend({
        accountId: ctx.accountId, campaignId: ctx.campaignId, leadId: ctx.leadId,
        scheduledSendId: ctx.id, channel: "email", mailboxId: mailbox.id, messageRef: result.messageId,
      });
    } else {
      const identity = await deps.store.getActiveLinkedInIdentity(ctx.accountId);
      if (!identity || identity.status !== "active") {
        await deps.store.revertToApproved(ctx.id);
        return "parked";
      }
      let messageRef: string | null = null;
      if (ctx.linkedinStage === "message") {
        const r = await deps.linkedinInfra.sendMessage({
          connectedAccountId: identity.providerRef,
          profileUrl: ctx.lead.linkedinUrl as string,
          body: ctx.body ?? "",
        });
        messageRef = r.id;
      } else {
        const r = await deps.linkedinInfra.sendInvite({
          connectedAccountId: identity.providerRef,
          profileUrl: ctx.lead.linkedinUrl as string,
          note: (ctx.body ?? "").slice(0, LINKEDIN_NOTE_MAX),
        });
        await deps.store.setLeadInvited(ctx.leadId, now);
        messageRef = r.id;
      }
      await deps.store.markSent(ctx.id);
      await deps.store.recordOutreachSend({
        accountId: ctx.accountId, campaignId: ctx.campaignId, leadId: ctx.leadId,
        scheduledSendId: ctx.id, channel: "linkedin", linkedinAccountId: identity.id, messageRef,
      });
    }
    await deps.store.setCampaignLeadStatus(ctx.campaignId, ctx.leadId, "sent");
    return "sent";
  } catch (err) {
    await deps.store.markFailed(ctx.id, err instanceof Error ? err.message : String(err));
    return "failed";
  }
}
```

- [ ] **Step 5: Run** — expected PASS.
- [ ] **Step 6: Commit** — `git add packages/jobs/src/pipeline && git commit -m "outreach-send core: boundary suppression/kill-switch re-check, footer, LinkedIn stages, audit row (rule 11)"`

---

### Task 12: `inbound` core (webhook event routing)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`
- Create: `packages/jobs/src/pipeline/inbound.ts`, `packages/jobs/src/pipeline/inbound.test.ts`

- [ ] **Step 1: Add types:**

```ts
import type { ReplyVerdict } from "@vantera/agent-brains";

export interface InboundPayload {
  source: "email" | "linkedin";
  payload: unknown;
}

export interface InboundStore {
  findMailboxByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
  findLinkedInAccountByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
  /** insert-or-update by (accountId, providerRef); sets connected_at when turning active */
  upsertLinkedInAccountStatus(e: {
    vanteraAccountId: string; providerRef: string; status: "active" | "disconnected";
    profileUrl: string | null; displayName: string | null;
  }): Promise<void>;
  findLeadByEmail(accountId: string, email: string): Promise<{ id: string; campaignId: string | null } | null>;
  findLeadByLinkedInUrl(accountId: string, normalizedUrl: string): Promise<{ id: string; campaignId: string | null } | null>;
  insertReply(r: {
    accountId: string; leadId: string; campaignId: string | null;
    channel: "email" | "linkedin"; providerMessageRef: string | null;
    body: string; receivedAt: Date;
  }): Promise<string>;
  setReplyClassification(replyId: string, verdict: ReplyVerdict): Promise<void>;
  addSuppression(accountId: string, kind: "email" | "linkedin", value: string,
    source: "unsubscribe" | "bounce" | "complaint" | "not_interested", leadId?: string): Promise<void>;
  pauseMailbox(mailboxId: string): Promise<void>;
  updateMailboxWarmup(mailboxId: string, status: "warming" | "active", dailyCap: number): Promise<void>;
  setLeadConnected(leadId: string, at: Date): Promise<void>;
  setLeadReplied(leadId: string, campaignId: string | null): Promise<void>;
  /** approved/scheduled/pending_review drafts for the lead → canceled; returns count */
  cancelPendingSends(leadId: string): Promise<number>;
}

export interface InboundDeps {
  store: InboundStore;
  emailInfra: Pick<EmailInfra, "parseEventWebhook">;
  linkedinInfra: Pick<LinkedInInfra, "parseEventWebhook">;
  classifyFn: (body: string) => Promise<ReplyVerdict>;
  now?: () => Date;
}

export interface InboundSummary { handled: boolean; action: string; }
```

- [ ] **Step 2: Write failing tests** — fake store + the in-memory infra fakes; `classifyFn` stubbed per test:

```ts
it("classifies a reply and marks the lead replied when interested", async () => { /* reply event → insertReply, setReplyClassification(interested), setLeadReplied, cancelPendingSends called */ });
it("suppresses on not_interested classification", async () => { /* addSuppression('email', from, 'not_interested', leadId) */ });
it("suppresses on reply-text unsubscribe", async () => { /* classifyFn returns unsubscribe */ });
it("does NOT cancel pending sends for out_of_office replies", async () => { /* cancelPendingSends not called */ });
it("bounce → suppression(bounce) + cancels the lead's sends", async () => {});
it("complaint → suppression(complaint) + pauses the mailbox", async () => {});
it("warmup_update flips the mailbox active with the new cap", async () => {});
it("relationship_accepted sets linkedin_connected_at", async () => {});
it("account_status upserts the linkedin identity for the right tenant", async () => {});
it("unknown payloads are reported unhandled, no side effects", async () => {});
```

- [ ] **Step 3: Run** — expected FAIL.

- [ ] **Step 4: Implement `inbound.ts`** — a switch over the parsed event. Reply handling order matters: classify FIRST, then react (out_of_office preserves the sequence — deliberate deviation from "every reply cancels", noted in the spec's intent):

```ts
import { normalizeLinkedInUrl } from "./copy-draft";
import type { InboundDeps, InboundPayload, InboundSummary } from "./types";

export async function runInbound(payload: InboundPayload, deps: InboundDeps): Promise<InboundSummary> {
  const now = deps.now?.() ?? new Date();

  if (payload.source === "email") {
    const event = deps.emailInfra.parseEventWebhook(payload.payload);
    if (!event) return { handled: false, action: "unparseable" };
    const mailbox = await deps.store.findMailboxByProviderRef(event.mailboxRef);
    if (!mailbox) return { handled: false, action: "unknown mailbox" };
    const { accountId } = mailbox;

    switch (event.type) {
      case "reply": {
        const from = event.from.toLowerCase();
        const lead = await deps.store.findLeadByEmail(accountId, from);
        if (!lead) return { handled: false, action: "no matching lead" };
        const replyId = await deps.store.insertReply({
          accountId, leadId: lead.id, campaignId: lead.campaignId, channel: "email",
          providerMessageRef: event.messageRef, body: event.body, receivedAt: new Date(event.receivedAt),
        });
        const verdict = await deps.classifyFn(event.body);
        await deps.store.setReplyClassification(replyId, verdict);
        if (verdict.classification !== "out_of_office") {
          await deps.store.cancelPendingSends(lead.id);
          await deps.store.setLeadReplied(lead.id, lead.campaignId);
        }
        if (verdict.classification === "not_interested") {
          await deps.store.addSuppression(accountId, "email", from, "not_interested", lead.id);
        } else if (verdict.classification === "unsubscribe") {
          await deps.store.addSuppression(accountId, "email", from, "unsubscribe", lead.id);
        }
        return { handled: true, action: `reply:${verdict.classification}` };
      }
      case "bounce": {
        const recipient = event.recipient.toLowerCase();
        await deps.store.addSuppression(accountId, "email", recipient, "bounce");
        const lead = await deps.store.findLeadByEmail(accountId, recipient);
        if (lead) await deps.store.cancelPendingSends(lead.id);
        return { handled: true, action: "bounce" };
      }
      case "complaint": {
        const recipient = event.recipient.toLowerCase();
        await deps.store.addSuppression(accountId, "email", recipient, "complaint");
        await deps.store.pauseMailbox(mailbox.id);
        const lead = await deps.store.findLeadByEmail(accountId, recipient);
        if (lead) await deps.store.cancelPendingSends(lead.id);
        return { handled: true, action: "complaint" };
      }
      case "unsubscribe": {
        const recipient = event.recipient.toLowerCase();
        await deps.store.addSuppression(accountId, "email", recipient, "unsubscribe");
        const lead = await deps.store.findLeadByEmail(accountId, recipient);
        if (lead) await deps.store.cancelPendingSends(lead.id);
        return { handled: true, action: "unsubscribe" };
      }
      case "warmup_update": {
        await deps.store.updateMailboxWarmup(
          mailbox.id, event.phase === "ready" ? "active" : "warming", event.dailyCap
        );
        return { handled: true, action: "warmup_update" };
      }
    }
  }

  const event = deps.linkedinInfra.parseEventWebhook(payload.payload);
  if (!event) return { handled: false, action: "unparseable" };

  if (event.type === "account_status") {
    if (!event.vanteraAccountId) return { handled: false, action: "account event without tenant" };
    await deps.store.upsertLinkedInAccountStatus({
      vanteraAccountId: event.vanteraAccountId, providerRef: event.connectedAccountRef,
      status: event.status, profileUrl: event.profileUrl, displayName: event.displayName,
    });
    return { handled: true, action: `account:${event.status}` };
  }

  const identity = await deps.store.findLinkedInAccountByProviderRef(event.connectedAccountRef);
  if (!identity) return { handled: false, action: "unknown linkedin identity" };
  const { accountId } = identity;

  if (event.type === "relationship_accepted") {
    const lead = await deps.store.findLeadByLinkedInUrl(accountId, normalizeLinkedInUrl(event.profileUrl));
    if (!lead) return { handled: false, action: "no matching lead" };
    await deps.store.setLeadConnected(lead.id, now);
    return { handled: true, action: "relationship_accepted" };
  }

  // reply
  const url = normalizeLinkedInUrl(event.fromProfileUrl);
  const lead = await deps.store.findLeadByLinkedInUrl(accountId, url);
  if (!lead) return { handled: false, action: "no matching lead" };
  const replyId = await deps.store.insertReply({
    accountId, leadId: lead.id, campaignId: lead.campaignId, channel: "linkedin",
    providerMessageRef: null, body: event.body, receivedAt: new Date(event.receivedAt),
  });
  const verdict = await deps.classifyFn(event.body);
  await deps.store.setReplyClassification(replyId, verdict);
  if (verdict.classification !== "out_of_office") {
    await deps.store.cancelPendingSends(lead.id);
    await deps.store.setLeadReplied(lead.id, lead.campaignId);
  }
  if (verdict.classification === "not_interested") {
    await deps.store.addSuppression(accountId, "linkedin", url, "not_interested", lead.id);
  } else if (verdict.classification === "unsubscribe") {
    await deps.store.addSuppression(accountId, "linkedin", url, "unsubscribe", lead.id);
  }
  return { handled: true, action: `reply:${verdict.classification}` };
}
```

- [ ] **Step 5: Run** — expected PASS.
- [ ] **Step 6: Commit** — `git add packages/jobs/src/pipeline && git commit -m "inbound core: reply classification reactions, bounce/complaint/unsubscribe suppression, LinkedIn relationship + account events"`

---

### Task 13: pg-store implementations

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (return type becomes `ScoutStore & CopyDraftStore & SchedulerStore & RetentionStore & SendDispatchStore & OutreachSendStore & InboundStore`)

No new unit tests (this file is the thin drizzle edge; the cores carry the logic and the SQL is reviewed by rls-auditor at Task 1). Implementation notes per method — write them exactly:

- [ ] **Step 1: `getCopyContext`** — also select the campaign's send mode: after loading the agent, `const [campaign] = agent.campaignId ? await db.select({ sendMode: campaigns.sendMode }).from(campaigns).where(eq(campaigns.id, agent.campaignId)) : [undefined];` and return `sendMode: campaign?.sendMode === "automatic" ? "automatic" : "review"` inside `agent`.

- [ ] **Step 2: `insertScheduledSend`** — add `linkedinStage: send.linkedinStage,` to the values object.

- [ ] **Step 3: SendDispatchStore methods:**

```ts
async isKillSwitchOn() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "outreach_kill_switch"));
  return row?.value === true;
},

async getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]> {
  const rows = await db
    .select({
      id: scheduledSends.id,
      accountId: scheduledSends.accountId,
      campaignId: scheduledSends.campaignId,
      leadId: scheduledSends.leadId,
      channel: scheduledSends.channel,
      linkedinStage: scheduledSends.linkedinStage,
      status: scheduledSends.status,
      accountPaused: accounts.outreachPaused,
      senderAddress: accounts.senderAddress,
      campaignStatus: campaigns.status,
      leadInvitedAt: leads.linkedinInvitedAt,
      leadConnectedAt: leads.linkedinConnectedAt,
    })
    .from(scheduledSends)
    .innerJoin(accounts, eq(scheduledSends.accountId, accounts.id))
    .innerJoin(campaigns, eq(scheduledSends.campaignId, campaigns.id))
    .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
    .where(
      or(
        eq(scheduledSends.status, "approved"),
        and(eq(scheduledSends.status, "scheduled"), lt(scheduledSends.scheduledFor, staleCutoff))
      )
    );
  return rows.map((r) => ({
    ...r,
    status: r.status as "approved" | "scheduled",
    hasSenderAddress: r.senderAddress != null,
  }));
},

async getEmailCapacity(accountId: string, dayStart: Date): Promise<number> {
  const boxes = await db
    .select({ id: mailboxes.id, dailySendLimit: mailboxes.dailySendLimit })
    .from(mailboxes)
    .where(and(eq(mailboxes.accountId, accountId), eq(mailboxes.status, "active"))); // warming NEVER counts
  if (boxes.length === 0) return 0;
  const sent = await db
    .select({ mailboxId: outreachSends.mailboxId })
    .from(outreachSends)
    .where(and(eq(outreachSends.accountId, accountId), eq(outreachSends.channel, "email"), gte(outreachSends.sentAt, dayStart)));
  const sentByBox = new Map<string, number>();
  for (const s of sent) if (s.mailboxId) sentByBox.set(s.mailboxId, (sentByBox.get(s.mailboxId) ?? 0) + 1);
  return boxes.reduce((sum, b) => {
    const cap = Math.min(b.dailySendLimit ?? EMAIL_STEADY_DAILY_PER_MAILBOX, EMAIL_STEADY_DAILY_PER_MAILBOX);
    return sum + Math.max(0, cap - (sentByBox.get(b.id) ?? 0));
  }, 0);
},

async getLinkedInAccountAgeDays(accountId: string, now: Date): Promise<number | null> {
  const [acct] = await db
    .select({ connectedAt: linkedinAccounts.connectedAt })
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
    .limit(1);
  if (!acct) return null;
  if (!acct.connectedAt) return 0;
  return Math.floor((now.getTime() - acct.connectedAt.getTime()) / 86_400_000);
},

async countLinkedInSentToday(accountId: string, kind: "invite" | "message", dayStart: Date): Promise<number> {
  const rows = await db
    .select({ id: outreachSends.id })
    .from(outreachSends)
    .innerJoin(scheduledSends, eq(outreachSends.scheduledSendId, scheduledSends.id))
    .where(
      and(
        eq(outreachSends.accountId, accountId),
        eq(outreachSends.channel, "linkedin"),
        eq(scheduledSends.linkedinStage, kind),
        gte(outreachSends.sentAt, dayStart)
      )
    );
  return rows.length;
},

async markScheduled(sendId: string, scheduledFor: Date) {
  await db.update(scheduledSends).set({ status: "scheduled", scheduledFor }).where(eq(scheduledSends.id, sendId));
},

async cancelSend(sendId: string, error: string) {
  await db.update(scheduledSends).set({ status: "canceled", error }).where(eq(scheduledSends.id, sendId));
},
```

(imports: add `gte`, `desc`, `sql` to the drizzle-orm import, `mailboxes, linkedinAccounts, outreachSends, replies, unsubscribeTokens, webhookEvents, campaigns` to the schema import, `EMAIL_STEADY_DAILY_PER_MAILBOX` from `./safety-limits`. In `getDispatchableSends`, map fields explicitly rather than spreading `r` — the selected `senderAddress` is not part of `DispatchableSend`.)

- [ ] **Step 4: OutreachSendStore methods:**

```ts
async getSendContext(sendId: string): Promise<SendContext | null> {
  const [r] = await db
    .select({
      id: scheduledSends.id, accountId: scheduledSends.accountId, campaignId: scheduledSends.campaignId,
      leadId: scheduledSends.leadId, channel: scheduledSends.channel, linkedinStage: scheduledSends.linkedinStage,
      status: scheduledSends.status, subject: scheduledSends.subject, body: scheduledSends.body,
      campaignStatus: campaigns.status, accountPaused: accounts.outreachPaused, senderAddress: accounts.senderAddress,
      leadEmail: leads.email, leadLinkedinUrl: leads.linkedinUrl,
    })
    .from(scheduledSends)
    .innerJoin(accounts, eq(scheduledSends.accountId, accounts.id))
    .innerJoin(campaigns, eq(scheduledSends.campaignId, campaigns.id))
    .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
    .where(eq(scheduledSends.id, sendId));
  if (!r) return null;
  return {
    id: r.id, accountId: r.accountId, campaignId: r.campaignId, leadId: r.leadId,
    channel: r.channel, linkedinStage: r.linkedinStage, status: r.status,
    subject: r.subject, body: r.body, campaignStatus: r.campaignStatus,
    accountPaused: r.accountPaused,
    senderAddress: parseSenderAddress(r.senderAddress),
    lead: { email: r.leadEmail, linkedinUrl: r.leadLinkedinUrl },
  };
},

async claimSending(sendId: string): Promise<boolean> {
  const rows = await db
    .update(scheduledSends)
    .set({ status: "sending" })
    .where(and(eq(scheduledSends.id, sendId), eq(scheduledSends.status, "scheduled")))
    .returning({ id: scheduledSends.id });
  return rows.length > 0;
},

async revertToApproved(sendId) {
  await db.update(scheduledSends).set({ status: "approved", scheduledFor: null }).where(eq(scheduledSends.id, sendId));
},
async markSent(sendId) {
  await db.update(scheduledSends).set({ status: "sent" }).where(eq(scheduledSends.id, sendId));
},
async markFailed(sendId, error) {
  await db.update(scheduledSends).set({ status: "failed", error }).where(eq(scheduledSends.id, sendId));
},
async markSuppressed(sendId) {
  await db.update(scheduledSends).set({ status: "suppressed" }).where(eq(scheduledSends.id, sendId));
},

async pickActiveMailbox(accountId) {
  // least-recently-used: fewest sends today would need a window fn; LRU by last send is enough
  const boxes = await db
    .select({ id: mailboxes.id, providerRef: mailboxes.providerRef, status: mailboxes.status })
    .from(mailboxes)
    .where(and(eq(mailboxes.accountId, accountId), eq(mailboxes.status, "active")));
  if (boxes.length === 0) return null;
  const lastSends = await db
    .select({ mailboxId: outreachSends.mailboxId, sentAt: outreachSends.sentAt })
    .from(outreachSends)
    .where(and(eq(outreachSends.accountId, accountId), eq(outreachSends.channel, "email")))
    .orderBy(desc(outreachSends.sentAt))
    .limit(50);
  const lastByBox = new Map<string, number>();
  for (const s of lastSends) if (s.mailboxId && !lastByBox.has(s.mailboxId)) lastByBox.set(s.mailboxId, s.sentAt.getTime());
  boxes.sort((a, b) => (lastByBox.get(a.id) ?? 0) - (lastByBox.get(b.id) ?? 0));
  return boxes[0];
},

async getActiveLinkedInIdentity(accountId) {
  const [acct] = await db
    .select({ id: linkedinAccounts.id, providerRef: linkedinAccounts.providerRef, status: linkedinAccounts.status })
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
    .limit(1);
  return acct ?? null;
},

async createUnsubscribeToken(accountId, leadId, email) {
  const [row] = await db
    .insert(unsubscribeTokens)
    .values({ accountId, leadId, email })
    .returning({ token: unsubscribeTokens.token });
  return row.token;
},

async recordOutreachSend(rec) {
  await db.insert(outreachSends).values({
    accountId: rec.accountId, campaignId: rec.campaignId, leadId: rec.leadId,
    scheduledSendId: rec.scheduledSendId, channel: rec.channel,
    mailboxId: rec.mailboxId, linkedinAccountId: rec.linkedinAccountId, messageRef: rec.messageRef,
  });
},

async setLeadInvited(leadId, at) {
  await db.update(leads).set({ linkedinInvitedAt: at }).where(eq(leads.id, leadId));
},
```

(add `desc` to the drizzle-orm import; widen the existing `setCampaignLeadStatus` signature per Task 11; import `parseSenderAddress` from `./email-footer`.)

- [ ] **Step 5: InboundStore methods:**

```ts
async findMailboxByProviderRef(ref) {
  const [m] = await db.select({ id: mailboxes.id, accountId: mailboxes.accountId })
    .from(mailboxes).where(eq(mailboxes.providerRef, ref));
  return m ?? null;
},
async findLinkedInAccountByProviderRef(ref) {
  const [a] = await db.select({ id: linkedinAccounts.id, accountId: linkedinAccounts.accountId })
    .from(linkedinAccounts).where(eq(linkedinAccounts.providerRef, ref));
  return a ?? null;
},
async upsertLinkedInAccountStatus(e) {
  await db
    .insert(linkedinAccounts)
    .values({
      accountId: e.vanteraAccountId, providerRef: e.providerRef, status: e.status,
      profileUrl: e.profileUrl, displayName: e.displayName,
      connectedAt: e.status === "active" ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [linkedinAccounts.accountId, linkedinAccounts.providerRef],
      set: { status: e.status, profileUrl: e.profileUrl, displayName: e.displayName },
    });
},
async findLeadByEmail(accountId, email) {
  // callers pass lowercased addresses; stored emails may be mixed-case
  const [lead] = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.accountId, accountId), sql`lower(${leads.email}) = ${email}`));
  if (!lead) return null;
  const [cl] = await db.select({ campaignId: campaignLeads.campaignId }).from(campaignLeads)
    .where(eq(campaignLeads.leadId, lead.id)).limit(1);
  return { id: lead.id, campaignId: cl?.campaignId ?? null };
},
async findLeadByLinkedInUrl(accountId, normalizedUrl) {
  // linkedin_url is stored as captured; compare lowercased trimmed form in JS over candidates
  const rows = await db.select({ id: leads.id, linkedinUrl: leads.linkedinUrl }).from(leads)
    .where(eq(leads.accountId, accountId));
  const hit = rows.find((r) => r.linkedinUrl && normalizeLinkedInUrl(r.linkedinUrl) === normalizedUrl);
  if (!hit) return null;
  const [cl] = await db.select({ campaignId: campaignLeads.campaignId }).from(campaignLeads)
    .where(eq(campaignLeads.leadId, hit.id)).limit(1);
  return { id: hit.id, campaignId: cl?.campaignId ?? null };
},
async insertReply(r) {
  const [row] = await db.insert(replies).values(r).returning({ id: replies.id });
  return row.id;
},
async setReplyClassification(replyId, verdict) {
  await db.update(replies).set({
    classification: verdict.classification,
    classificationRationale: verdict.rationale,
    classifiedAt: new Date(),
  }).where(eq(replies.id, replyId));
},
async addSuppression(accountId, kind, value, source, leadId) {
  await db.insert(suppressionEntries)
    .values({ accountId, kind, value, source, leadId })
    .onConflictDoNothing();
},
async pauseMailbox(mailboxId) {
  await db.update(mailboxes).set({ status: "paused" }).where(eq(mailboxes.id, mailboxId));
},
async updateMailboxWarmup(mailboxId, status, dailyCap) {
  await db.update(mailboxes).set({ status, dailySendLimit: dailyCap }).where(eq(mailboxes.id, mailboxId));
},
async setLeadConnected(leadId, at) {
  await db.update(leads).set({ linkedinConnectedAt: at }).where(eq(leads.id, leadId));
},
async setLeadReplied(leadId, campaignId) {
  await db.update(leads).set({ status: "replied" }).where(eq(leads.id, leadId));
  if (campaignId) {
    await db.update(campaignLeads).set({ status: "replied" })
      .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
  }
},
async cancelPendingSends(leadId) {
  const rows = await db.update(scheduledSends)
    .set({ status: "canceled", error: "lead replied or was suppressed" })
    .where(and(
      eq(scheduledSends.leadId, leadId),
      inArray(scheduledSends.status, ["pending_review", "approved", "scheduled"])
    ))
    .returning({ id: scheduledSends.id });
  return rows.length;
},
```

`findLeadByLinkedInUrl` note: account-wide scan is acceptable at current volumes (a few hundred leads/account); add `// revisit: normalized linkedin_url column if accounts exceed ~10k leads`.

- [ ] **Step 6: Run** `pnpm --filter @vantera/jobs type-check && pnpm --filter @vantera/jobs test` — expected PASS (cores compile against the real store type).
- [ ] **Step 7: Commit** — `git add packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/pipeline/types.ts && git commit -m "pg-store: dispatch/outreach/inbound store implementations"`

---

### Task 14: Trigger wrappers + retention extension

**Files:**
- Create: `packages/jobs/src/trigger/send-dispatch.ts`, `packages/jobs/src/trigger/outreach-send.ts`, `packages/jobs/src/trigger/process-inbound.ts`
- Modify: `packages/jobs/src/pipeline/retention-purge.ts` (+ test), `packages/jobs/src/pipeline/pg-store.ts` (one method)

Structure guardrail (`structure.test.ts`) requires each wrapper to import its core from `../pipeline/` — these do.

- [ ] **Step 1: `trigger/send-dispatch.ts`:**

```ts
import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { runSendDispatch } from "../pipeline/send-dispatch";
import { createPgStore } from "../pipeline/pg-store";

/** The send gatekeeper cron (rules 04/11): kill switch, caps, pacing — then fan-out. */
export const sendDispatch = schedules.task({
  id: "send-dispatch",
  cron: "*/5 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const summary = await runSendDispatch({
      store,
      enqueue: async (sendId, runAt) => {
        await tasks.trigger("outreach-send", { sendId }, { delay: runAt });
      },
    });
    logger.info("send dispatch tick", { ...summary });
    return summary;
  },
});
```

- [ ] **Step 2: `trigger/outreach-send.ts`:**

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runOutreachSend } from "../pipeline/outreach-send";
import { createPgStore } from "../pipeline/pg-store";

/** One live send; suppression re-checked at the boundary (rule 11). */
export const outreachSend = task({
  id: "outreach-send",
  maxDuration: 300,
  run: async (payload: { sendId: string }) => {
    const store = createPgStore(createDb());
    const outcome = await runOutreachSend(payload, {
      store,
      emailInfra: createEmailInfraFromEnv(),
      linkedinInfra: createLinkedInInfraFromEnv(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    logger.info("outreach send finished", { sendId: payload.sendId, outcome });
    return { outcome };
  },
});
```

- [ ] **Step 3: `trigger/process-inbound.ts`:**

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyReply } from "@vantera/agent-brains";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runInbound } from "../pipeline/inbound";
import { createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

/** Routes verified webhook events: replies, bounces, unsubscribes, LinkedIn state. */
export const processInbound = task({
  id: "process-inbound",
  maxDuration: 600,
  run: async (payload: InboundPayload) => {
    const store = createPgStore(createDb());
    const summary = await runInbound(payload, {
      store,
      emailInfra: createEmailInfraFromEnv(),
      linkedinInfra: createLinkedInInfraFromEnv(),
      classifyFn: (body) => classifyReply(body),
    });
    logger.info("inbound processed", { source: payload.source, ...summary });
    return summary;
  },
});
```

- [ ] **Step 4: Retention extension (TDD)** — failing test in `retention-purge.test.ts`: the run summary gains `webhookEventsPurged`, store gains `purgeWebhookEvents(cutoff: Date): Promise<number>` called with `now − 30 days`. Implement in `retention-purge.ts` (call alongside the lead purge) and in pg-store:

```ts
async purgeWebhookEvents(cutoff: Date): Promise<number> {
  const rows = await db.delete(webhookEvents).where(lt(webhookEvents.receivedAt, cutoff)).returning({ id: webhookEvents.id });
  return rows.length;
},
```

- [ ] **Step 5: Run** `pnpm --filter @vantera/jobs test` (structure + retention green).
- [ ] **Step 6: Commit** — `git add packages/jobs/src && git commit -m "Trigger tasks: send-dispatch cron, outreach-send, process-inbound; webhook_events 30-day retention"`

---

### Task 15: Webhook intake routes (verified + deduped)

**Files:**
- Create: `apps/web/src/lib/supabase/service.ts`, `apps/web/src/server/inbound-webhooks.ts`, `apps/web/src/server/inbound-webhooks.test.ts`, `apps/web/src/app/api/webhooks/email/route.ts`, `apps/web/src/app/api/webhooks/linkedin/route.ts`
- Modify: `apps/web/package.json` (add workspace deps `@vantera/email-infra`, `@vantera/linkedin-infra`, plus `@trigger.dev/sdk`; `@supabase/supabase-js` if not already a direct dep)

- [ ] **Step 1: Service-role client** — `apps/web/src/lib/supabase/service.ts`:

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service-role client for webhook/unsubscribe routes ONLY — bypasses RLS, never
 *  reachable from client code, never used in user-session paths. */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 2: Write failing tests** for the pure handler (`inbound-webhooks.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { handleInboundWebhook, type WebhookHandlerDeps } from "./inbound-webhooks";

function deps(overrides: Partial<WebhookHandlerDeps> = {}): WebhookHandlerDeps & { enqueued: unknown[] } {
  const enqueued: unknown[] = [];
  return {
    verify: () => true,
    extractEventId: () => "evt_1",
    recordEvent: async () => true,
    enqueue: async (p) => { enqueued.push(p); },
    enqueued,
    ...overrides,
  };
}

describe("handleInboundWebhook", () => {
  it("rejects forged payloads with 401 and no side effects", async () => {
    const d = deps({ verify: () => false });
    const res = await handleInboundWebhook("email", {}, "{}", d);
    expect(res.status).toBe(401);
    expect(d.enqueued).toHaveLength(0);
  });
  it("400s on unparseable JSON", async () => {
    expect((await handleInboundWebhook("email", {}, "not-json", deps())).status).toBe(400);
  });
  it("200-ignores events the adapter can't map (vendors must not retry forever)", async () => {
    const d = deps({ extractEventId: () => null });
    const res = await handleInboundWebhook("email", {}, "{}", d);
    expect(res.status).toBe(200);
    expect(d.enqueued).toHaveLength(0);
  });
  it("200-no-ops duplicate events", async () => {
    const d = deps({ recordEvent: async () => false });
    const res = await handleInboundWebhook("email", {}, "{}", d);
    expect(res.status).toBe(200);
    expect(d.enqueued).toHaveLength(0);
  });
  it("enqueues processing for fresh verified events", async () => {
    const d = deps();
    expect((await handleInboundWebhook("linkedin", {}, "{\"a\":1}", d)).status).toBe(200);
    expect(d.enqueued).toEqual([{ source: "linkedin", payload: { a: 1 } }]);
  });
});
```

- [ ] **Step 3: Run** `pnpm --filter web test inbound-webhooks` — expected FAIL.

- [ ] **Step 4: Implement `inbound-webhooks.ts`:**

```ts
export interface WebhookHandlerDeps {
  verify: (headers: Record<string, string>, rawBody: string) => boolean;
  /** providerEventId via the infra adapter's parseEventWebhook; null = not an event we know */
  extractEventId: (payload: unknown) => string | null;
  /** insert into webhook_events; false = duplicate provider_event_id */
  recordEvent: (source: "email" | "linkedin", providerEventId: string, payload: unknown) => Promise<boolean>;
  enqueue: (payload: { source: "email" | "linkedin"; payload: unknown }) => Promise<void>;
}

export async function handleInboundWebhook(
  source: "email" | "linkedin",
  headers: Record<string, string>,
  rawBody: string,
  deps: WebhookHandlerDeps
): Promise<{ status: number; body: string }> {
  if (!deps.verify(headers, rawBody)) return { status: 401, body: "invalid signature" };
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }
  const eventId = deps.extractEventId(payload);
  if (!eventId) return { status: 200, body: "ignored" };
  if (!(await deps.recordEvent(source, eventId, payload))) return { status: 200, body: "duplicate" };
  await deps.enqueue({ source, payload });
  return { status: 200, body: "ok" };
}
```

- [ ] **Step 5: Routes.** `apps/web/src/app/api/webhooks/email/route.ts` (linkedin route is identical with the other factory/source):

```ts
import { tasks } from "@trigger.dev/sdk";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { handleInboundWebhook } from "@/server/inbound-webhooks";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const infra = createEmailInfraFromEnv();
  const result = await handleInboundWebhook("email", headers, rawBody, {
    verify: (h, b) => infra.verifyWebhook(h, b),
    extractEventId: (p) => infra.parseEventWebhook(p)?.providerEventId ?? null,
    recordEvent: async (source, providerEventId, payload) => {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("webhook_events")
        .insert({ source, provider_event_id: providerEventId, payload });
      return !error; // unique violation = duplicate
    },
    enqueue: async (payload) => {
      await tasks.trigger("process-inbound", payload);
    },
  });
  return new Response(result.body, { status: result.status });
}
```

- [ ] **Step 6: Run** `pnpm --filter web test && pnpm --filter web type-check` — expected PASS.
- [ ] **Step 7: Commit** — `git add apps/web/src apps/web/package.json pnpm-lock.yaml && git commit -m "Webhook intake: verified + deduped routes handing off to process-inbound"`

---

### Task 16: One-click unsubscribe route

**Files:**
- Create: `apps/web/src/server/unsubscribe.ts`, `apps/web/src/server/unsubscribe.test.ts`, `apps/web/src/app/api/unsubscribe/[token]/route.ts`

- [ ] **Step 1: Write failing tests:**

```ts
import { describe, expect, it } from "vitest";
import { processUnsubscribe, type UnsubscribeDeps } from "./unsubscribe";

function deps(overrides: Partial<UnsubscribeDeps> = {}) {
  const calls: string[] = [];
  return {
    findToken: async () => ({ accountId: "a1", leadId: "l1", email: "p@acme.com", usedAt: null }),
    addSuppression: async () => { calls.push("suppress"); },
    markUsed: async () => { calls.push("used"); },
    cancelPendingSends: async () => { calls.push("cancel"); },
    calls,
    ...overrides,
  };
}

describe("processUnsubscribe (rule 11: one click, no friction)", () => {
  it("suppresses, marks used, cancels pending sends", async () => {
    const d = deps();
    expect(await processUnsubscribe("tok1", d)).toBe("ok");
    expect(d.calls).toEqual(["suppress", "used", "cancel"]);
  });
  it("is idempotent: a used token still reports ok without re-writing", async () => {
    const d = deps({ findToken: async () => ({ accountId: "a1", leadId: "l1", email: "p@acme.com", usedAt: new Date() }) });
    expect(await processUnsubscribe("tok1", d)).toBe("ok");
    expect(d.calls).toEqual([]);
  });
  it("unknown tokens report not_found", async () => {
    expect(await processUnsubscribe("nope", deps({ findToken: async () => null }))).toBe("not_found");
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter web test unsubscribe` — FAIL; then implement:

```ts
export interface UnsubscribeDeps {
  findToken: (token: string) => Promise<{ accountId: string; leadId: string; email: string; usedAt: Date | null } | null>;
  addSuppression: (accountId: string, email: string, leadId: string) => Promise<void>;
  markUsed: (token: string) => Promise<void>;
  cancelPendingSends: (leadId: string) => Promise<void>;
}

export async function processUnsubscribe(token: string, deps: UnsubscribeDeps): Promise<"ok" | "not_found"> {
  const row = await deps.findToken(token);
  if (!row) return "not_found";
  if (row.usedAt) return "ok"; // idempotent — never an error page for a prospect
  await deps.addSuppression(row.accountId, row.email.toLowerCase(), row.leadId);
  await deps.markUsed(token);
  await deps.cancelPendingSends(row.leadId);
  return "ok";
}
```

- [ ] **Step 3: Route** — `app/api/unsubscribe/[token]/route.ts`: both `GET` (human click → minimal HTML "You're unsubscribed. You won't hear from this sender again.") and `POST` (RFC 8058 one-click → 200 empty) call a shared `run(token)` that wires `processUnsubscribe` with the service client: `findToken` selects from `unsubscribe_tokens` by token; `addSuppression` upserts into `suppression_entries` (`onConflict: "account_id,kind,value", ignoreDuplicates: true`, `source: "unsubscribe"`, `kind: "email"`); `markUsed` sets `used_at`; `cancelPendingSends` updates `scheduled_sends` to `canceled` where `lead_id` matches and status in `('pending_review','approved','scheduled')`. `not_found` still renders the same friendly page (200) — never expose token validity.

- [ ] **Step 4: Run** web tests + type-check — PASS.
- [ ] **Step 5: Commit** — `git add apps/web/src && git commit -m "One-click unsubscribe: GET page + RFC 8058 POST, idempotent suppression write (rule 11)"`

---

### Task 17: `/settings/channels` page (PROVISIONAL UI — mockup until owner restyles)

**Files:**
- Create: `apps/web/src/app/(app)/settings/channels/page.tsx`, `apps/web/src/app/(app)/settings/channels/actions.ts`, `apps/web/src/app/(app)/settings/channels/channels-forms.tsx` (client)
- Modify: `apps/web/src/lib/validation.ts` + `validation.test.ts` (sender-address validation), settings index page (link to Channels next to the existing Suppression link)

Plain shadcn-style markup matching the existing settings pages; **no visual investment** — functional mockup only. No vendor names anywhere ("Email sending", "LinkedIn"; warmup copy: "Warming up — building sender reputation").

- [ ] **Step 1: TDD the validation** — failing tests in `apps/web/src/lib/validation.test.ts`:

```ts
describe("validateSenderAddress", () => {
  it("requires line1, city, postal, country", () => {
    expect(validateSenderAddress({ line1: "", city: "Austin", postal: "78701", country: "USA" }).ok).toBe(false);
    expect(validateSenderAddress({ line1: "100 Main St", city: "Austin", postal: "78701", country: "USA" }).ok).toBe(true);
  });
  it("trims and carries optional line2/region", () => {
    const r = validateSenderAddress({ line1: " 100 Main St ", line2: "Suite 4", city: "Austin", region: "TX", postal: "78701", country: "USA" });
    expect(r.ok && r.values.line1).toBe("100 Main St");
  });
});
```

Implement `validateSenderAddress` in `lib/validation.ts` following the existing `validateWorkspace` result-shape (`{ ok: true, values } | { ok: false, error }`).

- [ ] **Step 2: Server actions** (`channels/actions.ts`, following the `updateWorkspace` pattern — account resolved from the session via RLS, never from params):
  - `saveSenderAddress(prev, formData)` — validate → `supabase.from("accounts").update({ sender_address: values }).eq("id", account.id)`.
  - `toggleSendingPause(prev, formData)` — `update({ outreach_paused: formData.get("paused") === "true" })`.
  - `provisionEmailSending(prev, formData)` — counts clamped to 1–2 domains / 1–3 mailboxes; `createEmailInfraFromEnv().provision({ accountId: account.id, domainCount, mailboxesPerDomain })`; insert each returned mailbox into `mailboxes` (`email_address`, `domain`, `provider_ref: m.id`, `status: "warming"`, `warmup_started_at: now`). Wrap the infra call in try/catch → friendly error.
  - `createLinkedInConnectLink()` — `createLinkedInInfraFromEnv().createHostedAuthLink(account.id)` → return `{ url }` for the client to open; the `linkedin_accounts` row arrives via the account-status webhook.

- [ ] **Step 3: Page + client forms** — server `page.tsx` loads `accounts` (sender_address, outreach_paused), `mailboxes`, `linkedin_accounts` via the session client and renders three plainly-styled cards: **Email sending** (address form; provision form when no mailboxes; mailbox table: address / status pill mapping `warming → "Warming up"`, `active → "Ready"` / daily cap), **LinkedIn** (Connect button → opens `createLinkedInConnectLink().url` in a new tab; connected identity list with status, reconnect prompt when `disconnected`), **Pause all sending** (toggle bound to `toggleSendingPause`, copy: "Stops every outbound email and LinkedIn action for this workspace until resumed").

- [ ] **Step 4: Run** `pnpm --filter web test && pnpm --filter web type-check && pnpm --filter web lint` — PASS.
- [ ] **Step 5: Commit** — `git add apps/web/src && git commit -m "Channels settings (provisional UI): sender address, email provisioning, LinkedIn connect, pause-all"`

---

### Task 18: Copy wizard — send-mode + channel readiness (PROVISIONAL UI)

**Files:**
- Modify: `apps/web/src/app/(app)/agents/copy-wizard.tsx`, `apps/web/src/app/(app)/agents/actions.ts`, `apps/web/src/app/(app)/agents/validation.ts` + `validation.test.ts`, `apps/web/src/app/(app)/agents/agent-card.tsx`

- [ ] **Step 1: TDD validation** — failing test: `validateCopyAgent` (or this file's equivalent — read it first) accepts `sendMode: "review" | "automatic"` defaulting to `"review"`, rejecting anything else. Implement.
- [ ] **Step 2: Wizard** — on the Finish step add a two-option radio: "Review every draft (recommended)" / "Send automatically — drafts with style flags still come to review". Pass `sendMode` through the deploy action.
- [ ] **Step 3: Action** — where the copy agent's internal campaign is created (`copywriting_mode: 'agent'`, `send_mode: 'review'` today), write `send_mode: sendMode` instead. On the agent card, show the current mode with a small toggle action (`updateSendMode`) that updates the campaign row.
- [ ] **Step 4: Readiness hints** — in the wizard's enable-email / enable-LinkedIn steps, load mailbox / linkedin-account counts; when zero, render an inline note: "No sending channel connected yet — set one up in Settings → Channels" with a link. Non-blocking (drafting works without channels; sending parks until they exist).
- [ ] **Step 5: Run** web tests/type-check/lint — PASS. **Commit** — `git add apps/web/src && git commit -m "Copy agent: review/automatic send mode + channel readiness hints (provisional UI)"`

---

### Task 19: Review queue + leads — post-send visibility (PROVISIONAL UI)

**Files:**
- Modify: review queue components under `apps/web/src/app/(app)/review/` (read first; add status handling), leads slide-over under `apps/web/src/app/(app)/leads/`

- [ ] **Step 1: Review queue** — LinkedIn rows show a stage chip ("Invite" / "Follow-up" from `linkedin_stage`); add a secondary "Processed" view (or status filter) listing `approved | scheduled | sent | failed | canceled | suppressed` rows with status pills and `error` text on failed rows. Approve/edit/decline actions remain restricted to `pending_review` (already enforced in `review/actions.ts`).
- [ ] **Step 2: Lead slide-over** — query the lead's latest `replies` row; when present render a "Replied" section: classification badge + rationale + body excerpt (first ~200 chars).
- [ ] **Step 3: Run** web tests/type-check/lint — PASS. **Commit** — `git add apps/web/src && git commit -m "Review queue stage chips + processed statuses; lead slide-over reply badge (provisional UI)"`

---

### Task 20: Help articles + env manifest (knowledge-sync, rule 09)

**Files:**
- Create: `packages/help-content/content/channels-setup.md`, `packages/help-content/content/send-modes.md`, `packages/help-content/content/replies-unsubscribes.md`
- Modify: `packages/help-content/content/review-queue.md`, `.env.example`

- [ ] **Step 1: Articles** — frontmatter matches the existing format (`title` / `surface` / `routes`). No vendor names (articles.test.ts guards this):
  - `channels-setup.md` (surface: settings; routes: /settings/channels) — provisioning email sending, why warmup takes 2–4 weeks ("Warming up — building sender reputation"), connecting LinkedIn, what Pause-all does, the physical-address requirement.
  - `send-modes.md` (surface: agents; routes: /agents) — review vs automatic, why style-flagged drafts always come to review, how to switch.
  - `replies-unsubscribes.md` (surface: review; routes: /review, /leads) — reply classification meanings, what happens on not-interested/unsubscribe (suppression, sequence stops), invite → follow-up sequencing.
  - `review-queue.md` — add the post-approve lifecycle paragraph (approved → scheduled at a human-like pace → sent; failed rows show the reason).
- [ ] **Step 2: Run** `pnpm --filter @vantera/help-content test` — PASS.
- [ ] **Step 3: `.env.example`** — **inspect `git diff .env.example` first (another session has uncommitted edits — never stage blindly).** Append under the Smartlead/Unipile sections: `SMARTLEAD_WEBHOOK_SECRET=` and `UNIPILE_WEBHOOK_SECRET=` with one-line comments. Stage ONLY if the working-tree diff is yours alone; otherwise `git add -p .env.example` selecting just these hunks.
- [ ] **Step 4: Commit** — `git add packages/help-content && git add -p .env.example && git commit -m "Help: channels setup, send modes, replies & unsubscribes; webhook secret env manifest"`

---

### Task 21: Audits, roadmap, full gate, smoke test

- [ ] **Step 1: Whitelabel audit** — run the `whitelabel-auditor` agent over the diff since the phase started (`git diff c468eab..HEAD` scope is fine); fix any vendor-name leakage it finds (Smartlead/Unipile must appear only inside their infra packages and env files).
- [ ] **Step 2: Roadmap** — in `docs/roadmap.md` Phase 5 entry: note shipped scope and add the deferred bullets as a follow-up line (manual-draft + user-drafted-copy send modes; deliverability alarm dashboards; reply conversation UI). **Do NOT flip the checkbox** — that's `/ship-phase`'s job after this gate.
- [ ] **Step 3: Full gate** — `pnpm lint && pnpm type-check && pnpm test && pnpm build`. Fix anything red.
- [ ] **Step 4: Live smoke test (owner keys, no CI)** — with real env vars exported:
  1. Email: call `createEmailInfraFromEnv().warmupStatus(<a real mailbox ref>)` via a scratch script (`pnpm tsx scripts/smoke-email.ts`, deleted after) — expect a parsed `WarmupStatus`, no shape errors.
  2. LinkedIn: `createLinkedInInfraFromEnv().createHostedAuthLink(<dev account id>)` — expect a URL; open it once to confirm the hosted flow renders white-labeled.
  3. Webhooks: POST a captured sample payload to the local routes with the right/wrong secret — expect 200/401.
  Record outcomes in the final commit message body.
- [ ] **Step 5: Commit + report** — `git add docs/roadmap.md && git commit -m "Phase 5 build complete: live channel adapters (pending /ship-phase)"`. Report the gate + smoke results to the owner; `/ship-phase` runs next (definition-of-done checks, roadmap flip).

---

## Plan-wide invariants (checked at review of every task)

- Vendor names never outside `packages/email-infra` / `packages/linkedin-infra` / `.env.example` (rules 03/04).
- Every send path re-checks suppression at the boundary with a test (rule 11).
- New trigger files import their core from `../pipeline/` (structure guardrail).
- `@ai-sdk/*` only inside `packages/ai`; brains import `getModel()` (single-entry guardrail).
- Account ids resolve from the session (web) or task payload validated against owned rows (jobs) — never from request params.
- All UI is provisional mockup: plain, functional, no visual polish — the owner restyles later.

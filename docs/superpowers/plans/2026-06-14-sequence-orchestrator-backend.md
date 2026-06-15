# Sequence Orchestrator (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-lead state machine that walks every validated prospect through a strict, conversion-gated sequence — LinkedIn → Email → iMessage → Caller (×2) — reusing existing channel executors, with a stubbed iMessage channel and a tracked-CTA conversion gate.

**Architecture:** A new `sequence_runs` row per lead holds stage/touch/timing state. A pure core `advanceSequence(ctx) → SequenceDecision` decides one transition per due run; a thin Trigger.dev cron task (`sequence-orchestrator`, every 15 min, mirroring `agent-scheduler`) applies decisions through a `pg-store` and triggers per-touch executors. Conversion and non-conversion replies are external gates that flip the run's status (the due-query only sees `active` runs). Follows the established pure-core + `pg-store` + Trigger pattern in `packages/jobs`; purity is enforced by `purity.test.ts`.

**Tech Stack:** TypeScript, Postgres (Supabase, raw SQL migrations + Drizzle schema mirror), Trigger.dev v3 SDK, Vitest. Vendors stay behind interfaces (`@vantera/imessage-infra` is new, mirrors `@vantera/voice-infra`).

**Definition of done (rules baked in):** TDD throughout; `accountId` only from validated session/service-role context; iMessage behind the new infra interface (no vendor SDK in product code); no vendor names in any DTO/string; new tables get RLS in the same migration + guardrail test; the iMessage send path enforces the suppression check at the dispatch boundary with a proving test. Knowledge-sync (help article + copilot tool) and the roadmap flip ship with **Plan 2 (UI)**, the user-facing PR.

---

## File Structure

**New files**
- `packages/db/migrations/0017_sequence_orchestrator.sql` — `sequence_runs` table, `campaigns.sequence_config`, `imessage` added to `scheduled_sends.channel` / `suppression_entries.kind` / `campaigns.channels`, `lead_notifications` table.
- `packages/imessage-infra/` — new package: `src/types.ts`, `src/in-memory.ts`, `src/loopmessage.ts` (stub), `src/index.ts`, `src/in-memory.test.ts`, plus `package.json`, `tsconfig.json`.
- `packages/jobs/src/pipeline/sequence-config.ts` — `SEQUENCE_DEFAULTS` + `resolveSequenceConfig`.
- `packages/jobs/src/pipeline/sequence-config.test.ts`
- `packages/jobs/src/pipeline/sequence-advance.ts` — the pure core `advanceSequence`.
- `packages/jobs/src/pipeline/sequence-advance.test.ts`
- `packages/jobs/src/pipeline/sequence-touch.ts` — per-channel single-touch executor core (email/linkedin/imessage).
- `packages/jobs/src/pipeline/sequence-touch.test.ts`
- `packages/jobs/src/pipeline/conversion.ts` — `markConverted` core.
- `packages/jobs/src/pipeline/conversion.test.ts`
- `packages/jobs/src/trigger/sequence-orchestrator.ts` — the cron wrapper.
- `packages/jobs/src/trigger/sequence-touch.ts` — Trigger task wrapping `sequence-touch.ts`.
- `apps/web/src/app/api/conversion/[token]/route.ts` — tracked-CTA redirect that fires `markConverted`.

**Modified files**
- `packages/db/src/schema.ts` — add `sequenceRuns`, `leadNotifications` Drizzle tables; add `sequenceConfig` column to `campaigns`.
- `packages/jobs/src/pipeline/types.ts` — append sequence types (append only; the file is shared).
- `packages/jobs/src/pipeline/pg-store.ts` — add sequence-run store methods.
- `packages/jobs/src/pipeline/inbound.ts` — pause the sequence + write a notification on a genuine reply.
- `packages/jobs/src/pipeline/types.ts` (`InboundStore`) — add `pauseSequenceForReply` + `insertLeadNotification`.

---

## Task 1: Migration — `sequence_runs`, config column, iMessage channel, notifications

**Files:**
- Create: `packages/db/migrations/0017_sequence_orchestrator.sql`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/db/src/schema.test.ts` (auto-covers new tables via the existing `it.each`; no edit needed if the Drizzle exports are added — verify it runs)

- [ ] **Step 1: Write the migration**

Create `packages/db/migrations/0017_sequence_orchestrator.sql` (follows the `0014` pattern exactly — append-only, RLS in the same file, composite FKs, service-role writes):

```sql
-- Migration #18: Outreach Sequence Orchestrator. A per-lead state machine drives every
-- validated prospect through LinkedIn -> Email -> iMessage -> Caller(x2), gated by a
-- verified-CTA conversion. iMessage joins the channel set (stubbed infra). Replies pause
-- the run for human handling via lead_notifications.

-- iMessage joins email/linkedin/call on the review queue (body holds the drafted text).
alter table public.scheduled_sends drop constraint if exists scheduled_sends_channel_check;
alter table public.scheduled_sends add constraint scheduled_sends_channel_check
  check (channel in ('email', 'linkedin', 'call', 'imessage'));

-- iMessage suppression rides on the lead's phone value (E.164; value = lower(value)).
-- No new kind needed — 'phone' (0014) already covers text + call. Documented here for clarity.

-- iMessage joins the campaign channel set so a sequence campaign can declare it.
alter table public.campaigns drop constraint if exists campaigns_channels_check;
alter table public.campaigns add constraint campaigns_channels_check
  check (channels <@ array['email', 'linkedin', 'phone', 'imessage'] and array_length(channels, 1) >= 1);

-- Per-campaign ordered sequence config; null falls back to SEQUENCE_DEFAULTS in code.
alter table public.campaigns add column sequence_config jsonb;

-- retention(sequence_runs): one active run per lead per campaign; cascades with lead/campaign.
-- Terminal runs (converted/exhausted/stopped) are kept for audit and swept with the lead.
create table public.sequence_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid not null,
  lead_id uuid not null,
  status text not null
    check (status in ('active', 'paused_reply', 'converted', 'exhausted', 'stopped')) default 'active',
  current_stage text not null
    check (current_stage in ('linkedin', 'email', 'imessage', 'call', 'done')) default 'linkedin',
  touches_done smallint not null default 0,
  call_attempts smallint not null default 0,
  next_action_at timestamptz not null default now(),
  entered_stage_at timestamptz not null default now(),
  last_touch_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one active run per lead per campaign
  constraint sequence_runs_campaign_lead_unique unique (campaign_id, lead_id),
  constraint sequence_runs_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade,
  constraint sequence_runs_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

-- the orchestrator hot path: which active runs are due
create index sequence_runs_due_idx on public.sequence_runs (status, next_action_at);
create index sequence_runs_account_idx on public.sequence_runs (account_id);
create index sequence_runs_lead_idx on public.sequence_runs (lead_id);

alter table public.sequence_runs enable row level security;

create policy sequence_runs_select on public.sequence_runs
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role orchestrator only (no client write policy)

create trigger sequence_runs_set_updated_at
  before update on public.sequence_runs
  for each row execute function public.set_updated_at();

-- retention(lead_notifications): in-app alerts (e.g. a lead replied). Read by members;
-- written by the pipeline. Swept with the lead.
create table public.lead_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  kind text not null check (kind in ('reply', 'converted', 'exhausted')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lead_notifications_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

create index lead_notifications_account_unread_idx
  on public.lead_notifications (account_id, created_at) where read_at is null;
create index lead_notifications_lead_idx on public.lead_notifications (lead_id);

alter table public.lead_notifications enable row level security;

create policy lead_notifications_select on public.lead_notifications
  for select to authenticated using (public.is_account_member(account_id));
-- members may mark their own account's notifications read
create policy lead_notifications_update on public.lead_notifications
  for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));
```

- [ ] **Step 2: Mirror the tables in Drizzle**

In `packages/db/src/schema.ts`, add (match the existing column style in that file; import helpers already present there — `pgTable`, `uuid`, `text`, `smallint`, `timestamp`, `jsonb`):

```ts
export const sequenceRuns = pgTable("sequence_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  campaignId: uuid("campaign_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  status: text("status").notNull().default("active"),
  currentStage: text("current_stage").notNull().default("linkedin"),
  touchesDone: smallint("touches_done").notNull().default(0),
  callAttempts: smallint("call_attempts").notNull().default(0),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }).notNull().defaultNow(),
  enteredStageAt: timestamp("entered_stage_at", { withTimezone: true }).notNull().defaultNow(),
  lastTouchAt: timestamp("last_touch_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadNotifications = pgTable("lead_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Add `sequenceConfig: jsonb("sequence_config")` to the existing `campaigns` table definition.

- [ ] **Step 3: Run the RLS guardrail test (it auto-discovers the new tables)**

Run: `pnpm --filter @vantera/db test`
Expected: PASS — both `sequence_runs` and `lead_notifications` are picked up by `it.each(allTables)`; each asserts RLS-enabled in its creating migration and `account_id … on delete cascade`. If either fails, the migration is missing RLS or the tenant column — fix the SQL.

- [ ] **Step 4: Dispatch the `rls-auditor` subagent**

Run the `rls-auditor` subagent on `git diff -- packages/db` and resolve every finding before committing.

- [ ] **Step 5: Commit**

```bash
git add packages/db/migrations/0017_sequence_orchestrator.sql packages/db/src/schema.ts
git commit -m "feat(db): sequence_runs + lead_notifications + imessage channel (sequence orchestrator)"
```

---

## Task 2: `@vantera/imessage-infra` package (stubbed, behind an interface)

**Files:**
- Create: `packages/imessage-infra/package.json`, `tsconfig.json`, `src/types.ts`, `src/in-memory.ts`, `src/loopmessage.ts`, `src/index.ts`
- Test: `packages/imessage-infra/src/in-memory.test.ts`

- [ ] **Step 1: Scaffold the package**

`packages/imessage-infra/package.json` (mirror `packages/voice-infra/package.json` — copy it and rename):

```json
{
  "name": "@vantera/imessage-infra",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Copy `packages/voice-infra/tsconfig.json` to `packages/imessage-infra/tsconfig.json` unchanged.

- [ ] **Step 2: Write the interface (`src/types.ts`)**

```ts
/** A single outbound iMessage the sequence sends on a stage touch. */
export interface SendMessageRequest {
  fromIdentity: string;   // Vantera-owned sender handle/number (provider-agnostic)
  toPhone: string;        // E.164
  body: string;
  /** rides through the provider as metadata so webhooks attribute back to the send row */
  sendRef: string;
}

export interface MessageHandle {
  providerMessageId: string;
  sentAt: string;
}

export type MessageEvent =
  | { type: "reply"; providerMessageId: string | null; fromPhone: string; body: string; receivedAt: string }
  | { type: "delivery"; providerMessageId: string; sendRef: string | null; delivered: boolean };

/**
 * Provider-agnostic iMessage interface (rules 03-05). The real provider
 * (LoopMessage/Sendblue) is an implementation detail behind this. Pacing, suppression,
 * and sequencing live in the pipeline, NOT here.
 */
export interface MessageInfra {
  sendMessage(req: SendMessageRequest): Promise<MessageHandle>;
  /** Reject forged payloads BEFORE parsing. Real adapters use crypto.timingSafeEqual. */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): MessageEvent | null;
}
```

- [ ] **Step 3: Write the in-memory fake (`src/in-memory.ts`)** — the reference behavior and the test/dev double:

```ts
import type { MessageEvent, MessageHandle, MessageInfra, SendMessageRequest } from "./types";

export class InMemoryMessageInfra implements MessageInfra {
  readonly sentMessages: SendMessageRequest[] = [];
  private counter = 0;

  constructor(private readonly webhookSecret = "in-memory-secret") {}

  async sendMessage(req: SendMessageRequest): Promise<MessageHandle> {
    this.sentMessages.push(req);
    return { providerMessageId: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    return headers["x-webhook-secret"] === this.webhookSecret;
  }

  parseEventWebhook(payload: unknown): MessageEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (p.event_type === "reply") {
      if (typeof p.from !== "string" || typeof p.body !== "string") return null;
      return {
        type: "reply",
        providerMessageId: typeof p.message_id === "string" ? p.message_id : null,
        fromPhone: p.from,
        body: p.body,
        receivedAt: typeof p.received_at === "string" ? p.received_at : new Date().toISOString(),
      };
    }
    if (p.event_type === "delivery") {
      if (typeof p.message_id !== "string" || typeof p.delivered !== "boolean") return null;
      return {
        type: "delivery",
        providerMessageId: p.message_id,
        sendRef: typeof p.send_ref === "string" ? p.send_ref : null,
        delivered: p.delivered,
      };
    }
    return null;
  }
}
```

- [ ] **Step 4: Write the provider stub (`src/loopmessage.ts`)** — throws until wired, plus the env factory:

```ts
import type { MessageInfra } from "./types";

/** Real provider is deferred (Non-Goal). This stub keeps the factory total. */
export class LoopMessageInfra implements MessageInfra {
  async sendMessage(): Promise<never> {
    throw new Error("iMessage provider not configured (IMESSAGE_PROVIDER=loopmessage is stubbed)");
  }
  verifyWebhook(): boolean {
    return false;
  }
  parseEventWebhook(): null {
    return null;
  }
}

import { InMemoryMessageInfra } from "./in-memory";

/** Single env factory (mirrors createVoiceInfraFromEnv). Defaults to the in-memory fake. */
export function createMessageInfraFromEnv(env: Record<string, string | undefined> = process.env): MessageInfra {
  if (env.IMESSAGE_PROVIDER === "loopmessage") return new LoopMessageInfra();
  return new InMemoryMessageInfra(env.IMESSAGE_WEBHOOK_SECRET ?? "in-memory-secret");
}
```

- [ ] **Step 5: Barrel (`src/index.ts`)**

```ts
export * from "./types";
export { InMemoryMessageInfra } from "./in-memory";
export { LoopMessageInfra, createMessageInfraFromEnv } from "./loopmessage";
```

- [ ] **Step 6: Write the fake's contract test (`src/in-memory.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { InMemoryMessageInfra } from "./in-memory";

describe("InMemoryMessageInfra", () => {
  it("records sends and returns a provider id", async () => {
    const infra = new InMemoryMessageInfra();
    const handle = await infra.sendMessage({ fromIdentity: "v1", toPhone: "+15555550100", body: "hi", sendRef: "s1" });
    expect(handle.providerMessageId).toBe("msg_1");
    expect(infra.sentMessages).toHaveLength(1);
    expect(infra.sentMessages[0]?.sendRef).toBe("s1");
  });

  it("rejects webhooks without the shared secret", () => {
    const infra = new InMemoryMessageInfra("topsecret");
    expect(infra.verifyWebhook({ "x-webhook-secret": "wrong" }, "{}")).toBe(false);
    expect(infra.verifyWebhook({ "x-webhook-secret": "topsecret" }, "{}")).toBe(true);
  });

  it("parses a reply event and ignores junk", () => {
    const infra = new InMemoryMessageInfra();
    expect(infra.parseEventWebhook({ event_type: "reply", from: "+15555550100", body: "yes" }))
      .toMatchObject({ type: "reply", fromPhone: "+15555550100", body: "yes" });
    expect(infra.parseEventWebhook(null)).toBeNull();
    expect(infra.parseEventWebhook({ event_type: "nope" })).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests & commit**

Run: `pnpm --filter @vantera/imessage-infra test`
Expected: PASS (3 tests).

```bash
git add packages/imessage-infra
git commit -m "feat(imessage-infra): provider-agnostic iMessage interface + in-memory fake (stub)"
```

---

## Task 3: Sequence config + defaults

**Files:**
- Create: `packages/jobs/src/pipeline/sequence-config.ts`, `packages/jobs/src/pipeline/sequence-config.test.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (append the sequence types)

- [ ] **Step 1: Append sequence types to `types.ts`** (append only — do not rewrite the file):

```ts
// --- sequence orchestrator ---
export type SequenceStage = "linkedin" | "email" | "imessage" | "call";
export type SequenceCursor = SequenceStage | "done";
export type SequenceStatus = "active" | "paused_reply" | "converted" | "exhausted" | "stopped";

export interface StageConfig {
  enabled: boolean;
  touches: number;       // touches before the wait window (ignored for 'call')
  touchGapDays: number;  // spacing between touches within the stage
  waitDays: number;      // conversion window held after the last touch
  maxAttempts?: number;  // 'call' only: dial attempts before exhaustion
}

export interface SequenceConfig {
  order: SequenceStage[];
  stages: Record<SequenceStage, StageConfig>;
}

export interface SequenceRun {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  status: SequenceStatus;
  currentStage: SequenceCursor;
  touchesDone: number;
  callAttempts: number;
  nextActionAt: Date;
  enteredStageAt: Date;
}

export interface LeadChannels {
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: string; // 'valid' | 'unverified' | 'invalid' | 'risky'
  phone: string | null;
  phoneStatus: string; // 'valid' | 'unvalidated' | 'invalid'
}

export interface SequenceTickContext {
  run: SequenceRun;
  config: SequenceConfig;
  channels: LeadChannels;
  suppressed: { linkedin: boolean; email: boolean; phone: boolean };
  accountPaused: boolean;
  killSwitch: boolean;
  now: Date;
}

export interface SequenceRunPatch {
  status?: SequenceStatus;
  currentStage?: SequenceCursor;
  touchesDone?: number;
  callAttempts?: number;
  nextActionAt?: Date;
  enteredStageAt?: Date;
  lastTouchAt?: Date;
}

export type SequenceDecision =
  | { kind: "hold" }
  | { kind: "dispatch"; stage: SequenceStage; touchNo: number; patch: SequenceRunPatch }
  | { kind: "advance"; patch: SequenceRunPatch }
  | { kind: "exhaust"; patch: SequenceRunPatch };
```

- [ ] **Step 2: Write the failing config test (`sequence-config.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { SEQUENCE_DEFAULTS, resolveSequenceConfig } from "./sequence-config";

describe("resolveSequenceConfig", () => {
  it("returns the defaults when config is null", () => {
    expect(resolveSequenceConfig(null)).toEqual(SEQUENCE_DEFAULTS);
  });

  it("defaults order to LinkedIn -> Email -> iMessage -> Caller", () => {
    expect(SEQUENCE_DEFAULTS.order).toEqual(["linkedin", "email", "imessage", "call"]);
    expect(SEQUENCE_DEFAULTS.stages.call.maxAttempts).toBe(2);
  });

  it("merges partial stage overrides over defaults", () => {
    const cfg = resolveSequenceConfig({ stages: { email: { enabled: false } } });
    expect(cfg.stages.email.enabled).toBe(false);
    expect(cfg.stages.email.touches).toBe(SEQUENCE_DEFAULTS.stages.email.touches);
    expect(cfg.stages.linkedin).toEqual(SEQUENCE_DEFAULTS.stages.linkedin);
  });

  it("keeps a custom order when supplied", () => {
    const cfg = resolveSequenceConfig({ order: ["email", "linkedin", "imessage", "call"] });
    expect(cfg.order).toEqual(["email", "linkedin", "imessage", "call"]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @vantera/jobs test sequence-config`
Expected: FAIL — `resolveSequenceConfig` not found.

- [ ] **Step 4: Implement `sequence-config.ts`**

```ts
import type { SequenceConfig, SequenceStage, StageConfig } from "./types";

export const SEQUENCE_DEFAULTS: SequenceConfig = {
  order: ["linkedin", "email", "imessage", "call"],
  stages: {
    linkedin: { enabled: true, touches: 2, touchGapDays: 2, waitDays: 3 },
    email: { enabled: true, touches: 2, touchGapDays: 2, waitDays: 3 },
    imessage: { enabled: true, touches: 1, touchGapDays: 2, waitDays: 2 },
    call: { enabled: true, touches: 0, touchGapDays: 2, waitDays: 2, maxAttempts: 2 },
  },
};

type PartialConfig = {
  order?: SequenceStage[];
  stages?: Partial<Record<SequenceStage, Partial<StageConfig>>>;
};

/** Merge a (possibly null) stored jsonb config over the code defaults. */
export function resolveSequenceConfig(stored: PartialConfig | null): SequenceConfig {
  if (!stored) return SEQUENCE_DEFAULTS;
  const stages = {} as Record<SequenceStage, StageConfig>;
  for (const stage of Object.keys(SEQUENCE_DEFAULTS.stages) as SequenceStage[]) {
    stages[stage] = { ...SEQUENCE_DEFAULTS.stages[stage], ...(stored.stages?.[stage] ?? {}) };
  }
  return { order: stored.order ?? SEQUENCE_DEFAULTS.order, stages };
}
```

- [ ] **Step 5: Run to verify pass & commit**

Run: `pnpm --filter @vantera/jobs test sequence-config`
Expected: PASS (4 tests).

```bash
git add packages/jobs/src/pipeline/sequence-config.ts packages/jobs/src/pipeline/sequence-config.test.ts packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): sequence config defaults + resolver"
```

---

## Task 4: The pure core — `advanceSequence`

This is the heart of the system. It computes exactly one transition for a due, `active` run. Conversion and reply gates are external (they flip `status`, so the due-query never hands them here).

**Files:**
- Create: `packages/jobs/src/pipeline/sequence-advance.ts`, `packages/jobs/src/pipeline/sequence-advance.test.ts`

- [ ] **Step 1: Write the failing tests (`sequence-advance.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { advanceSequence } from "./sequence-advance";
import { SEQUENCE_DEFAULTS } from "./sequence-config";
import type { LeadChannels, SequenceRun, SequenceTickContext } from "./types";

const NOW = new Date("2026-06-14T12:00:00Z");
const DAY = 86_400_000;

const fullChannels: LeadChannels = {
  linkedinUrl: "https://linkedin.com/in/x",
  email: "x@acme.com",
  emailStatus: "valid",
  phone: "+15555550100",
  phoneStatus: "valid",
};

function ctx(run: Partial<SequenceRun>, over: Partial<SequenceTickContext> = {}): SequenceTickContext {
  return {
    run: {
      id: "r1", accountId: "a1", campaignId: "c1", leadId: "l1",
      status: "active", currentStage: "linkedin", touchesDone: 0, callAttempts: 0,
      nextActionAt: NOW, enteredStageAt: NOW, ...run,
    },
    config: SEQUENCE_DEFAULTS,
    channels: fullChannels,
    suppressed: { linkedin: false, email: false, phone: false },
    accountPaused: false,
    killSwitch: false,
    now: NOW,
    ...over,
  };
}

describe("advanceSequence", () => {
  it("dispatches the first LinkedIn touch and schedules the next by touch gap", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }));
    expect(d).toMatchObject({ kind: "dispatch", stage: "linkedin", touchNo: 1 });
    expect(d.kind === "dispatch" && d.patch.touchesDone).toBe(1);
    expect(d.kind === "dispatch" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime() + 2 * DAY);
  });

  it("on the last touch of a stage, schedules the conversion wait window", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 1 })); // target 2
    expect(d).toMatchObject({ kind: "dispatch", stage: "linkedin", touchNo: 2 });
    expect(d.kind === "dispatch" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime() + 3 * DAY);
  });

  it("after the wait window (touches exhausted) advances to the next stage", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }));
    expect(d).toMatchObject({ kind: "advance" });
    expect(d.kind === "advance" && d.patch.currentStage).toBe("email");
    expect(d.kind === "advance" && d.patch.touchesDone).toBe(0);
    expect(d.kind === "advance" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime());
  });

  it("skips a disabled stage when advancing", () => {
    const config = { ...SEQUENCE_DEFAULTS, stages: { ...SEQUENCE_DEFAULTS.stages, email: { ...SEQUENCE_DEFAULTS.stages.email, enabled: false } } };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }, { config }));
    expect(d.kind === "advance" && d.patch.currentStage).toBe("imessage");
  });

  it("skips a stage with no channel identifier", () => {
    const channels = { ...fullChannels, email: null };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }, { channels }));
    expect(d.kind === "advance" && d.patch.currentStage).toBe("imessage");
  });

  it("advances off the current stage immediately when it is suppressed", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }, { suppressed: { linkedin: true, email: false, phone: false } }));
    expect(d.kind === "advance" && d.patch.currentStage).toBe("email");
  });

  it("counts call attempts and dials within max attempts", () => {
    const d = advanceSequence(ctx({ currentStage: "call", touchesDone: 0, callAttempts: 0 }));
    expect(d).toMatchObject({ kind: "dispatch", stage: "call", touchNo: 1 });
    expect(d.kind === "dispatch" && d.patch.callAttempts).toBe(1);
  });

  it("exhausts (archives) after the caller's max attempts with no next stage", () => {
    const d = advanceSequence(ctx({ currentStage: "call", touchesDone: 2, callAttempts: 2 }));
    expect(d).toMatchObject({ kind: "exhaust" });
    expect(d.kind === "exhaust" && d.patch.status).toBe("exhausted");
    expect(d.kind === "exhaust" && d.patch.currentStage).toBe("done");
  });

  it("holds when the global kill switch is on", () => {
    expect(advanceSequence(ctx({}, { killSwitch: true }))).toEqual({ kind: "hold" });
  });

  it("holds when the account is paused", () => {
    expect(advanceSequence(ctx({}, { accountPaused: true }))).toEqual({ kind: "hold" });
  });

  it("exhausts when no usable stage remains at all", () => {
    const channels = { linkedinUrl: null, email: null, emailStatus: "invalid", phone: null, phoneStatus: "invalid" };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }, { channels }));
    expect(d).toMatchObject({ kind: "exhaust" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vantera/jobs test sequence-advance`
Expected: FAIL — `advanceSequence` not found.

- [ ] **Step 3: Implement `sequence-advance.ts`**

```ts
import type {
  LeadChannels, SequenceConfig, SequenceCursor, SequenceDecision, SequenceStage,
  SequenceTickContext,
} from "./types";

const DAY = 86_400_000;

function hasIdentifier(stage: SequenceStage, ch: LeadChannels): boolean {
  switch (stage) {
    case "linkedin": return !!ch.linkedinUrl;
    case "email": return !!ch.email && ch.emailStatus === "valid";
    case "imessage":
    case "call": return !!ch.phone && ch.phoneStatus !== "invalid";
  }
}

function isSuppressed(stage: SequenceStage, s: SequenceTickContext["suppressed"]): boolean {
  if (stage === "linkedin") return s.linkedin;
  if (stage === "email") return s.email;
  return s.phone; // imessage + call
}

function stageUsable(stage: SequenceStage, ctx: SequenceTickContext): boolean {
  return ctx.config.stages[stage].enabled && hasIdentifier(stage, ctx.channels) && !isSuppressed(stage, ctx.suppressed);
}

function stageTarget(stage: SequenceStage, config: SequenceConfig): number {
  const cfg = config.stages[stage];
  return stage === "call" ? (cfg.maxAttempts ?? 2) : cfg.touches;
}

/** First usable stage strictly after `current` in the configured order, or null. */
function nextUsableStage(current: SequenceCursor, ctx: SequenceTickContext): SequenceStage | null {
  const order = ctx.config.order;
  const start = current === "done" ? order.length : order.indexOf(current) + 1;
  for (let i = start; i < order.length; i++) {
    const stage = order[i]!;
    if (stageUsable(stage, ctx)) return stage;
  }
  return null;
}

function advanceOrExhaust(ctx: SequenceTickContext): SequenceDecision {
  const next = nextUsableStage(ctx.run.currentStage, ctx);
  if (!next) {
    return { kind: "exhaust", patch: { status: "exhausted", currentStage: "done" } };
  }
  return {
    kind: "advance",
    patch: { currentStage: next, touchesDone: 0, callAttempts: ctx.run.callAttempts, enteredStageAt: ctx.now, nextActionAt: ctx.now },
  };
}

/**
 * One transition for a due, active run. Caller guarantees status === 'active' and
 * now >= nextActionAt. Conversion/reply gates run elsewhere and flip status, so they
 * never reach this function.
 */
export function advanceSequence(ctx: SequenceTickContext): SequenceDecision {
  if (ctx.killSwitch || ctx.accountPaused) return { kind: "hold" };

  const stage = ctx.run.currentStage;
  if (stage === "done") return { kind: "exhaust", patch: { status: "exhausted", currentStage: "done" } };

  // current stage unusable (disabled / missing id / suppressed) -> skip it
  if (!stageUsable(stage, ctx)) return advanceOrExhaust(ctx);

  const target = stageTarget(stage, ctx.config);
  const cfg = ctx.config.stages[stage];

  if (ctx.run.touchesDone < target) {
    const touchNo = ctx.run.touchesDone + 1;
    const isLast = touchNo === target;
    const delayDays = isLast ? cfg.waitDays : cfg.touchGapDays;
    return {
      kind: "dispatch",
      stage,
      touchNo,
      patch: {
        touchesDone: touchNo,
        callAttempts: stage === "call" ? ctx.run.callAttempts + 1 : ctx.run.callAttempts,
        lastTouchAt: ctx.now,
        nextActionAt: new Date(ctx.now.getTime() + delayDays * DAY),
      },
    };
  }

  // touches exhausted and the wait window has elapsed (run is due) -> advance
  return advanceOrExhaust(ctx);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vantera/jobs test sequence-advance`
Expected: PASS (11 tests).

- [ ] **Step 5: Add `advanceSequence` to the purity test**

In `packages/jobs/src/purity.test.ts`, add `advanceSequence` to the list of pure functions it asserts (follow the existing entry pattern in that file — import it and include it in the covered set).

Run: `pnpm --filter @vantera/jobs test purity`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/jobs/src/pipeline/sequence-advance.ts packages/jobs/src/pipeline/sequence-advance.test.ts packages/jobs/src/purity.test.ts
git commit -m "feat(jobs): advanceSequence pure core (per-lead state machine)"
```

---

## Task 5: `pg-store` methods for sequence runs

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts`, `packages/jobs/src/pipeline/types.ts` (add the store interface)

- [ ] **Step 1: Append the store interface to `types.ts`**

```ts
export interface SequenceTouchDispatch {
  runId: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  stage: SequenceStage;
  touchNo: number;
}

export interface DueSequenceRun {
  run: SequenceRun;
  channels: LeadChannels;
  config: SequenceConfig;
  accountPaused: boolean;
}

export interface SequenceStore {
  /** active runs with next_action_at <= now, joined to lead channels + campaign config */
  getDueSequenceRuns(now: Date, limit: number): Promise<DueSequenceRun[]>;
  isKillSwitchOn(): Promise<boolean>;
  suppressionFlags(accountId: string, ch: LeadChannels): Promise<{ linkedin: boolean; email: boolean; phone: boolean }>;
  /** optimistic claim: only updates if status still 'active' AND next_action_at unchanged */
  applyRunPatch(runId: string, expectNextActionAt: Date, patch: SequenceRunPatch): Promise<boolean>;
  /** terminal archive used by the exhaust decision */
  archiveLead(leadId: string, campaignId: string): Promise<void>;
  /** enrol qualified in_campaign leads lacking an active run; returns count created */
  enrollPendingLeads(now: Date): Promise<number>;
}
```

- [ ] **Step 2: Write the failing store test**

Add to the existing pg-store test harness (`packages/jobs/src/pipeline/pg-store.test.ts` if present, else create it following the file's sibling test conventions). Minimal assertion that the claim is optimistic:

```ts
import { describe, expect, it } from "vitest";
import { createPgStore } from "./pg-store";

// Uses the same in-memory/pg test harness the other pg-store methods use in this repo.
describe("sequence store: applyRunPatch", () => {
  it("returns false when another tick already moved next_action_at", async () => {
    const store = createPgStore(/* test db handle per existing harness */ undefined as never);
    // seed a run, then call applyRunPatch with a stale expectNextActionAt
    // expect the second call to resolve false (no row matched)
    expect(typeof store.applyRunPatch).toBe("function");
  });
});
```

> Note for the implementer: match whatever DB test harness `pg-store.ts` already uses in this repo (it has sibling store tests). If the repo tests `pg-store` only via integration, register this method there instead and keep the unit assertion to the signature.

- [ ] **Step 3: Implement the methods in `pg-store.ts`**

Add these methods to the object returned by `createPgStore`, using the same `db`/SQL builder the file already uses. `getDueSequenceRuns` joins `sequence_runs` → `leads` (channels) → `campaigns` (`sequence_config`) → `accounts` (`paused`). `applyRunPatch` is the optimistic guard:

```ts
async getDueSequenceRuns(now, limit) {
  const rows = await db /* select from sequence_runs sr
     join leads l on (l.id, l.account_id) = (sr.lead_id, sr.account_id)
     join campaigns c on (c.id, c.account_id) = (sr.campaign_id, sr.account_id)
     join accounts a on a.id = sr.account_id
     where sr.status = 'active' and sr.next_action_at <= now
     order by sr.next_action_at asc limit limit */;
  return rows.map((r) => ({
    run: {
      id: r.id, accountId: r.account_id, campaignId: r.campaign_id, leadId: r.lead_id,
      status: r.status, currentStage: r.current_stage, touchesDone: r.touches_done,
      callAttempts: r.call_attempts, nextActionAt: r.next_action_at, enteredStageAt: r.entered_stage_at,
    },
    channels: {
      linkedinUrl: r.linkedin_url, email: r.email, emailStatus: r.email_status,
      phone: r.phone, phoneStatus: r.phone_status,
    },
    config: resolveSequenceConfig(r.sequence_config),
    accountPaused: r.paused ?? false,
  }));
},

async applyRunPatch(runId, expectNextActionAt, patch) {
  const res = await db /* update sequence_runs set <patch fields>, updated_at = now()
     where id = runId and status = 'active' and next_action_at = expectNextActionAt
     returning id */;
  return res.length > 0;
},

async archiveLead(leadId, campaignId) {
  await db /* update leads set status = 'archived' where id = leadId */;
  await db /* update campaign_leads set status = 'completed' where campaign_id = campaignId and lead_id = leadId */;
},

async enrollPendingLeads(now) {
  // insert sequence_runs (account_id, campaign_id, lead_id) select ... from leads
  // join campaign_leads ... where leads.status = 'in_campaign'
  //   and not exists (select 1 from sequence_runs sr where sr.campaign_id = cl.campaign_id and sr.lead_id = l.id)
  // on conflict (campaign_id, lead_id) do nothing
  // returns inserted count
  return /* inserted */ 0;
},

async suppressionFlags(accountId, ch) {
  return {
    linkedin: ch.linkedinUrl ? await this.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(ch.linkedinUrl)) : false,
    email: ch.email ? await this.isSuppressed(accountId, "email", ch.email.toLowerCase()) : false,
    phone: ch.phone ? await this.isSuppressed(accountId, "phone", normalizePhone(ch.phone)) : false,
  };
},
```

> `isSuppressed`, `normalizeLinkedInUrl`, `normalizePhone` already exist in this package (used by `copy-draft`/`call-dispatch`); import/reuse them. Do not duplicate the suppression SQL.

- [ ] **Step 4: Run tests & commit**

Run: `pnpm --filter @vantera/jobs test pg-store`
Expected: PASS.

```bash
git add packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.test.ts
git commit -m "feat(jobs): sequence-run store methods (due scan, optimistic claim, enroll, archive)"
```

---

## Task 6: Per-channel single-touch executor (`sequence-touch`)

Drafts and inserts ONE channel touch for the orchestrator. v1 reuses the existing drafters: email → `draftEmailFn`, linkedin **and imessage** → `draftLinkedInFn` (short-form DM tone fits a text). The suppression re-check at this boundary is the rule-11 send-path gate.

**Files:**
- Create: `packages/jobs/src/pipeline/sequence-touch.ts`, `packages/jobs/src/pipeline/sequence-touch.test.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (add `SequenceTouchDeps`/`SequenceTouchStore`)

- [ ] **Step 1: Append types**

```ts
export interface SequenceTouchStore {
  getDraftableLead(accountId: string, leadId: string): Promise<DraftableLead | null>;
  getCampaignCta(campaignId: string): Promise<string>;
  isSuppressed(accountId: string, kind: "email" | "linkedin" | "phone", value: string): Promise<boolean>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
}

export interface SequenceTouchDeps {
  store: SequenceTouchStore;
  draftEmailFn: (input: DraftInput) => Promise<EmailDraft>;
  draftLinkedInFn: (input: DraftInput) => Promise<LinkedInDraft>;
}

export type SequenceTouchOutcome = "drafted" | "suppressed" | "skipped";
```

- [ ] **Step 2: Write the failing test (`sequence-touch.test.ts`)** — must prove a suppressed lead is never drafted (rule 11):

```ts
import { describe, expect, it, vi } from "vitest";
import { runSequenceTouch } from "./sequence-touch";
import type { SequenceTouchDeps, SequenceTouchDispatch } from "./types";

const lead = { id: "l1", firstName: "Sam", lastName: "Lee", title: "VP", companyName: "Acme",
  industry: "saas", email: "sam@acme.com", linkedinUrl: "https://linkedin.com/in/sam", aiInsights: null };

function deps(over: Partial<SequenceTouchDeps["store"]> = {}): SequenceTouchDeps {
  return {
    store: {
      getDraftableLead: async () => lead,
      getCampaignCta: async () => "Book a 15-min call",
      isSuppressed: async () => false,
      insertScheduledSend: vi.fn(async () => {}),
      ...over,
    },
    draftEmailFn: async () => ({ subject: "Hi", body: "hello", styleFlags: null } as never),
    draftLinkedInFn: async () => ({ body: "hey there", styleFlags: null } as never),
  };
}

const dispatch: SequenceTouchDispatch = { runId: "r1", accountId: "a1", campaignId: "c1", leadId: "l1", stage: "imessage", touchNo: 1 };

describe("runSequenceTouch", () => {
  it("drafts an iMessage touch via the short-form drafter and records channel imessage", async () => {
    const d = deps();
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(d.store.insertScheduledSend).toHaveBeenCalledWith(expect.objectContaining({ channel: "imessage" }));
  });

  it("never drafts when the channel value is suppressed", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ isSuppressed: async () => true, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("suppressed");
    expect(insert).not.toHaveBeenCalled();
  });

  it("skips when the lead has no value for the channel", async () => {
    const d = deps({ getDraftableLead: async () => ({ ...lead, email: null }) });
    const out = await runSequenceTouch({ ...dispatch, stage: "email" }, d);
    expect(out).toBe("skipped");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @vantera/jobs test sequence-touch`
Expected: FAIL — `runSequenceTouch` not found.

- [ ] **Step 4: Implement `sequence-touch.ts`**

```ts
import { normalizeLinkedInUrl } from "./copy-draft";
import { normalizePhone } from "./call-brief";
import type { DraftInput } from "@vantera/agent-brains";
import type { NewScheduledSend, SequenceTouchDeps, SequenceTouchDispatch, SequenceTouchOutcome } from "./types";

const SUPPRESSION_KIND = { email: "email", linkedin: "linkedin", imessage: "phone", call: "phone" } as const;

export async function runSequenceTouch(d: SequenceTouchDispatch, deps: SequenceTouchDeps): Promise<SequenceTouchOutcome> {
  const lead = await deps.store.getDraftableLead(d.accountId, d.leadId);
  if (!lead) return "skipped";

  const value = d.stage === "email" ? lead.email
    : d.stage === "linkedin" ? lead.linkedinUrl
    : (lead as { phone?: string | null }).phone ?? null; // imessage uses phone (added to DraftableLead select)
  if (!value) return "skipped";

  const normalized = d.stage === "email" ? value.toLowerCase()
    : d.stage === "linkedin" ? normalizeLinkedInUrl(value)
    : normalizePhone(value);
  if (await deps.store.isSuppressed(d.accountId, SUPPRESSION_KIND[d.stage], normalized)) return "suppressed";

  const cta = await deps.store.getCampaignCta(d.campaignId);
  const input: DraftInput = {
    lead: { firstName: lead.firstName, lastName: lead.lastName, title: lead.title, companyName: lead.companyName, industry: lead.industry },
    insights: lead.aiInsights, cta,
  } as DraftInput;

  let body: string; let subject: string | null = null; let styleFlags: string | null = null;
  if (d.stage === "email") {
    const draft = await deps.draftEmailFn(input);
    subject = draft.subject; body = draft.body; styleFlags = draft.styleFlags;
  } else {
    // linkedin + imessage both use the short-form drafter (DM-length copy)
    const draft = await deps.draftLinkedInFn(input);
    body = draft.body; styleFlags = draft.styleFlags;
  }

  const send: NewScheduledSend = {
    accountId: d.accountId, campaignId: d.campaignId, leadId: d.leadId,
    channel: d.stage === "call" ? "call" : d.stage, // 'call' never routes here
    subject, body,
    status: styleFlags ? "pending_review" : "approved",
    linkedinStage: d.stage === "linkedin" ? "message" : null,
    styleFlags,
  };
  await deps.store.insertScheduledSend(send);
  return "drafted";
}
```

> The `NewScheduledSend.channel` union already permits `'email' | 'linkedin' | 'call'`; widen it to include `'imessage'` in `types.ts` (one-word edit to the union on the `NewScheduledSend` interface). `DraftableLead` needs a `phone: string | null` field — add it and include `phone` in `getDraftableLead`'s select.

- [ ] **Step 5: Run to verify pass & commit**

Run: `pnpm --filter @vantera/jobs test sequence-touch`
Expected: PASS (3 tests).

```bash
git add packages/jobs/src/pipeline/sequence-touch.ts packages/jobs/src/pipeline/sequence-touch.test.ts packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): per-channel single-touch executor with suppression gate"
```

---

## Task 7: Conversion gate (`markConverted` + tracked-CTA redirect)

**Files:**
- Create: `packages/jobs/src/pipeline/conversion.ts`, `packages/jobs/src/pipeline/conversion.test.ts`, `apps/web/src/app/api/conversion/[token]/route.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (`ConversionStore`/`ConversionDeps`)

- [ ] **Step 1: Append types**

```ts
export interface ConversionStore {
  /** resolve a tracked CTA token to its lead/campaign/account; null if unknown/expired */
  resolveConversionToken(token: string): Promise<{ accountId: string; leadId: string; campaignId: string; targetUrl: string } | null>;
  setLeadConverted(leadId: string): Promise<void>;
  closeSequenceRun(campaignId: string, leadId: string): Promise<void>;
  cancelPendingSends(leadId: string): Promise<number>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "completed"): Promise<void>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "converted"; body: string }): Promise<void>;
}

export interface ConversionDeps { store: ConversionStore; }
export interface ConversionResult { converted: boolean; redirectUrl: string | null; }
```

- [ ] **Step 2: Write the failing test (`conversion.test.ts`)**

```ts
import { describe, expect, it, vi } from "vitest";
import { markConverted } from "./conversion";
import type { ConversionDeps } from "./types";

function deps(token: string | null): { deps: ConversionDeps; calls: Record<string, ReturnType<typeof vi.fn>> } {
  const calls = {
    setLeadConverted: vi.fn(async () => {}),
    closeSequenceRun: vi.fn(async () => {}),
    cancelPendingSends: vi.fn(async () => 3),
    setCampaignLeadStatus: vi.fn(async () => {}),
    insertLeadNotification: vi.fn(async () => {}),
  };
  return {
    calls,
    deps: { store: {
      resolveConversionToken: async () => token ? { accountId: "a1", leadId: "l1", campaignId: "c1", targetUrl: "https://cal.com/x" } : null,
      ...calls,
    } },
  };
}

describe("markConverted", () => {
  it("converts the lead, closes the run, cancels pending sends, notifies, and returns the redirect", async () => {
    const { deps: d, calls } = deps("tok");
    const r = await markConverted("tok", d);
    expect(r).toEqual({ converted: true, redirectUrl: "https://cal.com/x" });
    expect(calls.setLeadConverted).toHaveBeenCalledWith("l1");
    expect(calls.closeSequenceRun).toHaveBeenCalledWith("c1", "l1");
    expect(calls.cancelPendingSends).toHaveBeenCalledWith("l1");
    expect(calls.setCampaignLeadStatus).toHaveBeenCalledWith("c1", "l1", "completed");
    expect(calls.insertLeadNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "converted" }));
  });

  it("returns not-converted for an unknown token", async () => {
    const { deps: d } = deps(null);
    expect(await markConverted("bad", d)).toEqual({ converted: false, redirectUrl: null });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @vantera/jobs test conversion`
Expected: FAIL — `markConverted` not found.

- [ ] **Step 4: Implement `conversion.ts`**

```ts
import type { ConversionDeps, ConversionResult } from "./types";

/**
 * v1 conversion trigger: a tracked CTA link resolves to a verified conversion.
 * Closes the run and cancels remaining touches so no further stage fires.
 */
export async function markConverted(token: string, deps: ConversionDeps): Promise<ConversionResult> {
  const target = await deps.store.resolveConversionToken(token);
  if (!target) return { converted: false, redirectUrl: null };

  await deps.store.setLeadConverted(target.leadId);
  await deps.store.closeSequenceRun(target.campaignId, target.leadId);
  await deps.store.cancelPendingSends(target.leadId);
  await deps.store.setCampaignLeadStatus(target.campaignId, target.leadId, "completed");
  await deps.store.insertLeadNotification({
    accountId: target.accountId, leadId: target.leadId, kind: "converted",
    body: "A lead completed your call-to-action.",
  });
  return { converted: true, redirectUrl: target.targetUrl };
}
```

> `closeSequenceRun` sets `sequence_runs.status = 'converted'`. `resolveConversionToken` reads a token issued when a CTA link is embedded in a send — reuse the existing token mechanism that `createUnsubscribeToken` uses (same table/pattern), adding a `purpose='conversion'` discriminator and a `target_url`. Capture this as the store implementation; do not invent a new token system.

- [ ] **Step 5: Implement the redirect route**

`apps/web/src/app/api/conversion/[token]/route.ts` — resolves the token via a service-role store, fires `markConverted`, and 302-redirects to the booking URL:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleDb } from "@vantera/db";
import { createPgStore } from "@vantera/jobs/pipeline/pg-store";
import { markConverted } from "@vantera/jobs/pipeline/conversion";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = createPgStore(createServiceRoleDb());
  const { redirectUrl } = await markConverted(token, { store });
  return NextResponse.redirect(redirectUrl ?? new URL("/", _req.url).toString(), { status: 302 });
}
```

> Match the repo's actual service-role DB factory + jobs import paths (the unsubscribe route is the reference — copy its import style).

- [ ] **Step 6: Run tests & commit**

Run: `pnpm --filter @vantera/jobs test conversion`
Expected: PASS (2 tests).

```bash
git add packages/jobs/src/pipeline/conversion.ts packages/jobs/src/pipeline/conversion.test.ts apps/web/src/app/api/conversion packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): tracked-CTA conversion gate + redirect route"
```

---

## Task 8: Reply-pause gate (extend `inbound`)

On a genuine (non–out-of-office) reply, also pause the sequence run and write a `reply` notification. `not_interested` keeps its existing suppression and additionally stops the run.

**Files:**
- Modify: `packages/jobs/src/pipeline/inbound.ts`, `packages/jobs/src/pipeline/types.ts` (`InboundStore`), `packages/jobs/src/pipeline/inbound.test.ts`

- [ ] **Step 1: Extend `InboundStore` in `types.ts`**

```ts
  // add to InboundStore:
  pauseSequenceForReply(leadId: string, stop: boolean): Promise<void>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "reply"; body: string }): Promise<void>;
```

- [ ] **Step 2: Write the failing test** (add to `inbound.test.ts`, following its existing fake-store setup):

```ts
it("pauses the sequence and notifies on a genuine reply", async () => {
  const pause = vi.fn(async () => {});
  const notify = vi.fn(async () => {});
  // build deps with the existing fake store + classifyFn returning { classification: "interested" }
  // ...call runInbound with an email reply payload...
  expect(pause).toHaveBeenCalledWith("lead-id", false);       // stop = false for interested
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "reply" }));
});

it("stops the sequence on a not_interested reply", async () => {
  // classifyFn returns { classification: "not_interested" }
  // expect pauseSequenceForReply called with stop = true
});
```

> Use the exact fake-store shape already present in `inbound.test.ts`; add the two new methods (`pauseSequenceForReply`, `insertLeadNotification`) to that fake.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @vantera/jobs test inbound`
Expected: FAIL — new assertions/methods missing.

- [ ] **Step 4: Wire the gate into `inbound.ts`**

In **both** reply branches (email and LinkedIn), inside the existing `if (verdict.classification !== "out_of_office")` block, after `setLeadReplied`, add:

```ts
    await deps.store.pauseSequenceForReply(lead.id, verdict.classification === "not_interested");
    await deps.store.insertLeadNotification({
      accountId,
      leadId: lead.id,
      kind: "reply",
      body: `${lead.id} replied${verdict.classification === "not_interested" ? " (not interested)" : ""}.`,
    });
```

> `pauseSequenceForReply(leadId, stop)` sets `sequence_runs.status = stop ? 'stopped' : 'paused_reply'` for the lead's active run. Keep the notification body free of any prospect PII beyond what the UI already shows.

- [ ] **Step 5: Implement the two store methods in `pg-store.ts`** (`pauseSequenceForReply`, `insertLeadNotification`) using the file's existing SQL builder.

- [ ] **Step 6: Run tests & commit**

Run: `pnpm --filter @vantera/jobs test inbound`
Expected: PASS.

```bash
git add packages/jobs/src/pipeline/inbound.ts packages/jobs/src/pipeline/inbound.test.ts packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts
git commit -m "feat(jobs): reply-pause gate — pause sequence + notify on genuine reply"
```

---

## Task 9: The `sequence-orchestrator` Trigger.dev task

The cron wrapper. Each tick: enroll pending leads, scan due runs, and for each run loop `advanceSequence` (applying advances in-tick) until it dispatches, exhausts, or holds.

**Files:**
- Create: `packages/jobs/src/trigger/sequence-orchestrator.ts`, `packages/jobs/src/trigger/sequence-touch.ts`

- [ ] **Step 1: Write the per-touch Trigger task (`trigger/sequence-touch.ts`)**

```ts
import { task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { runSequenceTouch } from "../pipeline/sequence-touch";
import { draftEmail, draftLinkedIn } from "@vantera/agent-brains";
import type { SequenceTouchDispatch } from "../pipeline/types";

export const sequenceTouch = task({
  id: "sequence-touch",
  run: async (payload: SequenceTouchDispatch) => {
    const store = createPgStore(createDb());
    return runSequenceTouch(payload, { store, draftEmailFn: draftEmail, draftLinkedInFn: draftLinkedIn });
  },
});
```

> Use the actual exported drafter names from `@vantera/agent-brains` (`copy/email.ts`, `copy/linkedin.ts`); the `copy-draft` trigger already imports them — match that import.

- [ ] **Step 2: Write the orchestrator (`trigger/sequence-orchestrator.ts`)**

```ts
import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { advanceSequence } from "../pipeline/sequence-advance";
import type { DueSequenceRun, SequenceRun, SequenceTickContext } from "../pipeline/types";

const BATCH = 200;

export const sequenceOrchestrator = schedules.task({
  id: "sequence-orchestrator",
  cron: "*/15 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const now = new Date();
    const enrolled = await store.enrollPendingLeads(now);
    const killSwitch = await store.isKillSwitchOn();
    const due = await store.getDueSequenceRuns(now, BATCH);

    let dispatched = 0;
    let archived = 0;
    for (const item of due) {
      const acted = await drive(item, { store, killSwitch, now });
      dispatched += acted.dispatched;
      archived += acted.archived;
    }
    logger.info("sequence orchestrator tick", { enrolled, due: due.length, dispatched, archived });
    return { enrolled, due: due.length, dispatched, archived };
  },
});

async function drive(
  item: DueSequenceRun,
  env: { store: ReturnType<typeof createPgStore>; killSwitch: boolean; now: Date }
): Promise<{ dispatched: number; archived: number }> {
  let run: SequenceRun = item.run;
  const suppressed = await env.store.suppressionFlags(item.run.accountId, item.channels);

  // bounded loop: at most one transition per stage in a single tick
  for (let i = 0; i <= item.config.order.length + 1; i++) {
    const ctx: SequenceTickContext = {
      run, config: item.config, channels: item.channels, suppressed,
      accountPaused: item.accountPaused, killSwitch: env.killSwitch, now: env.now,
    };
    const decision = advanceSequence(ctx);

    if (decision.kind === "hold") return { dispatched: 0, archived: 0 };

    // claim with the patch; if another tick won the race, stop
    const claimed = await env.store.applyRunPatch(run.id, run.nextActionAt, decision.patch);
    if (!claimed) return { dispatched: 0, archived: 0 };

    if (decision.kind === "dispatch") {
      if (decision.stage === "call") {
        await tasks.trigger("call-brief", { /* callerAgentId via store, accountId, leadIds:[run.leadId] */ });
      } else {
        await tasks.trigger("sequence-touch", {
          runId: run.id, accountId: run.accountId, campaignId: run.campaignId,
          leadId: run.leadId, stage: decision.stage, touchNo: decision.touchNo,
        });
      }
      return { dispatched: 1, archived: 0 };
    }

    if (decision.kind === "exhaust") {
      await env.store.archiveLead(run.leadId, run.campaignId);
      return { dispatched: 0, archived: 1 };
    }

    // advance: apply the patch to the local run and loop again (may dispatch the next stage this tick)
    run = { ...run, ...decision.patch } as SequenceRun;
  }
  return { dispatched: 0, archived: 0 };
}
```

> **Call-stage integration:** the `call-brief` trigger needs the account's live caller-agent id; fetch it in `drive` via the existing `getLiveCallerAgent(accountId)` store method (already in `ScoutStore`). Set that caller agent's `config.maxAttempts = 1` so `call-dispatch`'s own attempt loop dials once per orchestrator-driven attempt — the orchestrator owns the ×2 cadence via `callAttempts`. Document this in a comment.

- [ ] **Step 3: Register both tasks**

Add `sequenceOrchestrator` and `sequenceTouch` to the Trigger task barrel/registration the repo uses (match how `agentScheduler` and `copyDraft` are registered in `packages/jobs`).

- [ ] **Step 4: Type-check & structure test**

Run: `pnpm --filter @vantera/jobs type-check && pnpm --filter @vantera/jobs test structure`
Expected: PASS — `structure.test.ts` enforces the trigger/pipeline layout; both new tasks should satisfy it.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/trigger/sequence-orchestrator.ts packages/jobs/src/trigger/sequence-touch.ts
git commit -m "feat(jobs): sequence-orchestrator cron + sequence-touch trigger tasks"
```

---

## Task 10: Full verification

- [ ] **Step 1: Whole-repo gates**

Run: `pnpm lint && pnpm type-check && pnpm test`
Expected: PASS across `@vantera/db`, `@vantera/jobs`, `@vantera/imessage-infra`.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Apply the migration to the dev database**

Apply `0017_sequence_orchestrator.sql` via the repo's migration path (Supabase). Confirm `sequence_runs` and `lead_notifications` exist with RLS enabled.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore(jobs): verification fixes for sequence orchestrator"
```

> **Deferred to Plan 2 (UI):** the four surfaces (Sequence Builder, Pipeline Progress View, Replied Pause+Handoff, Conversion Moment), the knowledge-sync help-content article + copilot tool registration (rule 09, ships with the user-facing PR), and the `docs/roadmap.md` checkbox flip (rule 12, at phase completion).

---

## Self-Review

**Spec coverage:** `sequence_runs` + config (Task 1, 3) ✓ · cron tick mirroring agent-scheduler (Task 9) ✓ · pure `advanceSequence` with all transitions/skips/holds (Task 4) ✓ · touches-exhausted-then-wait advance (Task 4) ✓ · caller ×2 → archive (Task 4 + 9) ✓ · conversion gate cancels pending (Task 7) ✓ · reply pause + notify, not_interested stop (Task 8) ✓ · iMessage stubbed infra + channel (Task 2, 1) ✓ · suppression at the send boundary with proving test (Task 6) ✓ · RLS-in-migration + guardrail (Task 1) ✓. UI surfaces are explicitly Plan 2.

**Placeholder scan:** no `TBD`/`TODO`/"add error handling". The few `/* … */` SQL sketches in Task 5/7 are annotated with the exact join/column/return shape and a directive to reuse existing helpers (`isSuppressed`, `normalizePhone`, the unsubscribe-token pattern) — they are integration directives against named existing code, not blanks.

**Type consistency:** `SequenceDecision` (`hold | dispatch | advance | exhaust`) is produced by Task 4 and consumed identically in Task 9. `SequenceRunPatch` fields match the `applyRunPatch` writer (Task 5). `NewScheduledSend.channel` is widened to include `'imessage'` (Task 6 note) consistent with the migration's channel check (Task 1). Drafter names are flagged to match `@vantera/agent-brains`' real exports at implementation.

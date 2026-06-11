# Phase 1: Platform Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the greenfield Vantera monorepo per the locked stack (rule 02): Turborepo + pnpm workspaces, Next.js App Router app, Drizzle + Supabase with RLS from migration #1, the single Anthropic client wrapper, the two outreach infra interfaces, Trigger.dev v4 jobs package, and CI — all green on `type-check`, `test`, `build`.

**Architecture:** One Next.js app (`apps/web`) plus focused workspace packages: `@vantera/db` (schema + migration #1 with RLS), `@vantera/ai` (the only place the Anthropic provider is constructed), `@vantera/email-infra` and `@vantera/linkedin-infra` (provider-agnostic interfaces + in-memory fakes; Smartlead/Unipile adapters land later behind them, per rules 03/04), `@vantera/jobs` (Trigger.dev v4). Internal packages export TypeScript source directly; `apps/web` transpiles them via `transpilePackages`.

**Tech Stack:** Next.js (latest, App Router) · React · TypeScript strict · Tailwind v4 + shadcn/ui · Supabase (`@supabase/ssr`) · Drizzle ORM · Trigger.dev v4 · Vercel AI SDK + `@ai-sdk/anthropic` · vitest · Turborepo + pnpm

**Out of scope (later phases):** real Smartlead/Unipile adapters, scoring pipeline, campaign wizard UI, copilot packages, Stripe. The infra *interfaces* ship now so product code never touches a vendor.

---

## File structure

```
package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  .env.example
.github/workflows/ci.yml
apps/web/                      # Next.js app (@vantera/web), src dir, @/* alias
  src/lib/supabase/{client,server,middleware}.ts
  src/middleware.ts
packages/db/                   # @vantera/db
  drizzle.config.ts  src/{schema,index}.ts  migrations/0000_init.sql  src/schema.test.ts
packages/ai/                   # @vantera/ai
  src/{client,index}.ts  src/client.test.ts
packages/email-infra/          # @vantera/email-infra
  src/{types,in-memory,index}.ts  src/in-memory.test.ts
packages/linkedin-infra/       # @vantera/linkedin-infra
  src/{types,in-memory,index}.ts  src/in-memory.test.ts
packages/jobs/                 # @vantera/jobs
  trigger.config.ts  src/trigger/healthcheck.ts
```

---

### Task 1: Workspace root

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.env.example`

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "vantera",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest"
  },
  "packageManager": "pnpm@<output of pnpm -v>"
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "type-check": { "dependsOn": ["^type-check"] },
    "test": {}
  }
}
```

- [ ] **Step 4: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 5: Write `.env.example`** (placeholders only — never real values)

```bash
# Supabase (Auth + Postgres)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=

# Anthropic (via @vantera/ai only)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

# Trigger.dev v4
TRIGGER_PROJECT_REF=
TRIGGER_SECRET_KEY=

# Outreach infra providers (consumed only inside infra packages)
SMARTLEAD_API_KEY=
UNIPILE_API_KEY=
UNIPILE_DSN=

# Enrichment
EXPLORIUM_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend (transactional only — never cold outreach)
RESEND_API_KEY=
```

- [ ] **Step 6: Install and verify**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .env.example pnpm-lock.yaml
git commit -m "Phase 1: monorepo root — turborepo + pnpm workspaces + strict TS base"
```

---

### Task 2: apps/web (Next.js)

**Files:**
- Create: `apps/web/**` (generated), then modify `apps/web/package.json`, `apps/web/next.config.ts`

- [ ] **Step 1: Generate the app**

Run: `pnpm create next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes`
Expected: app generated with Tailwind v4, App Router, src dir.

- [ ] **Step 2: Rename package + add type-check script**

In `apps/web/package.json`: set `"name": "@vantera/web"`, add `"type-check": "tsc --noEmit"` to scripts.

- [ ] **Step 3: Pre-register workspace packages in `apps/web/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@vantera/db",
    "@vantera/ai",
    "@vantera/email-infra",
    "@vantera/linkedin-infra",
  ],
};

export default nextConfig;
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @vantera/web build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "Phase 1: apps/web — Next.js App Router + Tailwind, strict TS"
```

---

### Task 3: shadcn/ui init

- [ ] **Step 1: Init shadcn in apps/web** (from `apps/web/`)

Run: `pnpm dlx shadcn@latest init -y -b neutral`
Then: `pnpm dlx shadcn@latest add button card badge`
Expected: `components.json`, `src/components/ui/*`, `src/lib/utils.ts`.

- [ ] **Step 2: Verify + commit**

Run: `pnpm --filter @vantera/web type-check`
Expected: PASS.

```bash
git add apps/web pnpm-lock.yaml
git commit -m "Phase 1: shadcn/ui base components"
```

---

### Task 4: packages/db — schema + migration #1 with RLS

**Files:**
- Create: `packages/db/package.json`, `tsconfig.json`, `drizzle.config.ts`, `src/schema.ts`, `src/index.ts`, `migrations/0000_init.sql`
- Test: `packages/db/src/schema.test.ts`

- [ ] **Step 1: `packages/db/package.json`**

```json
{
  "name": "@vantera/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./schema": "./src/schema.ts" },
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

`tsconfig.json` (same file for every package in Tasks 4–7):

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "*.ts"]
}
```

- [ ] **Step 2: Write the failing RLS guardrail test** (`src/schema.test.ts`)

RLS-from-migration-#1 is a locked decision — this test makes it unskippable.

```ts
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { accounts, accountMembers } from "./schema";
import { getTableName } from "drizzle-orm";

const migration = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../migrations/0000_init.sql"),
  "utf8"
).toLowerCase();

describe("migration #1", () => {
  it.each([accounts, accountMembers].map((t) => getTableName(t)))(
    "enables row level security on %s",
    (table) => {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  );

  it("scopes membership checks through auth.uid()", () => {
    expect(migration).toContain("auth.uid()");
  });
});
```

- [ ] **Step 3: Run test — expect FAIL** (`pnpm --filter @vantera/db test`: schema.ts missing)

- [ ] **Step 4: Write `src/schema.ts`**

```ts
import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountMembers = pgTable(
  "account_members",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // FK to auth.users(id) lives in the SQL migration — auth schema isn't modeled in Drizzle
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.userId] })]
);
```

- [ ] **Step 5: Write `migrations/0000_init.sql`**

```sql
-- Migration #1: multi-tenant base. RLS on from day one (locked decision, rule 02).
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

alter table public.accounts enable row level security;
alter table public.account_members enable row level security;

-- security definer so policies can consult memberships without recursive RLS
create function public.is_account_member(target_account_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = target_account_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_account_admin(target_account_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = target_account_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create policy accounts_select on public.accounts
  for select using (public.is_account_member(id));
create policy accounts_update on public.accounts
  for update using (public.is_account_admin(id));

create policy account_members_select on public.account_members
  for select using (public.is_account_member(account_id));
create policy account_members_manage on public.account_members
  for all using (public.is_account_admin(account_id));

-- the only sanctioned way to create an account: account + owner membership atomically
create function public.create_account(account_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  insert into public.accounts (name) values (account_name) returning id into new_account_id;
  insert into public.account_members (account_id, user_id, role)
  values (new_account_id, (select auth.uid()), 'owner');
  return new_account_id;
end;
$$;
```

- [ ] **Step 6: Write `src/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(postgres(databaseUrl, { prepare: false }), { schema });
}
```

- [ ] **Step 7: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 8: Run tests — expect PASS** (`pnpm --filter @vantera/db test`)

- [ ] **Step 9: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "Phase 1: @vantera/db — accounts + memberships, RLS from migration #1"
```

---

### Task 5: packages/ai — the single Anthropic client wrapper

**Files:**
- Create: `packages/ai/package.json`, `tsconfig.json`, `src/client.ts`, `src/index.ts`
- Test: `packages/ai/src/client.test.ts`

- [ ] **Step 1: `packages/ai/package.json`** (tsconfig.json identical to Task 4 Step 1)

```json
{
  "name": "@vantera/ai",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "type-check": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@ai-sdk/anthropic": "latest",
    "ai": "latest"
  },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

- [ ] **Step 2: Write the failing test** (`src/client.test.ts`)

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getModel } from "./client";

describe("getModel", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("throws a clear error when ANTHROPIC_API_KEY is missing", () => {
    expect(() => getModel()).toThrowError(/ANTHROPIC_API_KEY/);
  });

  it("returns a model bound to the default model id", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(getModel().modelId).toBe("claude-sonnet-4-6");
  });

  it("respects ANTHROPIC_MODEL and explicit overrides", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    expect(getModel().modelId).toBe("claude-opus-4-8");
    expect(getModel("claude-haiku-4-5-20251001").modelId).toBe("claude-haiku-4-5-20251001");
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (`pnpm --filter @vantera/ai test`)

- [ ] **Step 4: Write `src/client.ts` + `src/index.ts`**

```ts
// src/client.ts
import { createAnthropic } from "@ai-sdk/anthropic";

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * The single Anthropic entry point (locked, rule 02). All product code gets
 * models from here — never construct a provider or import an AI SDK provider
 * package anywhere else.
 */
export function getModel(modelId?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const anthropic = createAnthropic({ apiKey });
  return anthropic(modelId ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL);
}
```

```ts
// src/index.ts
export { getModel } from "./client";
```

- [ ] **Step 5: Run — expect PASS, then commit**

```bash
git add packages/ai pnpm-lock.yaml
git commit -m "Phase 1: @vantera/ai — single Anthropic client wrapper"
```

---

### Task 6: packages/email-infra — interface + in-memory fake

**Files:**
- Create: `packages/email-infra/package.json`, `tsconfig.json`, `src/types.ts`, `src/in-memory.ts`, `src/index.ts`
- Test: `packages/email-infra/src/in-memory.test.ts`

- [ ] **Step 1: `package.json`** (tsconfig.json identical to Task 4 Step 1)

```json
{
  "name": "@vantera/email-infra",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "type-check": "tsc --noEmit", "test": "vitest run" },
  "devDependencies": { "typescript": "latest", "vitest": "latest" }
}
```

- [ ] **Step 2: Write `src/types.ts`** (the contract from rule 03: provision / send / warmup-status / replies)

```ts
export interface ProvisionRequest {
  accountId: string;
  domainCount: number;
  mailboxesPerDomain: number;
}

export interface Mailbox {
  id: string;
  address: string;
  domain: string;
}

export interface OutboundEmail {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  campaignId: string;
  leadId: string;
}

export interface SendResult {
  messageId: string;
  sentAt: string;
}

export interface WarmupStatus {
  mailboxId: string;
  phase: "warming" | "ready";
  dailyCap: number;
}

export interface InboundReply {
  mailboxId: string;
  from: string;
  body: string;
  receivedAt: string;
}

/** Provider-agnostic email outreach interface (rule 03). Smartlead is an implementation detail behind it. */
export interface EmailInfra {
  provision(req: ProvisionRequest): Promise<Mailbox[]>;
  send(email: OutboundEmail): Promise<SendResult>;
  warmupStatus(mailboxId: string): Promise<WarmupStatus>;
  parseReplyWebhook(payload: unknown): InboundReply | null;
}
```

- [ ] **Step 3: Write the failing test** (`src/in-memory.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { InMemoryEmailInfra } from "./in-memory";

describe("InMemoryEmailInfra", () => {
  it("provisions the requested number of mailboxes, warming by default", async () => {
    const infra = new InMemoryEmailInfra();
    const mailboxes = await infra.provision({
      accountId: "acct-1",
      domainCount: 2,
      mailboxesPerDomain: 3,
    });
    expect(mailboxes).toHaveLength(6);
    const first = mailboxes[0]!;
    await expect(infra.warmupStatus(first.id)).resolves.toMatchObject({ phase: "warming" });
  });

  it("records sends and surfaces replies parsed from webhooks", async () => {
    const infra = new InMemoryEmailInfra();
    const [mailbox] = await infra.provision({
      accountId: "acct-1",
      domainCount: 1,
      mailboxesPerDomain: 1,
    });
    const result = await infra.send({
      mailboxId: mailbox!.id,
      to: "lead@example.com",
      subject: "hi",
      body: "hello",
      campaignId: "camp-1",
      leadId: "lead-1",
    });
    expect(result.messageId).toBeTruthy();
    expect(infra.sentEmails).toHaveLength(1);

    const reply = infra.parseReplyWebhook({
      mailbox_id: mailbox!.id,
      from: "lead@example.com",
      body: "interested",
      received_at: "2026-06-11T00:00:00Z",
    });
    expect(reply).toEqual({
      mailboxId: mailbox!.id,
      from: "lead@example.com",
      body: "interested",
      receivedAt: "2026-06-11T00:00:00Z",
    });
  });

  it("returns null for malformed webhook payloads", () => {
    expect(new InMemoryEmailInfra().parseReplyWebhook({ junk: true })).toBeNull();
  });
});
```

- [ ] **Step 4: Run — expect FAIL**, then write `src/in-memory.ts`

```ts
import type {
  EmailInfra,
  InboundReply,
  Mailbox,
  OutboundEmail,
  ProvisionRequest,
  SendResult,
  WarmupStatus,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryEmailInfra implements EmailInfra {
  readonly sentEmails: OutboundEmail[] = [];
  private readonly mailboxes = new Map<string, Mailbox>();
  private counter = 0;

  async provision(req: ProvisionRequest): Promise<Mailbox[]> {
    const created: Mailbox[] = [];
    for (let d = 0; d < req.domainCount; d++) {
      const domain = `outbound-${req.accountId}-${d}.example.com`;
      for (let m = 0; m < req.mailboxesPerDomain; m++) {
        const id = `mbx_${++this.counter}`;
        const mailbox: Mailbox = { id, address: `sdr${m}@${domain}`, domain };
        this.mailboxes.set(id, mailbox);
        created.push(mailbox);
      }
    }
    return created;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    if (!this.mailboxes.has(email.mailboxId)) {
      throw new Error(`unknown mailbox: ${email.mailboxId}`);
    }
    this.sentEmails.push(email);
    return { messageId: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    if (!this.mailboxes.has(mailboxId)) {
      throw new Error(`unknown mailbox: ${mailboxId}`);
    }
    return { mailboxId, phase: "warming", dailyCap: 10 };
  }

  parseReplyWebhook(payload: unknown): InboundReply | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (
      typeof p.mailbox_id !== "string" ||
      typeof p.from !== "string" ||
      typeof p.body !== "string" ||
      typeof p.received_at !== "string"
    ) {
      return null;
    }
    return { mailboxId: p.mailbox_id, from: p.from, body: p.body, receivedAt: p.received_at };
  }
}
```

`src/index.ts`:

```ts
export * from "./types";
export { InMemoryEmailInfra } from "./in-memory";
```

- [ ] **Step 5: Run — expect PASS, then commit**

```bash
git add packages/email-infra pnpm-lock.yaml
git commit -m "Phase 1: @vantera/email-infra — provider-agnostic interface + in-memory fake"
```

---

### Task 7: packages/linkedin-infra — interface + in-memory fake

**Files:** mirror Task 6 under `packages/linkedin-infra` (package name `@vantera/linkedin-infra`; package.json/tsconfig identical to Task 6 Step 1 apart from the name).

- [ ] **Step 1: Write `src/types.ts`** (the contract from rule 04: connect / invite / message / replies)

```ts
export interface HostedAuthLink {
  url: string;
  expiresAt: string;
}

export interface InviteRequest {
  connectedAccountId: string;
  profileUrl: string;
  note?: string;
}

export interface MessageRequest {
  connectedAccountId: string;
  profileUrl: string;
  body: string;
}

export interface SendOutcome {
  id: string;
  sentAt: string;
}

export interface InboundLinkedInReply {
  connectedAccountId: string;
  fromProfileUrl: string;
  body: string;
  receivedAt: string;
}

/**
 * Provider-agnostic LinkedIn outreach interface (rule 04). Unipile is an
 * implementation detail behind it. Safety limits (ramp, weekly invite
 * ceiling, pacing) live in the scheduler, NOT here.
 */
export interface LinkedInInfra {
  createHostedAuthLink(accountId: string): Promise<HostedAuthLink>;
  sendInvite(req: InviteRequest): Promise<SendOutcome>;
  sendMessage(req: MessageRequest): Promise<SendOutcome>;
  parseReplyWebhook(payload: unknown): InboundLinkedInReply | null;
}
```

- [ ] **Step 2: Write the failing test** (`src/in-memory.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { InMemoryLinkedInInfra } from "./in-memory";

describe("InMemoryLinkedInInfra", () => {
  it("issues hosted auth links per account", async () => {
    const infra = new InMemoryLinkedInInfra();
    const link = await infra.createHostedAuthLink("acct-1");
    expect(link.url).toContain("acct-1");
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("records invites and messages", async () => {
    const infra = new InMemoryLinkedInInfra();
    await infra.sendInvite({
      connectedAccountId: "conn-1",
      profileUrl: "https://linkedin.com/in/lead",
      note: "hi",
    });
    await infra.sendMessage({
      connectedAccountId: "conn-1",
      profileUrl: "https://linkedin.com/in/lead",
      body: "following up",
    });
    expect(infra.sentInvites).toHaveLength(1);
    expect(infra.sentMessages).toHaveLength(1);
  });

  it("parses reply webhooks and rejects malformed payloads", () => {
    const infra = new InMemoryLinkedInInfra();
    expect(
      infra.parseReplyWebhook({
        connected_account_id: "conn-1",
        from_profile_url: "https://linkedin.com/in/lead",
        body: "interested",
        received_at: "2026-06-11T00:00:00Z",
      })
    ).toEqual({
      connectedAccountId: "conn-1",
      fromProfileUrl: "https://linkedin.com/in/lead",
      body: "interested",
      receivedAt: "2026-06-11T00:00:00Z",
    });
    expect(infra.parseReplyWebhook("nope")).toBeNull();
  });
});
```

- [ ] **Step 3: Run — expect FAIL**, then write `src/in-memory.ts`

```ts
import type {
  HostedAuthLink,
  InboundLinkedInReply,
  InviteRequest,
  LinkedInInfra,
  MessageRequest,
  SendOutcome,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryLinkedInInfra implements LinkedInInfra {
  readonly sentInvites: InviteRequest[] = [];
  readonly sentMessages: MessageRequest[] = [];
  private counter = 0;

  async createHostedAuthLink(accountId: string): Promise<HostedAuthLink> {
    return {
      url: `https://auth.example.com/connect/${accountId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async sendInvite(req: InviteRequest): Promise<SendOutcome> {
    this.sentInvites.push(req);
    return { id: `inv_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  async sendMessage(req: MessageRequest): Promise<SendOutcome> {
    this.sentMessages.push(req);
    return { id: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  parseReplyWebhook(payload: unknown): InboundLinkedInReply | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (
      typeof p.connected_account_id !== "string" ||
      typeof p.from_profile_url !== "string" ||
      typeof p.body !== "string" ||
      typeof p.received_at !== "string"
    ) {
      return null;
    }
    return {
      connectedAccountId: p.connected_account_id,
      fromProfileUrl: p.from_profile_url,
      body: p.body,
      receivedAt: p.received_at,
    };
  }
}
```

`src/index.ts`:

```ts
export * from "./types";
export { InMemoryLinkedInInfra } from "./in-memory";
```

- [ ] **Step 4: Run — expect PASS, then commit**

```bash
git add packages/linkedin-infra pnpm-lock.yaml
git commit -m "Phase 1: @vantera/linkedin-infra — provider-agnostic interface + in-memory fake"
```

---

### Task 8: Supabase auth wiring in apps/web

**Files:**
- Create: `apps/web/src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`, `apps/web/src/middleware.ts`

- [ ] **Step 1: Install**

Run: `pnpm --filter @vantera/web add @supabase/ssr @supabase/supabase-js`

- [ ] **Step 2: Write `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Write `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions instead
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Write `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // unconfigured local env: skip session handling rather than crash every request
  if (!url || !anonKey) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // required: refreshes expired auth tokens; do not run other logic in between
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 5: Write `src/middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm --filter @vantera/web type-check && pnpm --filter @vantera/web build`
Expected: PASS.

```bash
git add apps/web pnpm-lock.yaml
git commit -m "Phase 1: Supabase auth wiring — @supabase/ssr clients + session middleware"
```

---

### Task 9: packages/jobs — Trigger.dev v4

**Files:**
- Create: `packages/jobs/package.json`, `tsconfig.json`, `trigger.config.ts`, `src/trigger/healthcheck.ts`

- [ ] **Step 1: `package.json`** (tsconfig.json identical to Task 4 Step 1)

```json
{
  "name": "@vantera/jobs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "type-check": "tsc --noEmit",
    "dev": "trigger dev",
    "deploy": "trigger deploy"
  },
  "dependencies": { "@trigger.dev/sdk": "latest" },
  "devDependencies": { "trigger.dev": "latest", "typescript": "latest" }
}
```

- [ ] **Step 2: Write `trigger.config.ts`**

```ts
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_replace_me",
  runtime: "node",
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
```

- [ ] **Step 3: Write `src/trigger/healthcheck.ts`**

```ts
import { logger, task } from "@trigger.dev/sdk";

/** Smoke task: proves the jobs package deploys and runs. */
export const healthcheck = task({
  id: "healthcheck",
  run: async (payload: { note?: string }) => {
    logger.info("vantera jobs healthcheck", { note: payload.note ?? "ok" });
    return { ok: true as const };
  },
});
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm install && pnpm --filter @vantera/jobs type-check`
Expected: PASS.

```bash
git add packages/jobs pnpm-lock.yaml
git commit -m "Phase 1: @vantera/jobs — Trigger.dev v4 config + healthcheck task"
```

---

### Task 10: CI + full verification

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Full local verification**

Run: `pnpm type-check && pnpm test && pnpm build`
Expected: every workspace green.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "Phase 1: CI — lint, type-check, test, build on every push/PR"
```

---

## Self-review notes

- Spec coverage vs rule 02: framework/UI/auth/db/jobs/AI all scaffolded; Stripe and Resend are env placeholders only (no product surface needs them yet — YAGNI).
- Rules 03/04 coverage: interfaces match the locked verbs (provision/send/warmup-status/replies; connect/invite/message/replies); vendor adapters deliberately deferred to the features that first need them.
- RLS-from-migration-#1 (rule 02) is enforced by a test, not convention.
- Type consistency: `EmailInfra`/`LinkedInInfra` names used consistently in types, fakes, and tests.

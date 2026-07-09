# Lifecycle LinkedIn Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Founder-voice LinkedIn DMs, sent automatically from the founder's own connected LinkedIn identity, to Vantera's own users at three lifecycle cliffs: stalled onboarding, onboarded-but-idle, and trial lapsed.

**Architecture:** A new operator-side pipeline (rule-13 skeleton: pure core in `packages/jobs/src/pipeline/lifecycle-outreach.ts`, drizzle store in `pg-store.ts`, thin task wrapper in `trigger/lifecycle-outreach.ts`) fired from the existing `agent-scheduler` 15-minute tick (schedule quota is 10/10). It scans segments into a new service-role-only `lifecycle_touches` table, sends via the account-scoped `linkedin-infra` primitives (never the campaign/lead machinery), and stops on reply via a small interception hook in `runInbound`. Trial lapses are captured at the moment of expiry by chaining off `runTrialExpiry`.

**Tech Stack:** TypeScript strict, Drizzle + raw SQL via `db.execute(sql\`...\`)` for `auth.users` joins, Trigger.dev v4, Unipile behind `@vantera/linkedin-infra`, Resend behind `@vantera/transactional-email`, Vitest (colocated `*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-07-09-lifecycle-linkedin-outreach-design.md`

## Global Constraints

- LinkedIn-only: no email fallback; a user with no LinkedIn URL is marked `skipped_no_linkedin` and never retried (owner decision 2026-07-09).
- Auto-send, hard daily cap default **10**, always clamped through `dailyAllowance("linkedin", …, { kind: "message" })` (rule 04 — this is the founder's personal account).
- Message the account **owner** only (`account_members.role = 'owner'`), never other members.
- Segment A grace: no touch until the account is ≥ **48h** old. Touch 2 fires ≥ **4 days** after touch 1, only if no reply. **30-day** cross-segment cooldown per user. A user who ever replied is **never auto-messaged again** — enforced in two layers: the `getDueTouches` SQL (`NOT EXISTS` on any replied touch) and the stop-on-reply interception that cancels pending/invited rows (rule-11 analog; the interception is test-covered in Task 5).
- Invite gate: a DM needs a 1st-degree connection; non-connections get one note-less invite, the touch parks as `invited` until the acceptance webhook flips it back to `pending`. Never a second invite.
- Copy rules: founder voice, short, plain, **zero em/en dashes**, honest, no "AI SDR"/volume language, no fake personalization; count-based lines must fall back to a count-free variant when `leadCount === 0`.
- `lifecycle_touches` is service-role only: RLS enabled, **no policies, no grants**; `user_id` FK cascades from `auth.users` (GDPR deletion path, rule 11).
- No new Trigger.dev schedule (quota 10/10) — fire from the `agent-scheduler` tick like `account-health`; respect the platform `outreach_kill_switch` AND the feature's own `lifecycle_outreach_enabled` app_settings flag (absent = off).
- Rule-13 layering: pipeline core is pure (deps injected via interfaces in `types.ts`); drizzle only in `pg-store.ts`; trigger wrapper imports its core from `../pipeline/` (enforced by `structure.test.ts`).
- Config keys in `app_settings` (all service-role written): `lifecycle_outreach_enabled`, `lifecycle_sender_ref`, `lifecycle_daily_cap`, `lifecycle_sender_location`, `lifecycle_notify_email`, `lifecycle_last_run_at`.
- Knowledge-sync (rule 09): N/A — no user-facing surface changes; no help article required. State this in the ship commit body.
- Full gate before merge: `pnpm lint && pnpm type-check && pnpm test && pnpm build`.

---

### Task 1: Migration 0045 + Drizzle schema + guardrail tests

**Files:**
- Create: `packages/db/migrations/0045_lifecycle_touches.sql`
- Modify: `packages/db/src/schema.ts` (add `lifecycleTouches` table export)
- Test: `packages/db/src/schema.test.ts` (new describe + tenancy exemption)

**Interfaces:**
- Consumes: existing `accounts` table, `auth.users`, the schema.test.ts guardrail machinery (`tenantExempt` set at the top of the file, `tableDdl()` helper).
- Produces: `public.lifecycle_touches` table; `lifecycleTouches` drizzle export used by Task 3's store methods.

- [ ] **Step 1: Write the failing guardrail tests**

Add to `packages/db/src/schema.test.ts` (append a new describe near the other numbered ones; note `fileContents` values are lowercased, so match lowercase):

```ts
describe("lifecycle touches (0045)", () => {
  const sql = fileContents.get("0045_lifecycle_touches.sql") ?? "";
  it("is service-role only: RLS on, no policies, no client grants", () => {
    expect(sql).toContain("alter table public.lifecycle_touches enable row level security");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("grant ");
  });
  it("deletes with the auth user (GDPR deletion path, rule 11)", () => {
    expect(tableDdl("lifecycle_touches")).toContain("references auth.users(id) on delete cascade");
  });
  it("enforces one touch per (user, segment, touch_number)", () => {
    expect(sql).toContain("create unique index lifecycle_touches_user_segment_touch_idx");
  });
});
```

Also add to the `tenantExempt` set at the top of the file:

```ts
  // operator-side lifecycle ledger about OUR OWN users (0045) — platform data, not tenant
  // data; service-role only (RLS on, no policies)
  "lifecycle_touches",
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/db test`
Expected: FAIL — `create table public.lifecycle_touches not found in migrations` (from `tableDdl`), plus the two content assertions.

- [ ] **Step 3: Write the migration**

`packages/db/migrations/0045_lifecycle_touches.sql` (the guardrail greps `create table public.<name> (` — keep that exact form):

```sql
-- 0045: lifecycle_touches — operator-side lifecycle re-engagement ledger.
-- Founder LinkedIn DMs to our OWN users at three cliffs: stalled onboarding,
-- idle after onboarding, trial lapsed. Spec: docs/superpowers/specs/2026-07-09-*.
--
-- Platform-operator data, NOT tenant data: no account-scoped policies, no client
-- grants — service role only (same class as webhook_events / copilot_knowledge_chunks).
-- RLS is ENABLED with no policies so anon/authenticated see nothing (rule 02).
--
-- Retention / deletion (rule 11): rows describe our own users, not prospects. GDPR
-- deletion rides the user_id FK cascade when the auth user is deleted; account_id is
-- SET NULL so touch history survives account-row deletion but never dangles.
--
-- Runtime config rides app_settings keys (service-role written):
--   lifecycle_outreach_enabled, lifecycle_sender_ref, lifecycle_daily_cap,
--   lifecycle_sender_location, lifecycle_notify_email, lifecycle_last_run_at.

CREATE TABLE public.lifecycle_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  segment text NOT NULL CONSTRAINT lifecycle_touches_segment_check
    CHECK (segment IN ('stalled_onboarding', 'idle_after_onboarding', 'trial_lapsed')),
  touch_number int NOT NULL CONSTRAINT lifecycle_touches_touch_check
    CHECK (touch_number IN (1, 2)),
  status text NOT NULL DEFAULT 'pending' CONSTRAINT lifecycle_touches_status_check
    CHECK (status IN ('pending', 'invited', 'sent', 'failed', 'skipped_no_linkedin', 'canceled')),
  attempts int NOT NULL DEFAULT 0,
  linkedin_url text,
  target_provider_ref text,
  display_name text,
  stalled_step text,
  message_body text,
  message_ref text,
  error text,
  invite_sent_at timestamptz,
  connected_at timestamptz,
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lifecycle_touches_user_segment_touch_idx
  ON public.lifecycle_touches (user_id, segment, touch_number);
CREATE INDEX lifecycle_touches_status_idx ON public.lifecycle_touches (status);
CREATE INDEX lifecycle_touches_target_ref_idx ON public.lifecycle_touches (target_provider_ref);

ALTER TABLE public.lifecycle_touches ENABLE ROW LEVEL SECURITY;
-- no policies: service-role only by construction
```

- [ ] **Step 4: Add the Drizzle table**

Append to `packages/db/src/schema.ts` (reuse the existing `pgTable, uuid, text, timestamp, integer, uniqueIndex, index` imports from `drizzle-orm/pg-core`; add `index`/`integer` to the import list if missing):

```ts
// ── 0045 lifecycle touches — operator-side re-engagement ledger ─────────────
// Service-role only (RLS on, no policies): platform data about OUR OWN users,
// never tenant data. See migration 0045 for the full contract.
export const lifecycleTouches = pgTable(
  "lifecycle_touches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // FK to auth.users(id) ON DELETE CASCADE lives in SQL (auth schema isn't modeled in Drizzle)
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    segment: text("segment", {
      enum: ["stalled_onboarding", "idle_after_onboarding", "trial_lapsed"],
    }).notNull(),
    touchNumber: integer("touch_number").notNull(),
    status: text("status", {
      enum: ["pending", "invited", "sent", "failed", "skipped_no_linkedin", "canceled"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    linkedinUrl: text("linkedin_url"),
    targetProviderRef: text("target_provider_ref"),
    displayName: text("display_name"),
    stalledStep: text("stalled_step"),
    messageBody: text("message_body"),
    messageRef: text("message_ref"),
    error: text("error"),
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lifecycle_touches_user_segment_touch_idx").on(t.userId, t.segment, t.touchNumber),
    index("lifecycle_touches_status_idx").on(t.status),
    index("lifecycle_touches_target_ref_idx").on(t.targetProviderRef),
  ]
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @vantera/db test`
Expected: PASS (including the automatic RLS-for-every-drizzle-table guardrail).

- [ ] **Step 6: Commit**

```bash
git add packages/db/migrations/0045_lifecycle_touches.sql packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "feat(db): 0045 lifecycle_touches — operator-side re-engagement ledger (service-role only)"
```

---

### Task 2: Pipeline types + founder-voice copy templates

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (append the lifecycle block)
- Create: `packages/jobs/src/pipeline/lifecycle-copy.ts`
- Test: `packages/jobs/src/pipeline/lifecycle-copy.test.ts`

**Interfaces:**
- Consumes: `LinkedInInfra` (already imported in `types.ts` line 34).
- Produces (used by Tasks 3–6):
  - types: `LifecycleSegment`, `LifecycleCandidate`, `LifecycleDueTouch`, `LifecycleConfig`, `LifecycleStore`, `LifecycleOutreachDeps`, `LifecycleOutreachSummary`, `InboundLifecycleHooks`
  - copy: `buildLifecycleMessage(segment, touchNumber, data, variantSeed): string`, `firstNameOf(displayName: string | null): string | null`, `LifecycleMergeData`

- [ ] **Step 1: Append the lifecycle types to `types.ts`**

```ts
// ── Lifecycle outreach (0045) — operator-side re-engagement DMs ──────────────

export type LifecycleSegment = "stalled_onboarding" | "idle_after_onboarding" | "trial_lapsed";

/** A user a segment scan wants to touch. */
export interface LifecycleCandidate {
  userId: string;
  accountId: string;
  displayName: string | null;
  linkedinUrl: string | null;
  /** segment A only: the onboarding step they stalled on (merge field) */
  stalledStep: string | null;
}

/** A sendable pending touch joined with fresh value-proof counts. */
export interface LifecycleDueTouch {
  id: string;
  userId: string;
  accountId: string | null;
  segment: LifecycleSegment;
  touchNumber: 1 | 2;
  linkedinUrl: string | null;
  displayName: string | null;
  stalledStep: string | null;
  /** invite gate state (booleans, not timestamps — raw-SQL rows skip driver date parsing) */
  inviteSent: boolean;
  connected: boolean;
  leadCount: number;
  qualifiedCount: number;
}

export interface LifecycleConfig {
  enabled: boolean;
  /** the founder identity's linkedin_accounts.provider_ref; null = feature inert */
  senderRef: string | null;
  dailyCap: number;
  /** free-text location fed to isWithinSendWindow (founder's business hours) */
  senderLocation: string;
  notifyEmail: string | null;
  lastRunAt: Date | null;
}

export interface LifecycleStore {
  getLifecycleConfig(): Promise<LifecycleConfig>;
  setLifecycleLastRun(now: Date): Promise<void>;
  isKillSwitchOn(): Promise<boolean>;
  getSenderRow(
    providerRef: string
  ): Promise<{ accountId: string; status: string; connectedAt: Date | null } | null>;
  scanStalledOnboarding(now: Date, excludeAccountId: string): Promise<LifecycleCandidate[]>;
  scanIdleAfterOnboarding(now: Date, excludeAccountId: string): Promise<LifecycleCandidate[]>;
  /** pre-ship lapses only: trial_ends_at within the last 60 days */
  scanTrialLapsedBackfill(now: Date, excludeAccountId: string): Promise<LifecycleCandidate[]>;
  /** idempotent — the (user, segment, touch) unique index swallows re-scans */
  enqueueTouch(c: LifecycleCandidate, segment: LifecycleSegment, touchNumber: 1 | 2): Promise<void>;
  /** touch-2 derivation: touch-1 sent ≥4d ago, no reply, no touch-2 yet; returns rows created */
  enqueueDueFollowUps(now: Date): Promise<number>;
  /** status='pending', 30-day cooldown enforced, replied users excluded — oldest first */
  getDueTouches(now: Date, limit: number): Promise<LifecycleDueTouch[]>;
  markTouchSent(
    id: string,
    patch: { messageRef: string; body: string; targetProviderRef: string | null; sentAt: Date }
  ): Promise<void>;
  markTouchInvited(id: string, targetProviderRef: string | null, now: Date): Promise<void>;
  /** attempts+1; stays 'pending' for one retry, then parks as 'failed' */
  markTouchFailed(id: string, error: string): Promise<void>;
  markTouchSkipped(id: string): Promise<void>;
  /** stop-on-reply; null = the sender's inbound didn't match any lifecycle touch */
  recordLifecycleReply(
    who: { providerRef: string | null; profileUrl: string },
    now: Date
  ): Promise<{ userId: string; displayName: string | null } | null>;
  /** invite accepted: connected_at stamped, 'invited' flips back to 'pending' */
  recordLifecycleAcceptance(
    who: { providerRef: string | null; profileUrl: string },
    now: Date
  ): Promise<boolean>;
  /** trial-expiry chaining: enqueue touch-1 trial_lapsed rows BEFORE the accounts are flipped */
  enqueueTrialLapsedForAccounts(accountIds: string[]): Promise<number>;
}

export interface LifecycleOutreachDeps {
  store: LifecycleStore;
  linkedin: Pick<LinkedInInfra, "sendMessage" | "sendInvite" | "getConnectionState">;
  send: (alert: { to: string; subject: string; html: string; text: string }) => Promise<void>;
  /** inter-send pacing; tests inject a no-op */
  pause?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface LifecycleOutreachSummary {
  status: "completed" | "skipped";
  reason?: "disabled" | "kill_switch" | "outside_window" | "already_ran" | "sender_unavailable";
  enqueued: number;
  followUps: number;
  messagesSent: number;
  invitesSent: number;
  skipped: number;
  failed: number;
}

/** Inbound interception (0045): events on the founder identity are operator traffic. */
export interface InboundLifecycleHooks {
  senderRef: string;
  recordReply: LifecycleStore["recordLifecycleReply"];
  recordAcceptance: LifecycleStore["recordLifecycleAcceptance"];
  notifyReply(displayName: string | null, body: string): Promise<void>;
}
```

Also add `lifecycle?: InboundLifecycleHooks;` to the existing `InboundDeps` interface (types.ts ~line 698), and add to `TrialExpiryDeps` (~line 582):

```ts
export interface TrialExpiryDeps {
  store: TrialStore;
  /** 0045: capture lapsing accounts as trial_lapsed touches at the moment of expiry */
  lifecycle?: Pick<LifecycleStore, "enqueueTrialLapsedForAccounts">;
  now?: () => Date;
}
```

- [ ] **Step 2: Write the failing copy tests**

`packages/jobs/src/pipeline/lifecycle-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLifecycleMessage, firstNameOf, type LifecycleMergeData } from "./lifecycle-copy";
import type { LifecycleSegment } from "./types";

const data = (over: Partial<LifecycleMergeData> = {}): LifecycleMergeData => ({
  firstName: "Sara",
  stalledStep: "your ideal customer profile",
  leadCount: 42,
  qualifiedCount: 11,
  ...over,
});

const SEGMENTS: LifecycleSegment[] = ["stalled_onboarding", "idle_after_onboarding", "trial_lapsed"];

describe("buildLifecycleMessage", () => {
  it("greets by first name and degrades cleanly without one", () => {
    expect(buildLifecycleMessage("trial_lapsed", 1, data(), 0)).toContain("Hey Sara,");
    expect(buildLifecycleMessage("trial_lapsed", 1, data({ firstName: null }), 0)).toContain("Hey,");
  });

  it("merges real counts into value-proof copy (idle + lapsed touch 1)", () => {
    expect(buildLifecycleMessage("idle_after_onboarding", 1, data(), 0)).toContain("42");
    expect(buildLifecycleMessage("trial_lapsed", 1, data(), 0)).toContain("42");
  });

  it("never says '0 leads' — zero-count users get the count-free variant", () => {
    for (const seed of [0, 1]) {
      const idle = buildLifecycleMessage("idle_after_onboarding", 1, data({ leadCount: 0, qualifiedCount: 0 }), seed);
      const lapsed = buildLifecycleMessage("trial_lapsed", 1, data({ leadCount: 0, qualifiedCount: 0 }), seed);
      expect(idle).not.toMatch(/\b0\b/);
      expect(lapsed).not.toMatch(/\b0\b/);
    }
  });

  it("merges the stalled step into segment A touch 1", () => {
    expect(buildLifecycleMessage("stalled_onboarding", 1, data(), 0)).toContain("your ideal customer profile");
  });

  it("variant pick is deterministic and seed-dependent", () => {
    const a = buildLifecycleMessage("stalled_onboarding", 1, data(), 0);
    expect(buildLifecycleMessage("stalled_onboarding", 1, data(), 0)).toBe(a);
    expect(buildLifecycleMessage("stalled_onboarding", 1, data(), 1)).not.toBe(a);
  });

  it("obeys the copy rules: no em/en dashes anywhere, ever", () => {
    for (const segment of SEGMENTS)
      for (const touch of [1, 2] as const)
        for (const seed of [0, 1])
          for (const d of [data(), data({ leadCount: 0, qualifiedCount: 0, firstName: null })]) {
            const msg = buildLifecycleMessage(segment, touch, d, seed);
            expect(msg).not.toMatch(/[—–]/);
            expect(msg.length).toBeLessThan(400); // a DM, not an email
          }
  });
});

describe("firstNameOf", () => {
  it("takes the first token", () => expect(firstNameOf("Sara Bright")).toBe("Sara"));
  it("null-safe", () => expect(firstNameOf(null)).toBeNull());
  it("rejects junk single chars", () => expect(firstNameOf("S")).toBeNull());
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @vantera/jobs test -- lifecycle-copy`
Expected: FAIL — module `./lifecycle-copy` not found.

- [ ] **Step 4: Write the copy module**

`packages/jobs/src/pipeline/lifecycle-copy.ts`:

```ts
import type { LifecycleSegment } from "./types";

/**
 * Founder-voice lifecycle messages (0045) — operator-side, NOT prospect outreach. The
 * agent-brains copy path is tuned for cold prospects and its pitch machinery is wrong for
 * our own users, so these are deterministic templates: short, plain, zero dashes, honest,
 * no fake personalization (repositioning copy guard). Count-based lines REQUIRE real
 * per-account counts; leadCount 0 always takes the count-free variant.
 */
export interface LifecycleMergeData {
  firstName: string | null;
  stalledStep: string | null;
  leadCount: number;
  qualifiedCount: number;
}

const greet = (first: string | null) => (first ? `Hey ${first},` : "Hey,");

type Builder = (d: LifecycleMergeData) => string;

const TEMPLATES: Record<LifecycleSegment, { touch1: Builder[]; touch2: Builder[] }> = {
  stalled_onboarding: {
    touch1: [
      (d) =>
        `${greet(d.firstName)} saw you started setting up Vantera but stopped at ${d.stalledStep ?? "the setup"}. You're about 2 minutes from your scout agent finding leads for you. Anything trip you up?`,
      (d) =>
        `${greet(d.firstName)} noticed your Vantera setup didn't get finished. It takes about 2 more minutes to get your scout hunting. Happy to walk you through it if something felt off.`,
    ],
    touch2: [
      () =>
        `Quick follow up. Your Vantera account is still sitting there half set up. If something felt confusing I'd genuinely like to know what it was.`,
      () =>
        `Following up once more. Your account is created and the last steps take a couple of minutes. If the setup lost you somewhere, tell me where and I'll fix it.`,
    ],
  },
  idle_after_onboarding: {
    touch1: [
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} your scout agent found ${d.leadCount} leads since you set it up and ${d.qualifiedCount} passed your qualification bar. They're in your dashboard when you have a minute.`
          : `${greet(d.firstName)} you finished setting up Vantera but I don't think you've been back in. Anything holding you up? Happy to help you get your first leads flowing.`,
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} quick note, there are ${d.leadCount} leads waiting in your Vantera dashboard that I don't think you've seen yet. Worth a look.`
          : `${greet(d.firstName)} you got through the Vantera setup but haven't been back since. If something didn't click, I'd like to hear it.`,
    ],
    touch2: [
      () =>
        `Those leads are still waiting in your dashboard. If the product didn't click for you I'd rather hear it straight, it helps me build the right thing.`,
      () =>
        `One more nudge from me. Your agents are set up and working, you just haven't seen the results yet. Log in once and see if it's useful. If not, tell me why.`,
    ],
  },
  trial_lapsed: {
    touch1: [
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} your Vantera trial wrapped up. While it ran, your scout found ${d.leadCount} leads and ${d.qualifiedCount} qualified. They're going cold sitting there. Want me to turn it back on for you?`
          : `${greet(d.firstName)} your Vantera trial ended before it really got going. If 3 days was too short to see value, tell me and I'll extend it.`,
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} your trial ended with ${d.leadCount} leads found and ${d.qualifiedCount} qualified. That pipeline is just parked now. Happy to restart it if you want to keep going.`
          : `${greet(d.firstName)} your Vantera trial expired. If it didn't get a fair shot in 3 days, say the word and I'll extend it.`,
    ],
    touch2: [
      () =>
        `Last note from me. If Vantera wasn't the right fit I'd love to know why, even one line helps. If it was just timing, your account is still here.`,
      () =>
        `Closing the loop on my last message. No pitch, I just want to know what would have made Vantera worth keeping. One line back helps me a lot.`,
    ],
  },
};

/** First name from a display name; single-char junk rejected. */
export function firstNameOf(displayName: string | null): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first && first.length > 1 ? first : null;
}

/** Deterministic per-user variant pick — the same user always sees the same variant. */
export function buildLifecycleMessage(
  segment: LifecycleSegment,
  touchNumber: 1 | 2,
  data: LifecycleMergeData,
  variantSeed: number
): string {
  const variants = TEMPLATES[segment][touchNumber === 1 ? "touch1" : "touch2"];
  return variants[Math.abs(variantSeed) % variants.length]!(data);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @vantera/jobs test -- lifecycle-copy`
Expected: PASS. Also run `pnpm --filter @vantera/jobs type-check` (or `pnpm type-check` at root) — the types.ts additions must compile.

- [ ] **Step 6: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/lifecycle-copy.ts packages/jobs/src/pipeline/lifecycle-copy.test.ts
git commit -m "feat(lifecycle): types + founder-voice templates for lifecycle outreach"
```

---

### Task 3: `createLifecycleStore` in pg-store

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (new exported factory at the end, after `createCrmPushStore`)

**Interfaces:**
- Consumes: `LifecycleStore`, `LifecycleCandidate`, `LifecycleConfig`, `LifecycleDueTouch` from `./types`; `lifecycleTouches, appSettings, linkedinAccounts, userProfiles` from `@vantera/db` (add to the existing import block); `normalizeLinkedInUrl` from `./copy-draft`; drizzle operators already imported (`and, eq, inArray, isNotNull, sql`).
- Produces: `export function createLifecycleStore(db: Db): LifecycleStore` — consumed by Tasks 5 and 6 wrappers.
- Testing note: store methods follow the `TrialStore` precedent (no dedicated unit tests; SQL is exercised in prod verification, logic is tested in the core against fakes). Type-check is the gate here.

- [ ] **Step 1: Implement the factory**

Append to `pg-store.ts`:

```ts
// Lifecycle outreach (0045). Operator-side — every method runs as service role; the
// lifecycle_touches table has no client policies by design.
export function createLifecycleStore(db: Db): LifecycleStore {
  const DAY = 86_400_000;
  const readSetting = async (key: string): Promise<unknown> => {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  };

  // owner + profile + best LinkedIn URL for a set of accounts — shared by the scans
  const candidateSql = (where: ReturnType<typeof sql>) => sql`
    select m.user_id as "userId", a.id as "accountId", p.display_name as "displayName",
           coalesce(x.profile_url, a.onboarding_linkedin_url) as "linkedinUrl"
    from public.accounts a
    join public.account_members m on m.account_id = a.id and m.role = 'owner'
    left join public.user_profiles p on p.user_id = m.user_id
    left join lateral (
      select la.profile_url from public.linkedin_accounts la
      where la.account_id = a.id and la.profile_url is not null
      order by la.connected_at desc nulls last limit 1
    ) x on true
    where ${where}
  `;

  type ScanRow = { userId: string; accountId: string; displayName: string | null; linkedinUrl: string | null };

  return {
    async getLifecycleConfig() {
      const [enabled, senderRef, dailyCap, senderLocation, notifyEmail, lastRunAt] = await Promise.all([
        readSetting("lifecycle_outreach_enabled"),
        readSetting("lifecycle_sender_ref"),
        readSetting("lifecycle_daily_cap"),
        readSetting("lifecycle_sender_location"),
        readSetting("lifecycle_notify_email"),
        readSetting("lifecycle_last_run_at"),
      ]);
      return {
        enabled: enabled === true,
        senderRef: typeof senderRef === "string" && senderRef.length > 0 ? senderRef : null,
        dailyCap: typeof dailyCap === "number" && dailyCap > 0 ? dailyCap : 10,
        senderLocation:
          typeof senderLocation === "string" && senderLocation.length > 0 ? senderLocation : "New York",
        notifyEmail: typeof notifyEmail === "string" && notifyEmail.length > 0 ? notifyEmail : null,
        lastRunAt: typeof lastRunAt === "string" ? new Date(lastRunAt) : null,
      };
    },

    async setLifecycleLastRun(now) {
      await db
        .insert(appSettings)
        .values({ key: "lifecycle_last_run_at", value: now.toISOString(), updatedAt: now })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: now.toISOString(), updatedAt: now },
        });
    },

    async isKillSwitchOn() {
      return (await readSetting("outreach_kill_switch")) === true;
    },

    async getSenderRow(providerRef) {
      const [row] = await db
        .select({
          accountId: linkedinAccounts.accountId,
          status: linkedinAccounts.status,
          connectedAt: linkedinAccounts.connectedAt,
        })
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.providerRef, providerRef));
      return row ?? null;
    },

    async scanStalledOnboarding(now, excludeAccountId) {
      const rows = await db.execute<ScanRow & { onboardingIcp: string | null; websiteUrl: string | null; revenueGoal: number | null }>(
        sql`
          select m.user_id as "userId", a.id as "accountId", p.display_name as "displayName",
                 coalesce(x.profile_url, a.onboarding_linkedin_url) as "linkedinUrl",
                 a.onboarding_icp as "onboardingIcp", a.website_url as "websiteUrl",
                 a.revenue_goal_cents as "revenueGoal"
          from public.accounts a
          join public.account_members m on m.account_id = a.id and m.role = 'owner'
          left join public.user_profiles p on p.user_id = m.user_id
          left join lateral (
            select la.profile_url from public.linkedin_accounts la
            where la.account_id = a.id and la.profile_url is not null
            order by la.connected_at desc nulls last limit 1
          ) x on true
          where a.onboarding_completed_at is null
            and a.created_at < ${new Date(now.getTime() - 2 * DAY)}
            and a.id <> ${excludeAccountId}
        `
      );
      // wizard order: ICP → website → revenue goal → final "find leads" step
      return rows.map((r) => ({
        userId: r.userId,
        accountId: r.accountId,
        displayName: r.displayName,
        linkedinUrl: r.linkedinUrl,
        stalledStep:
          r.onboardingIcp === null
            ? "your ideal customer profile"
            : r.websiteUrl === null
              ? "your website"
              : r.revenueGoal === null
                ? "your revenue goal"
                : "the final step",
      }));
    },

    async scanIdleAfterOnboarding(now, excludeAccountId) {
      // v1 proxy (no last-seen tracking exists): owner's last sign-in ≈ signup and the
      // account is >3 days old → they completed onboarding and never came back.
      const rows = await db.execute<ScanRow>(candidateSql(sql`
        a.onboarding_completed_at is not null
        and a.created_at < ${new Date(now.getTime() - 3 * DAY)}
        and a.id <> ${excludeAccountId}
        and exists (
          select 1 from auth.users u
          where u.id = m.user_id
            and u.last_sign_in_at is not null
            and u.last_sign_in_at < u.created_at + interval '24 hours'
        )
      `));
      return rows.map((r) => ({ ...r, stalledStep: null }));
    },

    async scanTrialLapsedBackfill(now, excludeAccountId) {
      // accounts that lapsed BEFORE this feature shipped; live lapses ride trial-expiry chaining
      const rows = await db.execute<ScanRow>(candidateSql(sql`
        a.subscription_status = 'none' and a.plan = 'none' and a.stripe_subscription_id is null
        and a.trial_ends_at is not null
        and a.trial_ends_at < ${now} and a.trial_ends_at > ${new Date(now.getTime() - 60 * DAY)}
        and a.id <> ${excludeAccountId}
      `));
      return rows.map((r) => ({ ...r, stalledStep: null }));
    },

    async enqueueTouch(c, segment, touchNumber) {
      await db
        .insert(lifecycleTouches)
        .values({
          userId: c.userId,
          accountId: c.accountId,
          segment,
          touchNumber,
          linkedinUrl: c.linkedinUrl,
          displayName: c.displayName,
          stalledStep: c.stalledStep,
        })
        .onConflictDoNothing();
    },

    async enqueueDueFollowUps(now) {
      const rows = await db.execute<{ id: string }>(sql`
        insert into public.lifecycle_touches
          (user_id, account_id, segment, touch_number, linkedin_url, target_provider_ref,
           display_name, stalled_step, connected_at)
        select t.user_id, t.account_id, t.segment, 2, t.linkedin_url, t.target_provider_ref,
               t.display_name, t.stalled_step, coalesce(t.connected_at, t.sent_at)
        from public.lifecycle_touches t
        where t.touch_number = 1 and t.status = 'sent' and t.replied_at is null
          and t.sent_at < ${new Date(now.getTime() - 4 * DAY)}
          and not exists (
            select 1 from public.lifecycle_touches t2
            where t2.user_id = t.user_id and t2.segment = t.segment and t2.touch_number = 2
          )
        on conflict do nothing
        returning id
      `);
      return rows.length;
    },

    async getDueTouches(now, limit) {
      const rows = await db.execute<LifecycleDueTouch>(sql`
        select t.id, t.user_id as "userId", t.account_id as "accountId", t.segment,
               t.touch_number as "touchNumber", t.linkedin_url as "linkedinUrl",
               t.display_name as "displayName", t.stalled_step as "stalledStep",
               (t.invite_sent_at is not null) as "inviteSent",
               (t.connected_at is not null) as "connected",
               coalesce(l.total, 0)::int as "leadCount", coalesce(l.qualified, 0)::int as "qualifiedCount"
        from public.lifecycle_touches t
        left join lateral (
          select count(*)::int as total,
                 (count(*) filter (where ai_score >= 70))::int as qualified
          from public.leads where account_id = t.account_id
        ) l on true
        where t.status = 'pending'
          and not exists (
            -- 30-day cross-segment cooldown + replied users are never auto-messaged again
            select 1 from public.lifecycle_touches x
            where x.user_id = t.user_id
              and (x.replied_at is not null
                   or (x.sent_at is not null and x.sent_at > ${new Date(now.getTime() - 30 * DAY)}))
          )
        order by t.created_at asc
        limit ${limit}
      `);
      return [...rows];
    },

    async markTouchSent(id, patch) {
      await db
        .update(lifecycleTouches)
        .set({
          status: "sent",
          messageRef: patch.messageRef,
          messageBody: patch.body,
          sentAt: patch.sentAt,
          ...(patch.targetProviderRef ? { targetProviderRef: patch.targetProviderRef } : {}),
        })
        .where(eq(lifecycleTouches.id, id));
    },

    async markTouchInvited(id, targetProviderRef, now) {
      await db
        .update(lifecycleTouches)
        .set({
          status: "invited",
          inviteSentAt: now,
          ...(targetProviderRef ? { targetProviderRef } : {}),
        })
        .where(eq(lifecycleTouches.id, id));
    },

    async markTouchFailed(id, error) {
      // one retry on the next run, then park — never hammer a personal account
      await db.execute(sql`
        update public.lifecycle_touches
        set attempts = attempts + 1, error = ${error},
            status = case when attempts + 1 >= 2 then 'failed' else 'pending' end
        where id = ${id}
      `);
    },

    async markTouchSkipped(id) {
      await db.update(lifecycleTouches).set({ status: "skipped_no_linkedin" }).where(eq(lifecycleTouches.id, id));
    },

    async recordLifecycleReply(who, now) {
      const userId = await matchLifecycleUser(db, who);
      if (!userId) return null;
      await db
        .update(lifecycleTouches)
        .set({ repliedAt: now })
        .where(and(eq(lifecycleTouches.userId, userId), eq(lifecycleTouches.status, "sent")));
      await db
        .update(lifecycleTouches)
        .set({ status: "canceled" })
        .where(and(eq(lifecycleTouches.userId, userId), inArray(lifecycleTouches.status, ["pending", "invited"])));
      const [p] = await db
        .select({ displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      return { userId, displayName: p?.displayName ?? null };
    },

    async recordLifecycleAcceptance(who, now) {
      const userId = await matchLifecycleUser(db, who);
      if (!userId) return false;
      await db.update(lifecycleTouches).set({ connectedAt: now }).where(eq(lifecycleTouches.userId, userId));
      await db
        .update(lifecycleTouches)
        .set({ status: "pending" })
        .where(and(eq(lifecycleTouches.userId, userId), eq(lifecycleTouches.status, "invited")));
      return true;
    },

    async enqueueTrialLapsedForAccounts(accountIds) {
      if (accountIds.length === 0) return 0;
      const rows = await db.execute<{ id: string }>(sql`
        insert into public.lifecycle_touches
          (user_id, account_id, segment, touch_number, linkedin_url, display_name)
        select m.user_id, a.id, 'trial_lapsed', 1,
               coalesce(x.profile_url, a.onboarding_linkedin_url), p.display_name
        from public.accounts a
        join public.account_members m on m.account_id = a.id and m.role = 'owner'
        left join public.user_profiles p on p.user_id = m.user_id
        left join lateral (
          select la.profile_url from public.linkedin_accounts la
          where la.account_id = a.id and la.profile_url is not null
          order by la.connected_at desc nulls last limit 1
        ) x on true
        where a.id = any(${accountIds})
        on conflict do nothing
        returning id
      `);
      return rows.length;
    },
  };
}

/** Reply/acceptance → lifecycle user: provider ref first (strong key), normalized URL fallback. */
async function matchLifecycleUser(
  db: Db,
  who: { providerRef: string | null; profileUrl: string }
): Promise<string | null> {
  if (who.providerRef) {
    const [r] = await db
      .select({ userId: lifecycleTouches.userId })
      .from(lifecycleTouches)
      .where(eq(lifecycleTouches.targetProviderRef, who.providerRef))
      .limit(1);
    if (r) return r.userId;
  }
  const norm = normalizeLinkedInUrl(who.profileUrl);
  const candidates = await db
    .select({ userId: lifecycleTouches.userId, url: lifecycleTouches.linkedinUrl })
    .from(lifecycleTouches)
    .where(isNotNull(lifecycleTouches.linkedinUrl));
  return candidates.find((c) => c.url && normalizeLinkedInUrl(c.url) === norm)?.userId ?? null;
}
```

Implementation notes for the engineer:
- Add `lifecycleTouches` to the `@vantera/db` import block at the top of pg-store.ts; `appSettings`, `linkedinAccounts`, `userProfiles` are already imported (verify, add if not).
- Add the new types (`LifecycleStore`, `LifecycleCandidate`, `LifecycleConfig`, `LifecycleDueTouch`) to the `./types` type-import block.
- `normalizeLinkedInUrl` comes from `./copy-draft` (account-health.ts imports it the same way).
- If `db.execute` rows come back typed as `Record<string, unknown>[]` in this drizzle version, keep the generic parameter as written — the codebase already uses `db.execute<{ email: string | null }>` in `getAccountAdminEmails`.
- If `a.id = any(${accountIds})` trips the postgres-js serializer, switch to `inArray`-style: `where a.id in (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})`.

- [ ] **Step 2: Type-check + full jobs tests still green**

Run: `pnpm --filter @vantera/jobs type-check 2>/dev/null || pnpm type-check` then `pnpm --filter @vantera/jobs test`
Expected: PASS (no behavior change yet — this task is compile-gated).

- [ ] **Step 3: Commit**

```bash
git add packages/jobs/src/pipeline/pg-store.ts
git commit -m "feat(lifecycle): drizzle store — scans, touch queue, reply matching (0045)"
```

---

### Task 4: Pipeline core `runLifecycleOutreach`

**Files:**
- Create: `packages/jobs/src/pipeline/lifecycle-outreach.ts`
- Test: `packages/jobs/src/pipeline/lifecycle-outreach.test.ts`

**Interfaces:**
- Consumes: `LifecycleOutreachDeps/Summary`, `LifecycleStore`, `LifecycleDueTouch` (Task 2 types); `buildLifecycleMessage`, `firstNameOf` (Task 2 copy); `dailyAllowance`, `paceWithJitter` from `./safety-limits`; `isWithinSendWindow` from `./send-window`.
- Produces: `runLifecycleOutreach(deps): Promise<LifecycleOutreachSummary>`, `buildLifecycleReplyAlert(to, name, body)`, `buildSenderDownAlert(to)`, constants `LIFECYCLE_SEND_GAP_MS`, `LIFECYCLE_RUN_GAP_MS` — consumed by Tasks 5 (alert builder) and 6 (wrapper).

- [ ] **Step 1: Write the failing tests**

`packages/jobs/src/pipeline/lifecycle-outreach.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { runLifecycleOutreach, buildLifecycleReplyAlert } from "./lifecycle-outreach";
import type { LifecycleConfig, LifecycleDueTouch, LifecycleStore } from "./types";

// Wednesday 15:00 UTC = 11:00 in New York — inside the Mon–Fri 08:00–16:59 window
const IN_WINDOW = new Date("2026-07-08T15:00:00.000Z");
// Saturday
const WEEKEND = new Date("2026-07-11T15:00:00.000Z");

const config = (over: Partial<LifecycleConfig> = {}): LifecycleConfig => ({
  enabled: true,
  senderRef: "unipile:founder",
  dailyCap: 10,
  senderLocation: "New York",
  notifyEmail: "founder@example.com",
  lastRunAt: null,
  ...over,
});

const touch = (over: Partial<LifecycleDueTouch> = {}): LifecycleDueTouch => ({
  id: "t1",
  userId: "u1",
  accountId: "a1",
  segment: "trial_lapsed",
  touchNumber: 1,
  linkedinUrl: "https://www.linkedin.com/in/sara",
  displayName: "Sara Bright",
  stalledStep: null,
  inviteSent: false,
  connected: false,
  leadCount: 42,
  qualifiedCount: 11,
  ...over,
});

function makeStore(over: Partial<Record<keyof LifecycleStore, unknown>> = {}) {
  const store = {
    getLifecycleConfig: vi.fn(async () => config()),
    setLifecycleLastRun: vi.fn(async () => {}),
    isKillSwitchOn: vi.fn(async () => false),
    getSenderRow: vi.fn(async () => ({ accountId: "ops", status: "active", connectedAt: new Date("2026-01-01") })),
    scanStalledOnboarding: vi.fn(async () => []),
    scanIdleAfterOnboarding: vi.fn(async () => []),
    scanTrialLapsedBackfill: vi.fn(async () => []),
    enqueueTouch: vi.fn(async () => {}),
    enqueueDueFollowUps: vi.fn(async () => 0),
    getDueTouches: vi.fn(async () => [] as LifecycleDueTouch[]),
    markTouchSent: vi.fn(async () => {}),
    markTouchInvited: vi.fn(async () => {}),
    markTouchFailed: vi.fn(async () => {}),
    markTouchSkipped: vi.fn(async () => {}),
    recordLifecycleReply: vi.fn(async () => null),
    recordLifecycleAcceptance: vi.fn(async () => false),
    enqueueTrialLapsedForAccounts: vi.fn(async () => 0),
    ...over,
  };
  return store as unknown as LifecycleStore & typeof store;
}

function makeDeps(store = makeStore(), now = IN_WINDOW) {
  const linkedin = new InMemoryLinkedInInfra();
  const sent: { to: string; subject: string }[] = [];
  const pauses: number[] = [];
  return {
    deps: {
      store,
      linkedin,
      send: async (a: { to: string; subject: string; html: string; text: string }) => {
        sent.push({ to: a.to, subject: a.subject });
      },
      pause: async (ms: number) => {
        pauses.push(ms);
      },
      now: () => now,
    },
    linkedin,
    sent,
    pauses,
  };
}

describe("runLifecycleOutreach gates", () => {
  it("no-ops when disabled or the sender ref is unset", async () => {
    const store = makeStore({ getLifecycleConfig: vi.fn(async () => config({ enabled: false })) });
    const { deps } = makeDeps(store);
    expect((await runLifecycleOutreach(deps)).reason).toBe("disabled");
    expect(store.scanStalledOnboarding).not.toHaveBeenCalled();
  });

  it("respects the platform kill switch", async () => {
    const store = makeStore({ isKillSwitchOn: vi.fn(async () => true) });
    const { deps } = makeDeps(store);
    expect((await runLifecycleOutreach(deps)).reason).toBe("kill_switch");
  });

  it("waits for the founder's business-hours window", async () => {
    const { deps } = makeDeps(makeStore(), WEEKEND);
    expect((await runLifecycleOutreach(deps)).reason).toBe("outside_window");
  });

  it("runs at most once a day (20h gate)", async () => {
    const store = makeStore({
      getLifecycleConfig: vi.fn(async () =>
        config({ lastRunAt: new Date(IN_WINDOW.getTime() - 3_600_000) })
      ),
    });
    const { deps } = makeDeps(store);
    expect((await runLifecycleOutreach(deps)).reason).toBe("already_ran");
  });

  it("aborts + alerts the founder when the sender connection is not active", async () => {
    const store = makeStore({
      getSenderRow: vi.fn(async () => ({ accountId: "ops", status: "disconnected", connectedAt: null })),
    });
    const { deps, sent } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.reason).toBe("sender_unavailable");
    expect(sent).toHaveLength(1);
    expect(store.setLifecycleLastRun).toHaveBeenCalled(); // the run gate is also the alert throttle
  });
});

describe("runLifecycleOutreach sending", () => {
  it("scans all three segments excluding the ops workspace, then enqueues", async () => {
    const store = makeStore({
      scanStalledOnboarding: vi.fn(async () => [
        { userId: "u9", accountId: "a9", displayName: null, linkedinUrl: null, stalledStep: "your website" },
      ]),
    });
    const { deps } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(store.scanStalledOnboarding).toHaveBeenCalledWith(IN_WINDOW, "ops");
    expect(store.enqueueTouch).toHaveBeenCalledTimes(1);
    expect(summary.enqueued).toBe(1);
  });

  it("DMs an already-connected target with merged founder copy and marks it sent", async () => {
    const store = makeStore({ getDueTouches: vi.fn(async () => [touch({ connected: true })]) });
    const { deps, linkedin } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.messagesSent).toBe(1);
    expect(linkedin.sentMessages).toHaveLength(1);
    expect(linkedin.sentMessages[0]!.connectedAccountId).toBe("unipile:founder");
    expect(linkedin.sentMessages[0]!.body).toContain("42");
    expect(store.markTouchSent).toHaveBeenCalled();
  });

  it("invite gate: a non-connection gets one note-less invite, not a message", async () => {
    const store = makeStore({ getDueTouches: vi.fn(async () => [touch()]) });
    const { deps, linkedin } = makeDeps(store); // fake getConnectionState → connected: false
    const summary = await runLifecycleOutreach(deps);
    expect(summary.invitesSent).toBe(1);
    expect(linkedin.sentInvites).toHaveLength(1);
    expect(linkedin.sentMessages).toHaveLength(0);
    expect(store.markTouchInvited).toHaveBeenCalled();
  });

  it("skips (forever) a touch with no LinkedIn URL — LinkedIn-only, no email fallback", async () => {
    const store = makeStore({ getDueTouches: vi.fn(async () => [touch({ linkedinUrl: null })]) });
    const { deps, linkedin } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.skipped).toBe(1);
    expect(store.markTouchSkipped).toHaveBeenCalledWith("t1");
    expect(linkedin.sentInvites).toHaveLength(0);
  });

  it("a send failure marks the touch failed and the run continues", async () => {
    const store = makeStore({
      getDueTouches: vi.fn(async () => [touch({ id: "bad", connected: true }), touch({ id: "ok", connected: true, userId: "u2" })]),
    });
    const { deps, linkedin } = makeDeps(store);
    const original = linkedin.sendMessage.bind(linkedin);
    let first = true;
    linkedin.sendMessage = async (req) => {
      if (first) {
        first = false;
        throw new Error("provider 500");
      }
      return original(req);
    };
    const summary = await runLifecycleOutreach(deps);
    expect(summary.failed).toBe(1);
    expect(summary.messagesSent).toBe(1);
    expect(store.markTouchFailed).toHaveBeenCalledWith("bad", "provider 500");
  });

  it("clamps the requested cap through the rule-04 message ceiling", async () => {
    const store = makeStore({
      getLifecycleConfig: vi.fn(async () => config({ dailyCap: 500 })),
    });
    const { deps } = makeDeps(store);
    await runLifecycleOutreach(deps);
    // LINKEDIN_STEADY_DAILY_MESSAGES = 25 — a misconfigured cap can never exceed it
    expect(store.getDueTouches).toHaveBeenCalledWith(IN_WINDOW, 25);
  });

  it("paces between sends but not before the first", async () => {
    const store = makeStore({
      getDueTouches: vi.fn(async () => [
        touch({ id: "t1", connected: true }),
        touch({ id: "t2", userId: "u2", connected: true }),
      ]),
    });
    const { deps, pauses } = makeDeps(store);
    await runLifecycleOutreach(deps);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]!).toBeGreaterThanOrEqual(84_000); // 120s ± 30%
    expect(pauses[0]!).toBeLessThanOrEqual(156_000);
  });

  it("stamps the run gate after a completed run", async () => {
    const store = makeStore();
    const { deps } = makeDeps(store);
    await runLifecycleOutreach(deps);
    expect(store.setLifecycleLastRun).toHaveBeenCalledWith(IN_WINDOW);
  });
});

describe("alert builders", () => {
  it("reply alert carries the sender name and body, escaped", () => {
    const a = buildLifecycleReplyAlert("f@x.com", "Sara <b>", "hi & thanks");
    expect(a.to).toBe("f@x.com");
    expect(a.html).toContain("&lt;b&gt;");
    expect(a.text).toContain("hi & thanks");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/jobs test -- lifecycle-outreach`
Expected: FAIL — module `./lifecycle-outreach` not found.

- [ ] **Step 3: Write the core**

`packages/jobs/src/pipeline/lifecycle-outreach.ts`:

```ts
import { dailyAllowance, paceWithJitter } from "./safety-limits";
import { isWithinSendWindow } from "./send-window";
import { buildLifecycleMessage, firstNameOf } from "./lifecycle-copy";
import type { LifecycleOutreachDeps, LifecycleOutreachSummary } from "./types";

// Operator-side lifecycle re-engagement (0045). Deliberately BYPASSES the campaign/lead
// machinery — targets are our own users, not prospects — but keeps the same safety
// posture: rule-04 ceilings, business-hours window, jittered pacing, kill switch, and a
// stop-on-reply contract (a user who replies is never auto-messaged again; the founder
// takes the thread over personally in their real inbox).

/** Gap between consecutive founder-account sends (jittered ±30%) — human pacing. */
export const LIFECYCLE_SEND_GAP_MS = 120_000;
/** Once-a-day gate: a run inside the last 20h makes this tick a no-op (fired every 15 min). */
export const LIFECYCLE_RUN_GAP_MS = 20 * 3_600_000;

const seedFor = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "someone replied" — the founder picks the thread up personally from their LinkedIn inbox. */
export function buildLifecycleReplyAlert(to: string, name: string | null, body: string) {
  const who = name ?? "A lifecycle contact";
  const text = [
    `${who} replied to your lifecycle message:`,
    "",
    body,
    "",
    "Reply personally from your LinkedIn inbox. Automated touches for them are stopped.",
  ].join("\n");
  const html = [
    `<p><strong>${esc(who)} replied to your lifecycle message.</strong></p>`,
    `<blockquote>${esc(body)}</blockquote>`,
    `<p>Reply personally from your LinkedIn inbox. Automated touches for them are stopped.</p>`,
  ].join("\n");
  return { to, subject: `${who} replied to your lifecycle outreach`, html, text };
}

export function buildSenderDownAlert(to: string) {
  const text =
    "Lifecycle outreach is paused: the founder LinkedIn connection is not active. Reconnect it in the ops workspace, then the next run resumes automatically.";
  return { to, subject: "Lifecycle outreach paused: sender connection down", html: `<p>${esc(text)}</p>`, text };
}

export async function runLifecycleOutreach(deps: LifecycleOutreachDeps): Promise<LifecycleOutreachSummary> {
  const now = deps.now?.() ?? new Date();
  const none = { enqueued: 0, followUps: 0, messagesSent: 0, invitesSent: 0, skipped: 0, failed: 0 };

  const config = await deps.store.getLifecycleConfig();
  if (!config.enabled || !config.senderRef) return { status: "skipped", reason: "disabled", ...none };
  if (await deps.store.isKillSwitchOn()) return { status: "skipped", reason: "kill_switch", ...none };
  if (!isWithinSendWindow(now, config.senderLocation)) return { status: "skipped", reason: "outside_window", ...none };
  if (config.lastRunAt && now.getTime() - config.lastRunAt.getTime() < LIFECYCLE_RUN_GAP_MS)
    return { status: "skipped", reason: "already_ran", ...none };

  const sender = await deps.store.getSenderRow(config.senderRef);
  if (!sender || sender.status !== "active") {
    // a dead personal-account session must be loud but never re-alert every 15 minutes —
    // stamping the run gate makes it once-a-day
    await deps.store.setLifecycleLastRun(now);
    if (config.notifyEmail) {
      try {
        await deps.send(buildSenderDownAlert(config.notifyEmail));
      } catch {
        /* best-effort */
      }
    }
    return { status: "skipped", reason: "sender_unavailable", ...none };
  }

  // scan → enqueue (idempotent; the unique index swallows re-scans)
  let enqueued = 0;
  const scans = [
    ["stalled_onboarding", await deps.store.scanStalledOnboarding(now, sender.accountId)],
    ["idle_after_onboarding", await deps.store.scanIdleAfterOnboarding(now, sender.accountId)],
    ["trial_lapsed", await deps.store.scanTrialLapsedBackfill(now, sender.accountId)],
  ] as const;
  for (const [segment, candidates] of scans) {
    for (const c of candidates) {
      await deps.store.enqueueTouch(c, segment, 1);
      enqueued += 1;
    }
  }
  const followUps = await deps.store.enqueueDueFollowUps(now);

  // send under the personal-account ceiling (rule 04 clamps a misconfigured cap)
  const senderAgeDays = sender.connectedAt
    ? (now.getTime() - sender.connectedAt.getTime()) / 86_400_000
    : 0;
  const cap = dailyAllowance("linkedin", senderAgeDays, { requested: config.dailyCap, kind: "message" });
  const due = await deps.store.getDueTouches(now, cap);

  let messagesSent = 0;
  let invitesSent = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;
  for (const t of due) {
    if (i > 0) await deps.pause?.(paceWithJitter(LIFECYCLE_SEND_GAP_MS, seedFor(t.id)));
    i += 1;
    if (!t.linkedinUrl) {
      // LinkedIn-only (owner decision): no URL means no touch, ever
      await deps.store.markTouchSkipped(t.id);
      skipped += 1;
      continue;
    }
    try {
      const connected = t.connected
        ? true
        : (
            await deps.linkedin.getConnectionState({
              connectedAccountId: config.senderRef,
              profileUrl: t.linkedinUrl,
            })
          ).connected;
      if (connected) {
        const body = buildLifecycleMessage(
          t.segment,
          t.touchNumber,
          {
            firstName: firstNameOf(t.displayName),
            stalledStep: t.stalledStep,
            leadCount: t.leadCount,
            qualifiedCount: t.qualifiedCount,
          },
          seedFor(t.userId)
        );
        const out = await deps.linkedin.sendMessage({
          connectedAccountId: config.senderRef,
          profileUrl: t.linkedinUrl,
          body,
        });
        await deps.store.markTouchSent(t.id, {
          messageRef: out.id,
          body,
          targetProviderRef: out.prospectProviderRef ?? null,
          sentAt: now,
        });
        messagesSent += 1;
      } else if (!t.inviteSent) {
        // invite gate: DMs need a 1st-degree connection; ONE note-less invite, then wait
        // for the acceptance webhook to flip the row back to 'pending'
        const out = await deps.linkedin.sendInvite({
          connectedAccountId: config.senderRef,
          profileUrl: t.linkedinUrl,
        });
        await deps.store.markTouchInvited(t.id, out.prospectProviderRef ?? null, now);
        invitesSent += 1;
      } else {
        // invited + still not connected — parked; getDueTouches shouldn't return this, guard anyway
        skipped += 1;
      }
    } catch (e) {
      await deps.store.markTouchFailed(t.id, e instanceof Error ? e.message : String(e));
      failed += 1;
    }
  }

  await deps.store.setLifecycleLastRun(now);
  return { status: "completed", enqueued, followUps, messagesSent, invitesSent, skipped, failed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vantera/jobs test -- lifecycle-outreach`
Expected: PASS (all gate + sending + alert tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/lifecycle-outreach.ts packages/jobs/src/pipeline/lifecycle-outreach.test.ts
git commit -m "feat(lifecycle): pipeline core — gated, paced, invite-aware lifecycle sends"
```

---

### Task 5: Stop-on-reply — inbound interception

**Files:**
- Modify: `packages/jobs/src/pipeline/inbound.ts` (interception block in `runInbound`)
- Modify: `packages/jobs/src/trigger/process-inbound.ts` (wire the hooks)
- Test: `packages/jobs/src/pipeline/inbound.test.ts` (new describe)

**Interfaces:**
- Consumes: `InboundLifecycleHooks` (Task 2), `createLifecycleStore` (Task 3), `buildLifecycleReplyAlert` (Task 4), `InMemoryLinkedInInfra` payload shapes (`event_type` / `connected_account` / `from_provider_ref` / `from_profile_url` / `profile_url` / `body` / `received_at` / `event_id`).
- Produces: `runInbound` returns `action: "lifecycle:reply"` / `"lifecycle:accepted"` for matched sender events; unmatched sender events fall through to the tenant path unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `packages/jobs/src/pipeline/inbound.test.ts` (reuse the file's existing deps/store fixture builder for the fall-through case; the intercepted cases never touch the store):

```ts
describe("lifecycle sender interception (0045)", () => {
  const SENDER = "unipile:founder";
  const lifecycleDeps = (over: Partial<import("./types").InboundLifecycleHooks> = {}) => ({
    senderRef: SENDER,
    recordReply: vi.fn(async () => ({ userId: "u1", displayName: "Sara Bright" })),
    recordAcceptance: vi.fn(async () => true),
    notifyReply: vi.fn(async () => {}),
    ...over,
  });

  const replyPayload = {
    event_id: "ev1",
    event_type: "reply",
    connected_account: SENDER,
    from_profile_url: "https://www.linkedin.com/in/sara",
    from_provider_ref: "ACoAA-sara",
    body: "hey! yes let's talk",
    received_at: "2026-07-09T15:00:00.000Z",
  };

  it("a reply on the founder identity stops the sequence and notifies the founder", async () => {
    const lifecycle = lifecycleDeps();
    // the intercepted path never touches the store — an empty stub proves it
    const summary = await runInbound(
      { source: "linkedin", payload: replyPayload },
      {
        store: {} as never,
        linkedinInfra: new InMemoryLinkedInInfra(),
        classifyFn: vi.fn(),
        lifecycle,
      } as never
    );
    expect(summary).toEqual({ handled: true, action: "lifecycle:reply" });
    expect(lifecycle.recordReply).toHaveBeenCalledWith(
      { providerRef: "ACoAA-sara", profileUrl: "https://www.linkedin.com/in/sara" },
      expect.any(Date)
    );
    expect(lifecycle.notifyReply).toHaveBeenCalledWith("Sara Bright", "hey! yes let's talk");
  });

  it("an acceptance on the founder identity opens the DM gate", async () => {
    const lifecycle = lifecycleDeps();
    const summary = await runInbound(
      {
        source: "linkedin",
        payload: {
          event_id: "ev2",
          event_type: "relationship_accepted",
          connected_account: SENDER,
          profile_url: "https://www.linkedin.com/in/sara",
          from_provider_ref: "ACoAA-sara",
        },
      },
      { store: {} as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(summary).toEqual({ handled: true, action: "lifecycle:accepted" });
  });

  it("an unmatched sender event falls through to the tenant path", async () => {
    const lifecycle = lifecycleDeps({ recordReply: vi.fn(async () => null) });
    const store = { findLinkedInAccountByProviderRef: vi.fn(async () => null) };
    const summary = await runInbound(
      { source: "linkedin", payload: replyPayload },
      { store: store as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(store.findLinkedInAccountByProviderRef).toHaveBeenCalledWith(SENDER);
    expect(summary.action).toBe("unknown linkedin identity");
  });

  it("a notify failure never blocks the stop-on-reply write", async () => {
    const lifecycle = lifecycleDeps({ notifyReply: vi.fn(async () => { throw new Error("smtp down"); }) });
    const summary = await runInbound(
      { source: "linkedin", payload: replyPayload },
      { store: {} as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(summary.action).toBe("lifecycle:reply");
  });

  it("events on other identities are untouched by the lifecycle hooks", async () => {
    const lifecycle = lifecycleDeps();
    const store = { findLinkedInAccountByProviderRef: vi.fn(async () => null) };
    await runInbound(
      { source: "linkedin", payload: { ...replyPayload, connected_account: "unipile:customer" } },
      { store: store as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(lifecycle.recordReply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/jobs test -- inbound`
Expected: FAIL — actions come back as tenant-path results, `lifecycle` dep unused.

- [ ] **Step 3: Add the interception to `runInbound`**

In `packages/jobs/src/pipeline/inbound.ts`, immediately AFTER the `account_status` block (so `event` is narrowed to `reply | relationship_accepted`) and BEFORE `findLinkedInAccountByProviderRef`:

```ts
  // Lifecycle sender (0045): events on the founder identity are operator traffic, not
  // tenant outreach. A reply stops that user's lifecycle sequence forever and hands the
  // thread to the founder's real inbox; an acceptance opens the DM gate for a parked
  // invite. account_status events fall through above — the sender identity rides the
  // normal connection-health machinery. An unmatched event falls through to the tenant
  // path (the ops workspace may legitimately hold other traffic).
  if (deps.lifecycle && event.connectedAccountRef === deps.lifecycle.senderRef) {
    if (event.type === "relationship_accepted") {
      const matched = await deps.lifecycle.recordAcceptance(
        { providerRef: event.fromProviderRef, profileUrl: event.profileUrl },
        now
      );
      if (matched) return { handled: true, action: "lifecycle:accepted" };
    } else {
      const who = await deps.lifecycle.recordReply(
        { providerRef: event.fromProviderRef, profileUrl: event.fromProfileUrl },
        now
      );
      if (who) {
        try {
          await deps.lifecycle.notifyReply(who.displayName, event.body);
        } catch {
          // notification is best-effort; the stop-on-reply write already happened
        }
        return { handled: true, action: "lifecycle:reply" };
      }
    }
  }
```

- [ ] **Step 4: Wire the hooks in the task wrapper**

`packages/jobs/src/trigger/process-inbound.ts` — build the lifecycle deps when a sender is configured:

```ts
import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyReply, draftConversationMessage, fixConversationMessage } from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { runInbound } from "../pipeline/inbound";
import { buildLifecycleReplyAlert } from "../pipeline/lifecycle-outreach";
import { createLifecycleStore, createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

export const processInbound = task({
  id: "process-inbound",
  maxDuration: 600,
  run: async (payload: InboundPayload) => {
    const db = createDb();
    const store = createPgStore(db);
    const lifecycleStore = createLifecycleStore(db);
    const lifecycleConfig = await lifecycleStore.getLifecycleConfig();
    const summary = await runInbound(payload, {
      store,
      linkedinInfra: createLinkedInInfraFromEnv(),
      classifyFn: (body) => classifyReply(body),
      respondFn: (input) => draftConversationMessage(input),
      fixReplyFn: (original, input) => fixConversationMessage(original, input),
      // 0045: intercept events on the founder identity (stop-on-reply + invite acceptance)
      lifecycle: lifecycleConfig.senderRef
        ? {
            senderRef: lifecycleConfig.senderRef,
            recordReply: (who, now) => lifecycleStore.recordLifecycleReply(who, now),
            recordAcceptance: (who, now) => lifecycleStore.recordLifecycleAcceptance(who, now),
            notifyReply: async (name, body) => {
              if (!lifecycleConfig.notifyEmail) return;
              await createTransactionalEmailFromEnv().send(
                buildLifecycleReplyAlert(lifecycleConfig.notifyEmail, name, body)
              );
            },
          }
        : undefined,
    });
    if (summary.action.endsWith("+responded")) {
      await tasks.trigger("send-dispatch", {});
    }
    logger.info("inbound processed", { source: payload.source, ...summary });
    return summary;
  },
});
```

(Keep the existing header comment; only the body changes shown here.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @vantera/jobs test -- inbound`
Expected: PASS — new describe green, ALL existing inbound tests still green (no lifecycle dep = old behavior).

- [ ] **Step 6: Commit**

```bash
git add packages/jobs/src/pipeline/inbound.ts packages/jobs/src/trigger/process-inbound.ts packages/jobs/src/pipeline/inbound.test.ts
git commit -m "feat(lifecycle): stop-on-reply + invite-acceptance interception on the founder identity"
```

---

### Task 6: Trigger wrapper, scheduler tick, trial-expiry chaining

**Files:**
- Create: `packages/jobs/src/trigger/lifecycle-outreach.ts`
- Modify: `packages/jobs/src/trigger/agent-scheduler.ts` (one line)
- Modify: `packages/jobs/src/pipeline/trial-expiry.ts` + `packages/jobs/src/trigger/trial-expiry.ts`
- Test: `packages/jobs/src/pipeline/trial-expiry.test.ts` (chaining cases; `structure.test.ts` covers the wrapper automatically)

**Interfaces:**
- Consumes: `runLifecycleOutreach` + `createLifecycleStore` (Tasks 3–4); `TrialExpiryDeps.lifecycle` (Task 2).
- Produces: Trigger task id `"lifecycle-outreach"`; `runTrialExpiry` enqueues `trial_lapsed` touches BEFORE flipping accounts.

- [ ] **Step 1: Write the failing trial-expiry tests**

Append to `packages/jobs/src/pipeline/trial-expiry.test.ts`:

```ts
describe("runTrialExpiry lifecycle chaining (0045)", () => {
  it("captures lapsing accounts as trial_lapsed touches BEFORE the flip", async () => {
    const calls: string[] = [];
    const s: TrialStore = {
      getExpiredTrialAccounts: vi.fn(async () => [{ id: "a" }, { id: "b" }]),
      expireTrials: vi.fn(async (ids: string[]) => {
        calls.push("expire");
        return ids.length;
      }),
    };
    const lifecycle = {
      enqueueTrialLapsedForAccounts: vi.fn(async (ids: string[]) => {
        calls.push("enqueue");
        return ids.length;
      }),
    };
    await runTrialExpiry({ store: s, lifecycle });
    expect(lifecycle.enqueueTrialLapsedForAccounts).toHaveBeenCalledWith(["a", "b"]);
    expect(calls).toEqual(["enqueue", "expire"]); // capture must precede the flip
  });

  it("skips the lifecycle hook when nothing lapsed", async () => {
    const lifecycle = { enqueueTrialLapsedForAccounts: vi.fn(async () => 0) };
    await runTrialExpiry({
      store: { getExpiredTrialAccounts: vi.fn(async () => []), expireTrials: vi.fn(async () => 0) },
      lifecycle,
    });
    expect(lifecycle.enqueueTrialLapsedForAccounts).not.toHaveBeenCalled();
  });

  it("still works with no lifecycle dep (backward compatible)", async () => {
    const summary = await runTrialExpiry({
      store: { getExpiredTrialAccounts: vi.fn(async () => [{ id: "a" }]), expireTrials: vi.fn(async () => 1) },
    });
    expect(summary.expired).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/jobs test -- trial-expiry`
Expected: FAIL — `lifecycle` not a known dep / hook never called.

- [ ] **Step 3: Implement the chaining + wrapper + tick**

`packages/jobs/src/pipeline/trial-expiry.ts` — replace the function body:

```ts
export async function runTrialExpiry(deps: TrialExpiryDeps): Promise<TrialExpirySummary> {
  const now = deps.now ? deps.now() : new Date();
  const expired = await deps.store.getExpiredTrialAccounts(now);
  // 0045: capture BEFORE the flip — post-expiry these rows are indistinguishable from any
  // canceled account, so the moment of lapse is the only clean capture point.
  if (expired.length > 0 && deps.lifecycle) {
    await deps.lifecycle.enqueueTrialLapsedForAccounts(expired.map((a) => a.id));
  }
  const count = expired.length > 0 ? await deps.store.expireTrials(expired.map((a) => a.id)) : 0;
  return { status: "completed", expired: count };
}
```

`packages/jobs/src/trigger/trial-expiry.ts` — wire the store:

```ts
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLifecycleStore, createPgStore } from "../pipeline/pg-store";
import { runTrialExpiry } from "../pipeline/trial-expiry";

/** Daily: lapse no-card free trials past their end date (0019) → gate re-blocks, outreach pauses.
 *  Lapsing accounts are also captured as lifecycle trial_lapsed touches (0045). */
export const trialExpiry = schedules.task({
  id: "trial-expiry",
  cron: "0 5 * * *",
  run: async () => {
    const db = createDb();
    const summary = await runTrialExpiry({ store: createPgStore(db), lifecycle: createLifecycleStore(db) });
    logger.info("trial expiry finished", { ...summary });
    return summary;
  },
});
```

Create `packages/jobs/src/trigger/lifecycle-outreach.ts`:

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { runLifecycleOutreach } from "../pipeline/lifecycle-outreach";
import { createLifecycleStore } from "../pipeline/pg-store";

/**
 * Operator-side lifecycle re-engagement (0045): founder DMs to stalled-onboarding, idle,
 * and trial-lapsed users, sent from the founder's own LinkedIn identity. Fired from the
 * agent-scheduler tick (the Trigger schedule quota is 10/10, same reason as account-health);
 * the core's own gates (enabled flag, kill switch, business-hours window, once-a-day run
 * gate) make the 15-minute firing a cheap no-op.
 */
export const lifecycleOutreach = task({
  id: "lifecycle-outreach",
  maxDuration: 3600, // paced sends: up to cap × ~2min jittered gaps
  run: async () => {
    const mailer = createTransactionalEmailFromEnv();
    const summary = await runLifecycleOutreach({
      store: createLifecycleStore(createDb()),
      linkedin: createLinkedInInfraFromEnv(),
      send: async (alert) => {
        await mailer.send(alert);
      },
      pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    logger.info("lifecycle outreach tick", { ...summary });
    return summary;
  },
});
```

`packages/jobs/src/trigger/agent-scheduler.ts` — after the `account-health` trigger line, add:

```ts
    await tasks.trigger("lifecycle-outreach", {});
```

(and extend the file's header comment: `Also fires the account-health reconcile and the lifecycle-outreach tick each run (plain tasks piggybacking this cron: the plan's schedule quota is at 10/10).`)

- [ ] **Step 4: Run the full jobs suite**

Run: `pnpm --filter @vantera/jobs test`
Expected: PASS — including `structure.test.ts` (the new wrapper imports its core from `../pipeline/`) and all trial-expiry cases.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/trigger/lifecycle-outreach.ts packages/jobs/src/trigger/agent-scheduler.ts packages/jobs/src/pipeline/trial-expiry.ts packages/jobs/src/trigger/trial-expiry.ts packages/jobs/src/pipeline/trial-expiry.test.ts
git commit -m "feat(lifecycle): task wrapper on the scheduler tick + trial-expiry capture chaining"
```

---

### Task 7: Full gate, ship, and production activation runbook

**Files:**
- No new code. Verification + ops.

- [ ] **Step 1: Full CI gate**

Run at repo root: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green. Fix anything that isn't before proceeding.

- [ ] **Step 2: Merge + deploy**

Merge `lifecycle-linkedin-outreach` → `main` (gate green). Vercel + Trigger prod ride the existing main-branch CI (rule 10). Commit message note: knowledge-sync (rule 09) N/A — operator-side feature, no user-facing surface change.

- [ ] **Step 3: Apply migration 0045 to prod**

Apply `packages/db/migrations/0045_lifecycle_touches.sql` to the production Supabase project via the established migration lane (Supabase MCP `apply_migration`, prod project — the same path 0037–0044 took). Verify: `select count(*) from lifecycle_touches;` returns 0, and RLS is enabled (`select relrowsecurity from pg_class where relname = 'lifecycle_touches';` → `t`).

- [ ] **Step 4: Connect the founder LinkedIn identity**

1. Log into the ops workspace (`aiden@vanterasystem.com`) in prod → Settings → Channels → connect LinkedIn (the founder's personal profile) through the normal hosted-auth flow.
2. Get the ref: `select provider_ref, profile_url, status from linkedin_accounts la join accounts a on a.id = la.account_id where a.stripe_customer_id is null and la.profile_url is not null;` — confirm `status = 'active'` and note `provider_ref` and the ops `account_id`.

- [ ] **Step 5: Seed config (feature still OFF)**

```sql
insert into app_settings (key, value) values
  ('lifecycle_sender_ref',        to_jsonb('<provider_ref from step 4>'::text)),
  ('lifecycle_daily_cap',         to_jsonb(10)),
  ('lifecycle_sender_location',   to_jsonb('New York'::text)),  -- set to the founder's real market
  ('lifecycle_notify_email',      to_jsonb('aiden@vanterasystem.com'::text)),
  ('lifecycle_outreach_enabled',  to_jsonb(false))
on conflict (key) do update set value = excluded.value, updated_at = now();
```

- [ ] **Step 6: Dry run, then enable**

1. With `enabled=false`, trigger the `lifecycle-outreach` task once from the Trigger.dev dashboard → expect `{ status: "skipped", reason: "disabled" }` in the run log.
2. Flip: `update app_settings set value = to_jsonb(true) where key = 'lifecycle_outreach_enabled';`
3. Watch the next in-window run: check the summary counts, then `select segment, status, count(*) from lifecycle_touches group by 1, 2;` and confirm the sends/invites appear in the founder's actual LinkedIn Sent/Invitations views.
4. Reply to one touch from a test profile and confirm: `replied_at` stamps, pending rows cancel, and the notify email arrives.

- [ ] **Step 7: Record operational notes**

Add a short entry to `docs/production-readiness.md`: the config keys, the kill paths (`lifecycle_outreach_enabled`, platform `outreach_kill_switch`), and the known v1 limits (segment B uses the `last_sign_in_at` proxy — fast-follow is `accounts.last_dashboard_seen_at`; users who never started onboarding step 1 are unreachable by design).

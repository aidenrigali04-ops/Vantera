# Pull-back Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email a stalled user about the leads or drafts already waiting for them, by name, twice at most, without colliding with the other lifecycle emails.

**Architecture:** A pure `composePullback` core decides send/don't-send and is unit-tested with no mailer. A `createPullbackStore` does audience selection in SQL. A plain Trigger task piggybacks the existing `agent-scheduler` cron (the schedule quota is at 10/10). Idempotence lives in `lifecycle_touches`, which gains a `channel` column so email and LinkedIn touches stop colliding.

**Tech Stack:** TypeScript strict, Drizzle + Supabase Postgres, Trigger.dev v4, Resend behind `@vantera/transactional-email`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-pullback-email-design.md`

## Global Constraints

- **Never add a `schedules.task`.** The Trigger plan is at 10/10; an 11th breaks every prod deploy. New periodic work is a plain `task({...})` fired from `agentScheduler`.
- **Brain purity / thin trigger tasks** (rule 13): logic lives in `packages/jobs/src/pipeline/`, the `trigger/` wrapper only wires deps and logs. Guarded by `packages/jobs/src/structure.test.ts`.
- **Real data only.** No placeholder counts, no "you have new activity". If no real person can be named, send nothing.
- **White-label** (rules 03/04/05): no vendor names on any user-facing surface, including email copy.
- **Tests colocated** as `*.test.ts` next to the unit. No `__tests__/` trees.
- **Knowledge-sync** (rule 09): the help article ships in this same PR.
- Full gate before merge: `pnpm lint && pnpm type-check && pnpm test && pnpm build`.
- Migrations are committed before applied, never hand-edited in the dashboard (rule 10).

---

### Task 1: Migration 0060 — channel column + collision stamp

**Files:**
- Create: `packages/db/migrations/0060_pullback_email.sql`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `lifecycle_touches.channel` (`'linkedin' | 'email'`, default `'linkedin'`), unique index `(user_id, segment, touch_number, channel)`, new segments `drafts_waiting` / `leads_waiting`, and `accounts.lifecycle_last_email_at timestamptz`. Drizzle: `lifecycleTouches.channel`, `accounts.lifecycleLastEmailAt`.

> Both tables already exist with RLS enabled — `lifecycle_touches` is service-role-only with no policies, `accounts` is tenant-scoped. This migration adds columns only, so no new RLS policy is required. `lifecycle_last_email_at` gets **no** `authenticated` column grant: users never set it.

- [ ] **Step 1: Write the migration**

Create `packages/db/migrations/0060_pullback_email.sql`:

```sql
-- 0060 (pull-back email, 2026-07-18): make lifecycle_touches channel-neutral and add the
-- cross-email collision stamp.
--
-- 0045 shaped lifecycle_touches around LinkedIn DMs and made the unique key
-- (user_id, segment, touch_number) with no channel — so an email touch for a user who already
-- has a LinkedIn touch in the same segment would silently no-op via onConflictDoNothing.
-- One channel-neutral ledger also stops the armed LinkedIn DM feature and this email from
-- contacting the same person twice in a week.

alter table lifecycle_touches
  add column if not exists channel text not null default 'linkedin';

alter table lifecycle_touches
  drop constraint if exists lifecycle_touches_channel_check;
alter table lifecycle_touches
  add constraint lifecycle_touches_channel_check check (channel in ('linkedin', 'email'));

comment on column lifecycle_touches.channel is
  'Which lane delivered this touch. Default linkedin keeps every 0045 row and the DM path unchanged.';

-- Widen the segment vocabulary for the two email segments.
alter table lifecycle_touches
  drop constraint if exists lifecycle_touches_segment_check;
alter table lifecycle_touches
  add constraint lifecycle_touches_segment_check
  check (segment in (
    'stalled_onboarding', 'idle_after_onboarding', 'trial_lapsed',
    'drafts_waiting', 'leads_waiting'
  ));

-- Idempotence key now includes channel.
drop index if exists lifecycle_touches_user_segment_touch_idx;
create unique index if not exists lifecycle_touches_user_segment_touch_channel_idx
  on lifecycle_touches (user_id, segment, touch_number, channel);

-- Collision guard: pull-back yields to any other lifecycle email within 48h.
alter table accounts add column if not exists lifecycle_last_email_at timestamptz;
comment on column accounts.lifecycle_last_email_at is
  'When ANY lifecycle email last went to this account. Service-written only (no authenticated grant) — read by the pull-back collision guard.';
```

- [ ] **Step 2: Add the columns to the Drizzle schema**

In `packages/db/src/schema.ts`, add to the `accounts` table definition, next to `trialEndingNotifiedAt`:

```ts
  lifecycleLastEmailAt: timestamp("lifecycle_last_email_at", { withTimezone: true }),
```

And to the `lifecycleTouches` table definition, next to `status`:

```ts
  channel: text("channel").notNull().default("linkedin"),
```

- [ ] **Step 3: Write the failing guardrail test**

Append to `packages/db/src/schema.test.ts`:

```ts
describe("0060 pull-back email", () => {
  const sqlText = readFileSync(
    join(migrationsDir, "0060_pullback_email.sql"),
    "utf8"
  );

  it("adds channel with a linkedin default so existing rows and the DM path are unchanged", () => {
    expect(sqlText).toMatch(/add column if not exists channel text not null default 'linkedin'/);
  });

  it("puts channel in the idempotence key — an email touch must not collide with a LinkedIn one", () => {
    expect(sqlText).toMatch(
      /create unique index if not exists lifecycle_touches_user_segment_touch_channel_idx\s+on lifecycle_touches \(user_id, segment, touch_number, channel\)/
    );
  });

  it("widens segments for the two email segments", () => {
    expect(sqlText).toContain("'drafts_waiting'");
    expect(sqlText).toContain("'leads_waiting'");
  });

  it("does NOT grant lifecycle_last_email_at to authenticated — service-written only", () => {
    expect(sqlText).not.toMatch(/grant update \(lifecycle_last_email_at\)/);
  });
});
```

> If `migrationsDir` / `readFileSync` are not already imported in this file, mirror the imports used by the existing migration assertions at the top of `schema.test.ts`.

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @vantera/db test -- schema.test.ts`
Expected: FAIL — `ENOENT` on `0060_pullback_email.sql` if the file is missing, or assertion failures.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @vantera/db test -- schema.test.ts`
Expected: PASS, all four new assertions green.

- [ ] **Step 6: Type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/migrations/0060_pullback_email.sql packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "feat(db): 0060 — channel-neutral lifecycle_touches + lifecycle_last_email_at stamp"
```

---

### Task 2: `composePullback` pure core

**Files:**
- Create: `packages/jobs/src/pipeline/pullback.ts`
- Test: `packages/jobs/src/pipeline/pullback.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `PullbackSegment`, `PullbackPreview`, `PullbackRow`, `PullbackMessage`, `composePullback(row, appUrl, now): Omit<PullbackMessage, "to" | "userId"> | null`, and `COLLISION_WINDOW_MS` / `MIN_ARTIFACT_AGE_MS`. Compose owns content only; `runPullback` attaches `to` and `userId`.

> Responsibility split: **compose** owns opted-out, no recipients, nothing to show, nobody nameable, artifact too young, and the 48h collision. **The store** (Task 3) owns ledger dedupe and the "never returned" predicate, because those need the DB. Both are tested.

- [ ] **Step 1: Write the failing test**

Create `packages/jobs/src/pipeline/pullback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composePullback, type PullbackRow } from "./pullback";

const APP = "https://www.vanterasystem.dev";
const NOW = new Date("2026-07-18T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function row(over: Partial<PullbackRow> = {}): PullbackRow {
  return {
    accountId: "acc-1",
    userId: "user-1",
    emails: ["founder@example.com"],
    segment: "drafts_waiting",
    touchNumber: 1,
    itemCount: 20,
    previews: [
      { name: "Antonino Ingoglia", title: "Attorney", company: "Studio Legale" },
      { name: "Marco Rossi", title: "CTO", company: "Acme SRL" },
    ],
    draftExcerpt: "Saw you work on GDPR compliance for startups —",
    oldestArtifactAt: hoursAgo(30),
    lifecycleEmailsEnabled: true,
    lifecycleLastEmailAt: null,
    ...over,
  };
}

describe("composePullback", () => {
  it("names the real count and real people for drafts_waiting", () => {
    const msg = composePullback(row(), APP, NOW);
    expect(msg).not.toBeNull();
    expect(msg!.subject).toBe("Vera wrote 20 messages for you");
    expect(msg!.lines.join(" ")).toContain("Antonino Ingoglia");
    expect(msg!.ctaUrl).toBe(`${APP}/inbox`);
  });

  it("names real buyers for leads_waiting and links to leads", () => {
    const msg = composePullback(
      row({ segment: "leads_waiting", itemCount: 22, draftExcerpt: null }),
      APP,
      NOW
    );
    expect(msg!.subject).toBe("22 buyers matched your ICP");
    expect(msg!.ctaUrl).toBe(`${APP}/leads`);
  });

  it("uses singular copy when there is exactly one item", () => {
    const msg = composePullback(row({ itemCount: 1 }), APP, NOW);
    expect(msg!.subject).toBe("Vera wrote 1 message for you");
  });

  it("returns null when lifecycle emails are switched off", () => {
    expect(composePullback(row({ lifecycleEmailsEnabled: false }), APP, NOW)).toBeNull();
  });

  it("returns null when there are no recipients", () => {
    expect(composePullback(row({ emails: [] }), APP, NOW)).toBeNull();
  });

  it("returns null when there is nothing waiting", () => {
    expect(composePullback(row({ itemCount: 0 }), APP, NOW)).toBeNull();
  });

  it("returns null when nobody can be named — never send a hollow email", () => {
    expect(composePullback(row({ previews: [] }), APP, NOW)).toBeNull();
  });

  it("returns null while the artifact is younger than 24h", () => {
    expect(composePullback(row({ oldestArtifactAt: hoursAgo(23) }), APP, NOW)).toBeNull();
  });

  it("yields to another lifecycle email sent within 48h", () => {
    expect(composePullback(row({ lifecycleLastEmailAt: hoursAgo(47) }), APP, NOW)).toBeNull();
  });

  it("sends once the 48h collision window has cleared", () => {
    expect(composePullback(row({ lifecycleLastEmailAt: hoursAgo(49) }), APP, NOW)).not.toBeNull();
  });

  it("names at most three people even when more are available", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      name: `Person ${i}`,
      title: "CEO",
      company: "Co",
    }));
    const msg = composePullback(row({ previews: many }), APP, NOW);
    expect(msg!.lines.join(" ")).toContain("Person 0");
    expect(msg!.lines.join(" ")).not.toContain("Person 3");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/jobs test -- pullback.test.ts`
Expected: FAIL — `Failed to resolve import "./pullback"`.

- [ ] **Step 3: Write the implementation**

Create `packages/jobs/src/pipeline/pullback.ts`:

```ts
/**
 * Pull-back email (spec 2026-07-18): tell a stalled user about the leads or drafts already
 * waiting for them, by name. Pure core with injected deps (rule 13) — `null` means "do not
 * send", mirroring composeWeeklySummary, so every skip reason is unit-testable without a mailer.
 *
 * Compose owns: opted out, no recipients, nothing waiting, nobody nameable, artifact too young,
 * and the 48h collision guard. The store owns ledger dedupe + the never-returned predicate.
 */

export type PullbackSegment = "drafts_waiting" | "leads_waiting";

export interface PullbackPreview {
  name: string;
  title: string | null;
  company: string | null;
}

export interface PullbackRow {
  accountId: string;
  userId: string;
  emails: string[];
  segment: PullbackSegment;
  touchNumber: 1 | 2;
  /** pending_review drafts (drafts_waiting) or sourced leads (leads_waiting) */
  itemCount: number;
  previews: PullbackPreview[];
  /** one real draft opener, drafts_waiting only */
  draftExcerpt: string | null;
  oldestArtifactAt: string;
  lifecycleEmailsEnabled: boolean;
  lifecycleLastEmailAt: string | null;
}

export interface PullbackMessage {
  to: string;
  /** Signed into the unsubscribe token — the opt-out identifies the USER, not the address. */
  userId: string;
  subject: string;
  segment: PullbackSegment;
  touchNumber: 1 | 2;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
}

/** Pull-back always yields — trial-ending is time-critical, weekly-summary is scheduled. */
export const COLLISION_WINDOW_MS = 48 * 60 * 60 * 1000;
/** LinkedIn drafts reference recent activity and go stale; 24h is the honest floor. */
export const MIN_ARTIFACT_AGE_MS = 24 * 60 * 60 * 1000;

const MAX_NAMED = 3;

function describe(p: PullbackPreview): string {
  const tail = [p.title, p.company].filter(Boolean).join(" at ");
  return tail ? `${p.name} — ${tail}` : p.name;
}

export function composePullback(
  row: PullbackRow,
  appUrl: string,
  now: Date
): Omit<PullbackMessage, "to" | "userId"> | null {
  if (!row.lifecycleEmailsEnabled) return null;
  if (row.emails.length === 0) return null;
  if (row.itemCount <= 0) return null;
  // Never send a hollow email — the entire premise is that real value already exists.
  if (row.previews.length === 0) return null;

  const age = now.getTime() - new Date(row.oldestArtifactAt).getTime();
  if (age < MIN_ARTIFACT_AGE_MS) return null;

  if (row.lifecycleLastEmailAt) {
    const since = now.getTime() - new Date(row.lifecycleLastEmailAt).getTime();
    if (since < COLLISION_WINDOW_MS) return null;
  }

  const named = row.previews.slice(0, MAX_NAMED).map(describe);
  const n = row.itemCount;

  if (row.segment === "drafts_waiting") {
    const subject = n === 1 ? "Vera wrote 1 message for you" : `Vera wrote ${n} messages for you`;
    const lines = [
      n === 1
        ? "There's a message written and waiting for your approval. Nothing sends until you say so."
        : `There are ${n} messages written and waiting for your approval. Nothing sends until you say so.`,
      `They're addressed to people like ${named.join(", ")}.`,
    ];
    if (row.draftExcerpt) lines.push(`One of them opens: "${row.draftExcerpt.trim()}"`);
    return { subject, segment: row.segment, touchNumber: row.touchNumber, lines, ctaLabel: "Review the messages", ctaUrl: `${appUrl}/inbox` };
  }

  const subject = n === 1 ? "1 buyer matched your ICP" : `${n} buyers matched your ICP`;
  const lines = [
    n === 1
      ? "Vera found and qualified a buyer that matches the ICP you set."
      : `Vera found and qualified ${n} buyers that match the ICP you set.`,
    `Among them: ${named.join(", ")}.`,
  ];
  return { subject, segment: row.segment, touchNumber: row.touchNumber, lines, ctaLabel: "See your leads", ctaUrl: `${appUrl}/leads` };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vantera/jobs test -- pullback.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/pullback.ts packages/jobs/src/pipeline/pullback.test.ts
git commit -m "feat(jobs): composePullback pure core — real names or no email"
```

---

### Task 3: `runPullback` orchestrator

**Files:**
- Modify: `packages/jobs/src/pipeline/pullback.ts`
- Test: `packages/jobs/src/pipeline/pullback.test.ts`

**Interfaces:**
- Consumes: `composePullback`, `PullbackRow` (Task 2).
- Produces: `PullbackDeps`, `PullbackSummary`, `runPullback(deps): Promise<PullbackSummary>`.

- [ ] **Step 1: Write the failing test**

Append to `packages/jobs/src/pipeline/pullback.test.ts`:

```ts
import { runPullback, type PullbackDeps } from "./pullback";

function deps(rows: PullbackRow[], over: Partial<PullbackDeps> = {}): PullbackDeps {
  return {
    store: {
      getPullbackCandidates: async () => rows,
      recordTouch: async () => {},
      stampLifecycleEmail: async () => {},
    },
    send: async () => {},
    appUrl: APP,
    now: () => NOW,
    ...over,
  };
}

describe("runPullback", () => {
  it("sends to every recipient and records one ledger row", async () => {
    const sent: string[] = [];
    const touches: Array<{ segment: string; touchNumber: number }> = [];
    const d = deps([row({ emails: ["a@x.com", "b@x.com"] })], {
      send: async (m) => { sent.push(m.to); },
    });
    d.store.recordTouch = async (t) => { touches.push({ segment: t.segment, touchNumber: t.touchNumber }); };

    const summary = await runPullback(d);

    expect(sent).toEqual(["a@x.com", "b@x.com"]);
    expect(touches).toEqual([{ segment: "drafts_waiting", touchNumber: 1 }]);
    expect(summary).toEqual({ status: "completed", touched: 1, emailsSent: 2 });
  });

  it("writes NO ledger row when compose declines, so the touch retries later", async () => {
    let recorded = 0;
    const d = deps([row({ lifecycleLastEmailAt: hoursAgo(1) })]);
    d.store.recordTouch = async () => { recorded += 1; };

    const summary = await runPullback(d);

    expect(recorded).toBe(0);
    expect(summary.emailsSent).toBe(0);
  });

  it("stamps lifecycle_last_email_at so the next lifecycle email yields to this one", async () => {
    const stamped: string[] = [];
    const d = deps([row()]);
    d.store.stampLifecycleEmail = async (id) => { stamped.push(id); };

    await runPullback(d);

    expect(stamped).toEqual(["acc-1"]);
  });

  it("one failing recipient never blocks the rest of the batch", async () => {
    let call = 0;
    const d = deps(
      [row({ accountId: "acc-1" }), row({ accountId: "acc-2", userId: "user-2" })],
      {
        send: async () => {
          call += 1;
          if (call === 1) throw new Error("provider 500");
        },
      }
    );

    const summary = await runPullback(d);

    // acc-1's only recipient threw, so it is neither counted nor ledgered; acc-2 still sends.
    expect(summary.touched).toBe(1);
    expect(summary.emailsSent).toBe(1);
  });

  it("passes userId through so the unsubscribe token identifies the user", async () => {
    const seen: string[] = [];
    const d = deps([row()], { send: async (m) => { seen.push(m.userId); } });

    await runPullback(d);

    expect(seen).toEqual(["user-1"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/jobs test -- pullback.test.ts`
Expected: FAIL — `runPullback` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/jobs/src/pipeline/pullback.ts`:

```ts
export interface PullbackTouch {
  userId: string;
  accountId: string;
  segment: PullbackSegment;
  touchNumber: 1 | 2;
  messageBody: string;
}

export interface PullbackDeps {
  store: {
    /** Candidates already filtered for ledger dedupe + the never-returned predicate. */
    getPullbackCandidates(now: Date): Promise<PullbackRow[]>;
    recordTouch(touch: PullbackTouch): Promise<void>;
    stampLifecycleEmail(accountId: string, at: Date): Promise<void>;
  };
  send(message: PullbackMessage): Promise<void>;
  appUrl: string;
  now?: () => Date;
}

export interface PullbackSummary {
  status: "completed";
  touched: number;
  emailsSent: number;
}

export async function runPullback(deps: PullbackDeps): Promise<PullbackSummary> {
  const now = deps.now ? deps.now() : new Date();
  const rows = await deps.store.getPullbackCandidates(now);

  let emailsSent = 0;
  let touched = 0;

  for (const row of rows) {
    const composed = composePullback(row, deps.appUrl, now);
    // No ledger row on a skip: the touch is retried once the blocking condition clears.
    if (!composed) continue;

    let sent = 0;
    for (const to of row.emails) {
      try {
        await deps.send({ ...composed, to, userId: row.userId });
        sent += 1;
      } catch {
        // best-effort per recipient — one bad address must not block the rest
      }
    }
    if (sent === 0) continue;

    emailsSent += sent;
    touched += 1;
    await deps.store.recordTouch({
      userId: row.userId,
      accountId: row.accountId,
      segment: row.segment,
      touchNumber: row.touchNumber,
      messageBody: composed.lines.join("\n"),
    });
    await deps.store.stampLifecycleEmail(row.accountId, now);
  }

  return { status: "completed", touched, emailsSent };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vantera/jobs test -- pullback.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/pullback.ts packages/jobs/src/pipeline/pullback.test.ts
git commit -m "feat(jobs): runPullback — skips write no ledger row so they retry"
```

---

### Task 4: `createPullbackStore`

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts`

**Interfaces:**
- Consumes: `PullbackRow`, `PullbackTouch` (Tasks 2–3).
- Produces: `createPullbackStore(db)` satisfying `PullbackDeps["store"]`.

> Selection rules that need the DB live here: the ledger dedupe (`channel = 'email'`) and the never-returned predicate `u.last_sign_in_at < <oldest artifact>.created_at`. `drafts_waiting` outranks `leads_waiting` — the leads query excludes any account with pending drafts.

- [ ] **Step 1: Write the implementation**

Append to `packages/jobs/src/pipeline/pg-store.ts`, alongside `createTrialEndingStore`:

```ts
/** Pull-back email: stalled users with real leads or drafts waiting. Spec 2026-07-18. */
export function createPullbackStore(db: Db) {
  async function candidates(now: Date): Promise<PullbackRow[]> {
    const rows = await db.execute<{
      account_id: string;
      user_id: string;
      email: string | null;
      segment: PullbackSegment;
      touch_number: number;
      item_count: number;
      oldest_at: string;
      draft_excerpt: string | null;
      lifecycle_emails_enabled: boolean;
      lifecycle_last_email_at: string | null;
      preview_name: string | null;
      preview_title: string | null;
      preview_company: string | null;
    }>(sql`
      with owner_users as (
        select m.account_id, m.user_id, u.email, u.last_sign_in_at
        from public.account_members m
        join auth.users u on u.id = m.user_id
        where m.role in ('owner','admin')
      ),
      drafts as (
        select s.account_id, count(*)::int as item_count, min(s.created_at) as oldest_at
        from public.scheduled_sends s
        where s.status = 'pending_review'
        group by s.account_id
      ),
      leads_agg as (
        select l.account_id, count(*)::int as item_count, min(l.created_at) as oldest_at
        from public.leads l
        group by l.account_id
      ),
      base as (
        select a.id as account_id, o.user_id, o.email,
               'drafts_waiting'::text as segment,
               d.item_count, d.oldest_at,
               a.lifecycle_emails_enabled, a.lifecycle_last_email_at
        from public.accounts a
        join owner_users o on o.account_id = a.id
        join drafts d on d.account_id = a.id
        where o.last_sign_in_at < d.oldest_at
        union all
        select a.id, o.user_id, o.email,
               'leads_waiting'::text,
               g.item_count, g.oldest_at,
               a.lifecycle_emails_enabled, a.lifecycle_last_email_at
        from public.accounts a
        join owner_users o on o.account_id = a.id
        join leads_agg g on g.account_id = a.id
        where o.last_sign_in_at < g.oldest_at
          and not exists (select 1 from drafts d where d.account_id = a.id)
      )
      select b.*,
             coalesce(t.next_touch, 1) as touch_number,
             (select s.body from public.scheduled_sends s
               where s.account_id = b.account_id and s.status = 'pending_review'
               order by s.created_at asc limit 1) as draft_excerpt,
             p.name as preview_name, p.title as preview_title, p.company as preview_company
      from base b
      left join lateral (
        select case when max(lt.touch_number) = 1 then 2 else null end as next_touch
        from public.lifecycle_touches lt
        where lt.user_id = b.user_id and lt.segment = b.segment and lt.channel = 'email'
          and (lt.touch_number = 2 or lt.sent_at > ${new Date(now.getTime() - 72 * 3_600_000).toISOString()})
      ) t on true
      left join lateral (
        select l.name, l.title, l.company
        from public.leads l
        where l.account_id = b.account_id
        order by l.created_at asc
        limit 3
      ) p on true
      where coalesce(t.next_touch, 1) is not null
    `);

    const byKey = new Map<string, PullbackRow>();
    for (const r of [...rows]) {
      const key = `${r.account_id}:${r.segment}`;
      const cur =
        byKey.get(key) ??
        ({
          accountId: r.account_id,
          userId: r.user_id,
          emails: [],
          segment: r.segment,
          touchNumber: (r.touch_number === 2 ? 2 : 1) as 1 | 2,
          itemCount: r.item_count,
          previews: [],
          draftExcerpt: r.draft_excerpt,
          oldestArtifactAt: r.oldest_at,
          lifecycleEmailsEnabled: r.lifecycle_emails_enabled,
          lifecycleLastEmailAt: r.lifecycle_last_email_at,
        } satisfies PullbackRow);
      if (r.email && !cur.emails.includes(r.email)) cur.emails.push(r.email);
      if (r.preview_name && !cur.previews.some((p) => p.name === r.preview_name)) {
        cur.previews.push({
          name: r.preview_name,
          title: r.preview_title,
          company: r.preview_company,
        });
      }
      byKey.set(key, cur);
    }
    return [...byKey.values()];
  }

  return {
    getPullbackCandidates: candidates,
    async recordTouch(touch: PullbackTouch): Promise<void> {
      await db
        .insert(lifecycleTouches)
        .values({
          userId: touch.userId,
          accountId: touch.accountId,
          segment: touch.segment,
          touchNumber: touch.touchNumber,
          channel: "email",
          status: "sent",
          messageBody: touch.messageBody,
          sentAt: new Date(),
        })
        .onConflictDoNothing();
    },
    async stampLifecycleEmail(accountId: string, at: Date): Promise<void> {
      await db
        .update(accounts)
        .set({ lifecycleLastEmailAt: at })
        .where(eq(accounts.id, accountId));
    },
  };
}
```

Add `PullbackRow`, `PullbackSegment`, `PullbackTouch` to the existing type imports from `./pullback` at the top of `pg-store.ts`, and ensure `lifecycleTouches` and `eq` are imported (both are already used elsewhere in this file — confirm before adding).

- [ ] **Step 2: Verify the draft-excerpt column name**

Run: `grep -n "body\|draft" packages/db/src/schema.ts | grep -i scheduled -A2 -B2`

If `scheduled_sends` stores the draft under a different column than `body` (e.g. `message_body`), update the `draft_excerpt` subquery to match. Do not guess.

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/pipeline/pg-store.ts
git commit -m "feat(jobs): createPullbackStore — drafts outrank leads, ledger dedupe by channel"
```

---

### Task 5: `List-Unsubscribe` support in the send layer

**Files:**
- Modify: `packages/transactional-email/src/types.ts`
- Modify: `packages/transactional-email/src/resend.ts:30-45`
- Test: `packages/transactional-email/src/resend.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TransactionalMessage.headers?: Record<string, string>`, passed to the provider as `headers`.

- [ ] **Step 1: Write the failing test**

Append to `packages/transactional-email/src/resend.test.ts` (create it if absent, mirroring the imports of the other tests in this package):

```ts
import { describe, expect, it } from "vitest";
import { ResendTransactionalEmail } from "./resend";

describe("ResendTransactionalEmail headers", () => {
  it("forwards custom headers so List-Unsubscribe reaches the provider", async () => {
    let body: Record<string, unknown> = {};
    const mailer = new ResendTransactionalEmail({
      apiKey: "k",
      from: "noreply@example.com",
      fetchFn: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await mailer.send({
      to: "a@x.com",
      subject: "s",
      html: "<p>h</p>",
      headers: {
        "List-Unsubscribe": "<https://app/api/lifecycle-unsubscribe/tok>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    expect(body.headers).toEqual({
      "List-Unsubscribe": "<https://app/api/lifecycle-unsubscribe/tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("omits headers entirely when none are supplied", async () => {
    let body: Record<string, unknown> = {};
    const mailer = new ResendTransactionalEmail({
      apiKey: "k",
      from: "noreply@example.com",
      fetchFn: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await mailer.send({ to: "a@x.com", subject: "s", html: "<p>h</p>" });

    expect(body).not.toHaveProperty("headers");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/transactional-email test`
Expected: FAIL — `headers` is not a valid property of `TransactionalMessage`.

- [ ] **Step 3: Add the field**

In `packages/transactional-email/src/types.ts`, inside `TransactionalMessage`, after `replyTo`:

```ts
  /**
   * Optional provider headers. Used for List-Unsubscribe on the lifecycle lane, where the
   * recipient is a lapsed user who cannot reasonably be asked to log in to opt out.
   */
  headers?: Record<string, string>;
```

- [ ] **Step 4: Pass it through**

In `packages/transactional-email/src/resend.ts`, after the `replyTo` line in `send`:

```ts
    if (message.headers && Object.keys(message.headers).length > 0) {
      body.headers = message.headers;
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @vantera/transactional-email test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/transactional-email/src/types.ts packages/transactional-email/src/resend.ts packages/transactional-email/src/resend.test.ts
git commit -m "feat(email): optional provider headers — unblocks List-Unsubscribe"
```

---

### Task 6: One-click unsubscribe token + route

**Files:**
- Create: `packages/transactional-email/src/unsubscribe-token.ts`
- Create: `packages/transactional-email/src/unsubscribe-token.test.ts`
- Modify: `packages/transactional-email/src/index.ts`
- Create: `apps/web/src/app/api/lifecycle-unsubscribe/[token]/route.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `signUnsubscribeToken(userId): string`, `verifyUnsubscribeToken(token): string | null` exported from `@vantera/transactional-email`, and a route accepting GET + POST.

> **Amended 2026-07-18 (owner call).** The original plan put this in `apps/web` and duplicated it into `packages/jobs`, because `apps/web` modules are `server-only`. Instead it lives in `packages/transactional-email`, which **both** `apps/web` and `packages/jobs` already depend on — one implementation, no duplication, no drift guardrail. Task 9's duplicate-and-guard steps are deleted.
>
> **Signing key: `LIFECYCLE_UNSUBSCRIBE_SECRET`, a new required env var.** The spec said reuse the existing webhook secret, but that no longer holds once the helper leaves `apps/web`: reading `UNIPILE_WEBHOOK_SECRET` inside the transactional-email package drags a vendor name across a package boundary (rules 03/04/05). Deriving the key from `RESEND_API_KEY` was considered and rejected — rotating that key would silently invalidate every unsubscribe link already sitting in people's inboxes, and an unsubscribe link that stops working is a compliance failure. A dedicated secret is stable across rotations. **Owner step: set it in Vercel and Trigger production.** Verification uses `timingSafeEqual`, matching `packages/linkedin-infra/src/unipile.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/transactional-email/src/unsubscribe-token.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

beforeAll(() => {
  process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = "test-secret";
});

describe("lifecycle unsubscribe tokens", () => {
  it("round-trips a user id", () => {
    const token = signUnsubscribeToken("user-123");
    expect(verifyUnsubscribeToken(token)).toBe("user-123");
  });

  it("rejects a tampered payload", () => {
    const token = signUnsubscribeToken("user-123");
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("user-999").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyUnsubscribeToken("not-a-token")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("produces a URL-safe token", () => {
    expect(signUnsubscribeToken("user-123")).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/transactional-email test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the token module**

Create `packages/transactional-email/src/unsubscribe-token.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-click unsubscribe for the lifecycle lane. A lapsed user cannot be asked to log in to opt
 * out, so the token carries its own proof — HMAC over the user id, no table, no expiry sweep.
 *
 * Lives here rather than in apps/web because packages/jobs signs these links and apps/web
 * verifies them; this package is the only thing both already depend on.
 *
 * Its own secret, deliberately: deriving from RESEND_API_KEY would invalidate every link already
 * sitting in an inbox the moment that key rotates, and a dead unsubscribe link is a compliance
 * failure.
 */
function secret(): string {
  const s = process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("LIFECYCLE_UNSUBSCRIBE_SECRET missing");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(userId).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const userId = Buffer.from(payload, "base64url").toString("utf8");
  return userId || null;
}
```

- [ ] **Step 4: Export it and run the test**

In `packages/transactional-email/src/index.ts`, add:

```ts
export { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";
```

Add `LIFECYCLE_UNSUBSCRIBE_SECRET=` to `.env.example` under the Resend block, with the comment:
`# HMAC key for one-click lifecycle unsubscribe links. Its own secret so key rotation elsewhere never kills a link already in an inbox.`

Run: `pnpm --filter @vantera/transactional-email test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the route**

Create `apps/web/src/app/api/lifecycle-unsubscribe/[token]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@vantera/transactional-email";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * RFC 8058 one-click unsubscribe for lifecycle emails. Must work with no session — the whole
 * point is that a lapsed user can opt out without logging in. POST is what mail clients call;
 * GET is what a human clicking the footer link hits.
 */
async function optOut(token: string): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;

  const svc = createServiceClient();
  const { data: member } = await svc
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle<{ account_id: string }>();
  if (!member) return false;

  const { error } = await svc
    .from("accounts")
    .update({ lifecycle_emails_enabled: false })
    .eq("id", member.account_id);
  return !error;
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await optOut(token);
  return new NextResponse(null, { status: ok ? 200 : 400 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await optOut(token);
  const body = ok
    ? "You're unsubscribed from Vantera lifecycle emails. You can turn them back on in Settings → Notifications."
    : "That unsubscribe link isn't valid. You can change email settings in Settings → Notifications.";
  return new NextResponse(body, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 6: Confirm the route is not gated by auth**

Run: `grep -n "lifecycle-unsubscribe\|api/webhooks\|matcher" apps/web/src/proxy.ts`

If the proxy's matcher protects `/api/*`, add `/api/lifecycle-unsubscribe` to the same exclusion list the webhook routes use. A logged-out request must reach this route.

- [ ] **Step 7: Commit**

```bash
git add packages/transactional-email/src/unsubscribe-token.ts packages/transactional-email/src/unsubscribe-token.test.ts packages/transactional-email/src/index.ts .env.example apps/web/src/app/api/lifecycle-unsubscribe
git commit -m "feat(email): shared unsubscribe-token helper + one-click opt-out route"
```

---

### Task 7: `sendPullbackEmail`

**Files:**
- Modify: `packages/transactional-email/src/lifecycle.ts`
- Modify: `packages/transactional-email/src/index.ts`

**Interfaces:**
- Consumes: `TransactionalMessage.headers` (Task 5).
- Produces: `sendPullbackEmail(opts: PullbackEmailOptions): Promise<void>`, `PullbackEmailOptions`.

> `shell()` is private to `lifecycle.ts` and already renders the "Settings → Notifications" footer. Add the new sender in that same file; do not export `shell`.

- [ ] **Step 1: Write the implementation**

Append to `packages/transactional-email/src/lifecycle.ts`:

```ts
export interface PullbackEmailOptions {
  to: string;
  subject: string;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
  /** RFC 8058 one-click opt-out URL — a lapsed user cannot be asked to log in. */
  unsubscribeUrl: string;
}

/**
 * Pull-back email (spec 2026-07-18): the leads or drafts already waiting, named. Copy is composed
 * upstream by composePullback so every claim is grounded in the user's real data.
 */
export async function sendPullbackEmail(opts: PullbackEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const { html, text } = shell(opts.subject, opts.lines, opts.ctaLabel, opts.ctaUrl);
  await mailer.send({
    to: opts.to,
    subject: opts.subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
```

- [ ] **Step 2: Export it**

In `packages/transactional-email/src/index.ts`, replace the two lifecycle lines with:

```ts
export {
  sendWelcomeEmail,
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendPullbackEmail,
} from "./lifecycle";
export type {
  WelcomeEmailOptions,
  TrialEndingEmailOptions,
  PaymentFailedEmailOptions,
  PullbackEmailOptions,
} from "./lifecycle";
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/transactional-email/src/lifecycle.ts packages/transactional-email/src/index.ts
git commit -m "feat(email): sendPullbackEmail with one-click List-Unsubscribe"
```

---

### Task 8: Stamp `lifecycle_last_email_at` on the other senders

**Files:**
- Modify: `packages/jobs/src/pipeline/trial-ending.ts`
- Modify: `packages/jobs/src/pipeline/weekly-summary.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts`
- Test: `packages/jobs/src/pipeline/trial-ending.test.ts`

**Interfaces:**
- Consumes: `stampLifecycleEmail` (Task 4).
- Produces: `TrialEndingDeps.store.markTrialEndingNotified` now also stamps; `WeeklySummaryDeps` gains a stamp call.

> The collision guard is worthless unless the *other* senders populate the stamp. `markTrialEndingNotified` already runs on exactly the right accounts, so extend it rather than adding a second call site.

- [ ] **Step 1: Write the failing test**

Append to `packages/jobs/src/pipeline/trial-ending.test.ts`:

```ts
it("stamps lifecycle_last_email_at so pull-back yields to this email", async () => {
  const stamped: string[] = [];
  const summary = await runTrialEnding({
    store: {
      getTrialEndingAccounts: async () => [
        { id: "acc-1", trialEndsAt: "2026-07-22T00:00:00Z", emails: ["a@x.com"] },
      ],
      markTrialEndingNotified: async (ids) => { stamped.push(...ids); },
    },
    send: async () => {},
    now: () => new Date("2026-07-20T00:00:00Z"),
  });
  expect(stamped).toEqual(["acc-1"]);
  expect(summary.notified).toBe(1);
});
```

- [ ] **Step 2: Run the test to verify it fails or passes**

Run: `pnpm --filter @vantera/jobs test -- trial-ending.test.ts`
Expected: PASS at the core level (the core already calls `markTrialEndingNotified`). The behavior change is in the store — proceed to Step 3.

- [ ] **Step 3: Extend the store to stamp**

In `packages/jobs/src/pipeline/pg-store.ts`, in `createTrialEndingStore`, change `markTrialEndingNotified`:

```ts
    async markTrialEndingNotified(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const now = new Date();
      await db
        .update(accounts)
        // lifecycle_last_email_at feeds the pull-back collision guard (spec 2026-07-18):
        // pull-back yields to this email for 48h.
        .set({ trialEndingNotifiedAt: now, lifecycleLastEmailAt: now })
        .where(inArray(accounts.id, ids));
    },
```

- [ ] **Step 4: Stamp on the weekly summary**

In `packages/jobs/src/pipeline/weekly-summary.ts`, inside `runWeeklySummary`, immediately after a summary is successfully sent for an account, add:

```ts
      await deps.store.stampLifecycleEmail?.(account.id, new Date());
```

> Use `new Date()` rather than a `now` local — `runWeeklySummary` does not necessarily have one in scope, and this call sits inside the existing per-account try/catch so a stamp failure cannot sink the batch. Confirm it is inside that catch before committing.

And add the optional method to that file's store interface:

```ts
    /** Feeds the pull-back collision guard (spec 2026-07-18). Optional so tests need not stub it. */
    stampLifecycleEmail?(accountId: string, at: Date): Promise<void>;
```

Then wire the real implementation in `createWeeklySummaryStore` in `pg-store.ts`:

```ts
    async stampLifecycleEmail(accountId: string, at: Date): Promise<void> {
      await db.update(accounts).set({ lifecycleLastEmailAt: at }).where(eq(accounts.id, accountId));
    },
```

- [ ] **Step 5: Stamp on welcome**

In `apps/web/src/app/(auth)/actions.ts`, at the `sendWelcomeEmail` call site (~line 133), the account row does not exist yet at signup — **no stamp is written here**. Add a one-line comment so the omission is deliberate:

```ts
    // No lifecycle_last_email_at stamp: the accounts row is created later, in onboarding step 0.
```

- [ ] **Step 6: Run the full jobs suite**

Run: `pnpm --filter @vantera/jobs test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/jobs/src/pipeline apps/web/src/app/\(auth\)/actions.ts
git commit -m "feat(jobs): stamp lifecycle_last_email_at on trial-ending + weekly-summary"
```

---

### Task 9: Trigger task + tick wiring + schedule guardrail

**Files:**
- Create: `packages/jobs/src/trigger/pullback-email.ts`
- Modify: `packages/jobs/src/trigger/agent-scheduler.ts:11-13,30-33`
- Test: `packages/jobs/src/trigger/schedule-quota.test.ts`

**Interfaces:**
- Consumes: `runPullback` (Task 3), `createPullbackStore` (Task 4), `sendPullbackEmail` (Task 7), `signUnsubscribeToken` (Task 6).
- Produces: task id `pullback-email`.

> `signUnsubscribeToken` is imported from `@vantera/transactional-email` (Task 6) — one implementation, shared by `apps/web` and `packages/jobs`. The original duplicate-and-guard steps were deleted when the helper was hoisted; do not recreate a jobs-local copy.

- [ ] **Step 1: Write the trigger task**

Create `packages/jobs/src/trigger/pullback-email.ts`:

```ts
import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { sendPullbackEmail, signUnsubscribeToken } from "@vantera/transactional-email";
import { createPullbackStore } from "../pipeline/pg-store";
import { runPullback } from "../pipeline/pullback";

/**
 * Pull-back email (spec 2026-07-18): the leads or drafts already waiting, named, at most twice.
 *
 * A plain task fired from the agent-scheduler tick, NOT its own cron — the Trigger plan's
 * schedule quota is fully used (10/10; an 11th broke every prod deploy 2026-07-15). Ledger rows
 * in lifecycle_touches make the 15-min tick cadence safe. No-ops silently until RESEND creds
 * exist in this env.
 */
export const pullbackEmail = task({
  id: "pullback-email",
  maxDuration: 300,
  run: async () => {
    const db = createDb();
    const appUrl = process.env.APP_URL ?? "https://www.vanterasystem.dev";
    const summary = await runPullback({
      store: createPullbackStore(db),
      appUrl,
      send: async (message) => {
        await sendPullbackEmail({
          to: message.to,
          subject: message.subject,
          lines: message.lines,
          ctaLabel: message.ctaLabel,
          ctaUrl: message.ctaUrl,
          // Sign the USER id, not the address — Task 6's route resolves a user to an account.
          unsubscribeUrl: `${appUrl}/api/lifecycle-unsubscribe/${signUnsubscribeToken(message.userId)}`,
        });
      },
    });
    logger.info("pullback-email finished", { ...summary });
    return summary;
  },
});
```

- [ ] **Step 2: Wire it into the tick**

In `packages/jobs/src/trigger/agent-scheduler.ts`, add after the `trial-ending` line:

```ts
    await tasks.trigger("pullback-email", {});
```

And update the doc comment (lines 11-13) to read:

```ts
 * Also fires the account-health reconcile, the reply-backlog safeguard, the lifecycle-outreach
 * tick, the trial-ending heads-up, and the pull-back email each run (plain tasks piggybacking
 * this cron: the plan's schedule quota is at 10/10 — an 11th schedule fails every deploy).
```

- [ ] **Step 3: Write the schedule-quota guardrail**

Create `packages/jobs/src/trigger/schedule-quota.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname);

describe("Trigger schedule quota", () => {
  it("never exceeds 10 schedules — an 11th breaks every prod deploy", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const scheduled = files.filter((f) =>
      readFileSync(join(dir, f), "utf8").includes("schedules.task(")
    );
    expect(scheduled.length).toBeLessThanOrEqual(10);
  });

  it("pullback-email is a plain task, not a schedule", () => {
    const src = readFileSync(join(dir, "pullback-email.ts"), "utf8");
    expect(src).toContain("task({");
    expect(src).not.toContain("schedules.task(");
  });

  it("the tick fires pullback-email", () => {
    const src = readFileSync(join(dir, "agent-scheduler.ts"), "utf8");
    expect(src).toContain(`tasks.trigger("pullback-email"`);
  });
});
```

- [ ] **Step 4: Run the full gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/trigger
git commit -m "feat(jobs): pullback-email task on the scheduler tick + schedule-quota guardrail"
```

---

### Task 10: Help article (knowledge-sync, rule 09)

**Files:**
- Create: `packages/help-content/content/emails-pullback.md`
- Test: `packages/help-content/src/articles.test.ts` (existing — must stay green)

**Interfaces:**
- Consumes: nothing.
- Produces: a help article registered by the existing content loader.

- [ ] **Step 1: Write the article**

Create `packages/help-content/content/emails-pullback.md`. Match the frontmatter shape of a neighbouring file — run `head -8 packages/help-content/content/agents-scout.md` first and mirror its keys exactly.

```markdown
---
title: Emails about leads and messages waiting for you
surface: settings
routes: ["/settings", "/inbox", "/leads"]
---

# When Vantera emails you about waiting work

If Vera sources buyers or writes messages for you and you don't come back to look,
you'll get an email naming what's waiting.

## When it sends

- About a day after messages are drafted and still waiting for your approval, or after
  leads are sourced and haven't been opened.
- A second time about three days later, if the work is still sitting there.
- Never more than twice for the same batch.

## What it contains

Real names from your own account — the buyers Vera matched, or the people your drafted
messages are addressed to. If there's nothing real to show you, no email is sent.

## Turning it off

Settings → Notifications turns lifecycle emails off, and every one of these emails
carries a one-click unsubscribe link that works without signing in.

## What it never does

It never sends outreach on your behalf. Messages only go out after you approve them.
```

- [ ] **Step 2: Run the content tests**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS — including the no-vendor-names assertion.

- [ ] **Step 3: Full gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add packages/help-content/content/emails-pullback.md
git commit -m "docs(help): pull-back email article (knowledge-sync)"
```

---

## Post-implementation verification

Before merging, confirm on a real account rather than trusting the suite:

- [ ] Apply `0060` to the dev database and re-run `pnpm --filter @vantera/db test`.
- [ ] With `RESEND_*` set locally, trigger `pullback-email` once against dev data and confirm the email names real leads and the `List-Unsubscribe` header is present in the raw source.
- [ ] Click the unsubscribe link while logged out; confirm `lifecycle_emails_enabled` flips to `false` and a second run sends nothing.
- [ ] Confirm the Trigger prod deploy succeeds — this is the check that the schedule count is still 10.
- [ ] Verify against production data that Taoufyq (`27d2f692`) selects into `drafts_waiting` with 20 as the count, and that AK (`13dd4afc`) selects into `leads_waiting` with 22.

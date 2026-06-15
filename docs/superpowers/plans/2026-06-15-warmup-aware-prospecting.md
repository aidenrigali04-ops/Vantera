# Warmup-aware Prospecting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couple Scout discovery to real outreach capacity so leads aren't pulled, enriched, and drafted faster than they can be reached during email warmup — protecting lead freshness, enrichment spend, and the new-user activation experience.

**Architecture:** A pure capacity function (`computeRunTarget`) driven by the existing `safety-limits` ceilings + live warmup state caps the Scout's per-run pull below the configured max. A pure freshness check (`needsRefresh`) re-ranks an aged lead before its delayed email touch. A white-labeled `getWarmupStatus` DTO powers a plain activation-hub card. No new tables, no new cron, no control-flow inversion.

**Tech Stack:** TypeScript (strict), Drizzle ORM, Vitest, Trigger.dev v4 (pipeline cores stay pure — deps injected), Next.js 16 (App Router) for the UX surface.

**Spec:** `docs/superpowers/specs/2026-06-15-warmup-aware-prospecting-design.md`

**Conventions to follow:**
- Pipeline cores are pure; drizzle lives only in `pg-store.ts`; tests use the in-memory fakes (rule 13).
- Run tests for the jobs package with `pnpm --filter @vantera/jobs test <file>`; web with `pnpm --filter web test <file>`.
- Commit after each green task. On a feature branch already (`phase-landing-hero`); do not switch branches.

---

## Phase 1 — Capacity throttle in the Scout

### File structure (Phase 1)
- Create `packages/jobs/src/pipeline/capacity.ts` — `OutreachCapacity` type + pure `dailyOutreachCapacity` + `computeRunTarget` + `CAPACITY_DEFAULTS`.
- Create `packages/jobs/src/pipeline/capacity.test.ts` — unit tests.
- Modify `packages/jobs/src/pipeline/types.ts` — extend `ScoutConfig`, `ScoutContext.agent` (add `cadence`), `ScoutStore` (add `getOutreachCapacity`, `countUncontactedLeads`).
- Modify `packages/jobs/src/pipeline/scout.ts` — compute and use `runTarget`.
- Modify `packages/jobs/src/pipeline/scout.test.ts` — extend `FakeScoutStore`; add a warmup-throttle test.
- Modify `packages/jobs/src/pipeline/pg-store.ts` — implement the two new store methods + add `cadence` to `getScoutContext`.

---

### Task 1: Pure capacity functions

**Files:**
- Create: `packages/jobs/src/pipeline/capacity.ts`
- Test: `packages/jobs/src/pipeline/capacity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/jobs/src/pipeline/capacity.test.ts
import { describe, expect, it } from "vitest";
import {
  CAPACITY_DEFAULTS,
  computeRunTarget,
  dailyOutreachCapacity,
  type OutreachCapacity,
} from "./capacity";

const base: OutreachCapacity = {
  linkedinConnected: false,
  linkedinAccountAgeDays: null,
  linkedinEnabled: false,
  emailEnabled: false,
  mailboxes: [],
};

const opts = {
  cadenceDays: 1,
  currentBacklog: 0,
  bufferFactor: CAPACITY_DEFAULTS.bufferFactor, // 1.3
  floor: CAPACITY_DEFAULTS.floor,               // 5
  ceiling: 25,
};

describe("dailyOutreachCapacity", () => {
  it("sums LinkedIn ramp + per-mailbox caps when channels enabled", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // ramp step → 5/day
      emailEnabled: true,
      mailboxes: [
        { phase: "warming", dailyCap: 8 },
        { phase: "ready", dailyCap: 0 }, // ready ignores cap → 30
      ],
    };
    expect(dailyOutreachCapacity(cap)).toBe(5 + 8 + 30);
  });

  it("ignores a channel that is disabled even if infra exists", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: false, // disabled → contributes 0
      linkedinAccountAgeDays: 100,
      emailEnabled: false,
      mailboxes: [{ phase: "ready", dailyCap: 0 }],
    };
    expect(dailyOutreachCapacity(cap)).toBe(0);
  });
});

describe("computeRunTarget", () => {
  it("LinkedIn-only during warmup → small fresh trickle", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // 5/day
    };
    // round(5 * 1 * 1.3) = 7, > floor 5
    expect(computeRunTarget(cap, opts)).toBe(7);
  });

  it("all ready → clamps to the ceiling", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 100, // steady 20
      emailEnabled: true,
      mailboxes: [{ phase: "ready", dailyCap: 0 }, { phase: "ready", dailyCap: 0 }], // 60
    };
    expect(computeRunTarget(cap, opts)).toBe(25);
  });

  it("backlog covering projected capacity → 0 (don't pile on)", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // projected 7
    };
    expect(computeRunTarget(cap, { ...opts, currentBacklog: 10 })).toBe(0);
  });

  it("dead-zone (no channel can act) → 0", () => {
    expect(computeRunTarget(base, opts)).toBe(0);
  });

  it("tiny capacity still pulls the floor batch", () => {
    const cap: OutreachCapacity = {
      ...base,
      emailEnabled: true,
      mailboxes: [{ phase: "warming", dailyCap: 2 }], // projected round(2.6)=3
    };
    expect(computeRunTarget(cap, opts)).toBe(5); // raised to floor
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/jobs test capacity.test.ts`
Expected: FAIL — cannot find module `./capacity`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/jobs/src/pipeline/capacity.ts
import { dailyAllowance, EMAIL_STEADY_DAILY_PER_MAILBOX } from "./safety-limits";

export interface MailboxCapacity {
  /** "warming" carries the provider's current warmup cap; "ready" sends at the steady ceiling */
  phase: "warming" | "ready";
  dailyCap: number;
}

export interface OutreachCapacity {
  linkedinConnected: boolean;
  linkedinAccountAgeDays: number | null;
  linkedinEnabled: boolean;
  emailEnabled: boolean;
  mailboxes: MailboxCapacity[];
}

export interface RunTargetOpts {
  cadenceDays: number;    // 1 (daily) or 7 (weekly)
  currentBacklog: number; // in-flight leads not yet contacted
  bufferFactor: number;   // headroom so the sequence never starves
  floor: number;          // minimum batch when any capacity exists
  ceiling: number;        // config.prospectsPerRun — throttle only reduces below this
}

export const CAPACITY_DEFAULTS = { bufferFactor: 1.3, floor: 5 } as const;

/** Total leads that can actually be reached per day across enabled, ready/warming channels. */
export function dailyOutreachCapacity(c: OutreachCapacity): number {
  const linkedinDaily =
    c.linkedinEnabled && c.linkedinConnected && c.linkedinAccountAgeDays !== null
      ? dailyAllowance("linkedin", c.linkedinAccountAgeDays)
      : 0;
  const emailDaily = c.emailEnabled
    ? c.mailboxes.reduce(
        (sum, m) =>
          sum + (m.phase === "ready" ? EMAIL_STEADY_DAILY_PER_MAILBOX : Math.max(0, m.dailyCap)),
        0,
      )
    : 0;
  return linkedinDaily + emailDaily;
}

/** How many fresh leads to pull this run. Never exceeds the ceiling; 0 in a dead-zone or full backlog. */
export function computeRunTarget(c: OutreachCapacity, o: RunTargetOpts): number {
  const daily = dailyOutreachCapacity(c);
  if (daily <= 0) return 0; // no channel can act — don't enrich unreachable leads
  const projected = Math.round(daily * o.cadenceDays * o.bufferFactor);
  const raw = projected - o.currentBacklog;
  if (raw <= 0) return 0; // backlog already covers capacity — don't pile on
  return Math.min(o.ceiling, Math.max(o.floor, raw));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/jobs test capacity.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/capacity.ts packages/jobs/src/pipeline/capacity.test.ts
git commit -m "feat(jobs): pure outreach-capacity + run-target throttle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Extend Scout types (config, context, store)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`

- [ ] **Step 1: Extend `ScoutConfig`, `SCOUT_DEFAULTS`, `ScoutContext.agent`, and `ScoutStore`**

In `types.ts`, replace the `ScoutConfig` block and `ScoutContext` agent field, and add two methods to `ScoutStore`. Import the capacity type at the top of the file (after the existing imports):

```ts
import type { OutreachCapacity } from "./capacity";
```

Replace:

```ts
export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
}

export const SCOUT_DEFAULTS: ScoutConfig = { prospectsPerRun: 25, minScore: 70 };
```

with:

```ts
export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
  /** capacity-throttle tunables (per-agent override via agents.config jsonb) */
  bufferFactor: number;
  floor: number;
}

export const SCOUT_DEFAULTS: ScoutConfig = {
  prospectsPerRun: 25,
  minScore: 70,
  bufferFactor: 1.3,
  floor: 5,
};
```

In `ScoutContext`, change the `agent` field to carry the cadence:

```ts
  agent: {
    id: string;
    accountId: string;
    status: string;
    cadence: "daily" | "weekly" | null;
    config: Partial<ScoutConfig>;
  };
```

In `ScoutStore`, add two methods (after `completeRun`):

```ts
  /** live outreach capacity for the account (warmup state + LinkedIn connection + channel toggles) */
  getOutreachCapacity(accountId: string): Promise<OutreachCapacity>;
  /** in-flight leads not yet contacted (pending_review/approved/scheduled sends, no send recorded) */
  countUncontactedLeads(accountId: string): Promise<number>;
```

- [ ] **Step 2: Verify it type-checks (will fail until consumers are updated)**

Run: `pnpm --filter @vantera/jobs type-check`
Expected: errors in `scout.ts` (cadence/config) and `pg-store.ts` / `scout.test.ts` (missing methods). These are fixed in Tasks 3–5. This step only confirms the type changes compile in isolation by the errors being limited to the known consumers.

- [ ] **Step 3: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): scout types — capacity store methods, cadence, throttle config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire the throttle into `runScout`

**Files:**
- Modify: `packages/jobs/src/pipeline/scout.ts`

- [ ] **Step 1: Add the capacity import**

At the top of `scout.ts`, add to the imports:

```ts
import { computeRunTarget } from "./capacity";
```

- [ ] **Step 2: Compute `runTarget` and use it for discovery volume**

Replace the discovery-volume line (`scout.ts:37`):

```ts
  const perIcp = Math.max(1, Math.floor(config.prospectsPerRun / ctx.icps.length));
```

with a capacity-aware target computed just before the discovery loop:

```ts
  const capacity = await deps.store.getOutreachCapacity(accountId);
  const runTarget = computeRunTarget(capacity, {
    cadenceDays: ctx.agent.cadence === "weekly" ? 7 : 1,
    currentBacklog: await deps.store.countUncontactedLeads(accountId),
    bufferFactor: config.bufferFactor,
    floor: config.floor,
    ceiling: config.prospectsPerRun,
  });
  if (runTarget === 0) {
    await deps.store.completeRun(agentId, now());
    return { status: "completed", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
  }
  const perIcp = Math.max(1, Math.floor(runTarget / ctx.icps.length));
```

(`config` already merges `SCOUT_DEFAULTS` with the agent config at the top of `runScout`, so `bufferFactor`/`floor` resolve.)

- [ ] **Step 3: Run the existing scout tests (will fail — fake store lacks new methods)**

Run: `pnpm --filter @vantera/jobs test scout.test.ts`
Expected: FAIL — `deps.store.getOutreachCapacity is not a function`. Fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/pipeline/scout.ts
git commit -m "feat(jobs): scout pulls to outreach capacity, not a flat count

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Update `FakeScoutStore` + add the throttle test

**Files:**
- Modify: `packages/jobs/src/pipeline/scout.test.ts`

- [ ] **Step 1: Extend the fake store with the new methods + a settable capacity/backlog**

In `scout.test.ts`, add fields and methods to `FakeScoutStore`. Add these fields near the other fields:

```ts
  capacity: import("./capacity").OutreachCapacity = {
    linkedinConnected: false,
    linkedinAccountAgeDays: null,
    linkedinEnabled: false,
    emailEnabled: true,
    mailboxes: [{ phase: "ready", dailyCap: 0 }, { phase: "ready", dailyCap: 0 }], // ample by default
  };
  backlog = 0;
```

Add these methods (after `completeRun`):

```ts
  async getOutreachCapacity() {
    return this.capacity;
  }
  async countUncontactedLeads() {
    return this.backlog;
  }
```

Also update the `getScoutContext` fixture's `agent` object used in the tests to include `cadence: "daily"` (search for where the `ScoutContext` is built in this file and add the field).

- [ ] **Step 2: Add the warmup-throttle test**

```ts
describe("runScout — capacity throttle", () => {
  it("pulls a small trickle during warmup and bounds enrichment spend", async () => {
    const store = new FakeScoutStore(/* existing context fixture with 1 ICP */ makeContext());
    store.capacity = {
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // 5/day → projected round(5*1*1.3)=7
      emailEnabled: true,
      mailboxes: [{ phase: "warming", dailyCap: 0 }], // email adds nothing yet
    };
    const deps = makeDeps(store); // existing helper; prospectData returns >25 candidates
    const summary = await runScout("agent_1", deps);

    expect(summary.discovered).toBeLessThanOrEqual(7);
    expect(store.enriched.length).toBeLessThanOrEqual(7); // spend bounded by the pull
  });

  it("skips discovery entirely in a dead-zone", async () => {
    const store = new FakeScoutStore(makeContext());
    store.capacity = {
      linkedinConnected: false,
      linkedinEnabled: false,
      linkedinAccountAgeDays: null,
      emailEnabled: true,
      mailboxes: [{ phase: "warming", dailyCap: 0 }],
    };
    const summary = await runScout("agent_1", makeDeps(store));
    expect(summary).toMatchObject({ status: "completed", discovered: 0 });
    expect(store.enriched.length).toBe(0);
  });
});
```

If `makeContext()`/`makeDeps()` helpers don't already exist in the file, factor the existing inline fixture setup from the first test in the file into these two helpers (DRY) and reuse them. Ensure `makeContext()` sets `agent.cadence: "daily"`.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @vantera/jobs test scout.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/pipeline/scout.test.ts
git commit -m "test(jobs): scout capacity throttle — warmup trickle + dead-zone skip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Implement the store methods in `pg-store.ts`

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts`

- [ ] **Step 1: Add `cadence` to `getScoutContext`'s agent select**

Find the `getScoutContext` query's agent select and add `cadence: agents.cadence` to the selected columns and the returned `agent` object.

- [ ] **Step 2: Implement `getOutreachCapacity`**

Add this method to the store object. Imports needed at top: `mailboxes`, `linkedinAccounts`, `agents` from `@vantera/db` schema, and `and`, `eq`, `inArray` from `drizzle-orm` (most already imported — add what's missing).

```ts
  async getOutreachCapacity(accountId: string) {
    // mailbox warmup state: only warming/active mailboxes count
    const mbx = await db
      .select({ status: mailboxes.status, dailyCap: mailboxes.dailySendLimit })
      .from(mailboxes)
      .where(and(eq(mailboxes.accountId, accountId), inArray(mailboxes.status, ["warming", "active"])));

    // LinkedIn: connected = an active account; age from connectedAt
    const [li] = await db
      .select({ connectedAt: linkedinAccounts.connectedAt })
      .from(linkedinAccounts)
      .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
      .orderBy(linkedinAccounts.connectedAt)
      .limit(1);

    // channel toggles from the live Outreach (copy) agent's config.channels
    const [copy] = await db
      .select({ config: agents.config })
      .from(agents)
      .where(and(eq(agents.accountId, accountId), eq(agents.kind, "copy"), eq(agents.status, "live")))
      .limit(1);
    const channels = (copy?.config as { channels?: { email?: boolean; linkedin?: boolean } } | null)
      ?.channels;

    const now = Date.now();
    return {
      linkedinConnected: Boolean(li),
      linkedinAccountAgeDays: li?.connectedAt
        ? Math.floor((now - li.connectedAt.getTime()) / 86_400_000)
        : null,
      linkedinEnabled: channels?.linkedin ?? Boolean(li),
      emailEnabled: channels?.email ?? mbx.length > 0,
      mailboxes: mbx.map((m) => ({
        phase: m.status === "active" ? ("ready" as const) : ("warming" as const),
        dailyCap: m.dailyCap ?? 0,
      })),
    };
  },
```

- [ ] **Step 3: Implement `countUncontactedLeads`**

Counts distinct leads with an in-flight draft (`pending_review`/`approved`/`scheduled`) that has no recorded send yet.

```ts
  async countUncontactedLeads(accountId: string) {
    const rows = await db
      .selectDistinct({ leadId: scheduledSends.leadId })
      .from(scheduledSends)
      .where(
        and(
          eq(scheduledSends.accountId, accountId),
          inArray(scheduledSends.status, ["pending_review", "approved", "scheduled"]),
        ),
      );
    return rows.length;
  },
```

(Confirm the `scheduledSends.status` enum values against `schema.ts` — use the exact strings present there.)

- [ ] **Step 4: Type-check the jobs package**

Run: `pnpm --filter @vantera/jobs type-check`
Expected: PASS (no errors).

- [ ] **Step 5: Run the full jobs test suite**

Run: `pnpm --filter @vantera/jobs test`
Expected: PASS (all suites, including the new capacity + scout throttle tests).

- [ ] **Step 6: Commit**

```bash
git add packages/jobs/src/pipeline/pg-store.ts
git commit -m "feat(jobs): pg-store getOutreachCapacity + countUncontactedLeads + cadence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Refresh-on-release

### File structure (Phase 2)
- Create `packages/jobs/src/pipeline/freshness.ts` — pure `needsRefresh` + `FRESHNESS_WINDOW_DAYS`.
- Create `packages/jobs/src/pipeline/freshness.test.ts`.
- Modify `packages/jobs/src/pipeline/types.ts` — extend `SequenceTouchDeps` (a `refreshLead` dep) and the draftable-lead shape (`scoredAt`).
- Modify `packages/jobs/src/pipeline/sequence-touch.ts` — refresh hook on the email stage.
- Modify `packages/jobs/src/pipeline/sequence-touch.test.ts` — refresh tests.
- Modify `packages/jobs/src/pipeline/pg-store.ts` — `refreshLead` store wiring (re-enrich + re-rank one lead, exit-sequence on sub-min).

---

### Task 6: Pure freshness check

**Files:**
- Create: `packages/jobs/src/pipeline/freshness.ts`
- Test: `packages/jobs/src/pipeline/freshness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/jobs/src/pipeline/freshness.test.ts
import { describe, expect, it } from "vitest";
import { FRESHNESS_WINDOW_DAYS, needsRefresh } from "./freshness";

const now = new Date("2026-06-15T00:00:00Z");

describe("needsRefresh", () => {
  it("fresh lead inside the window → false", () => {
    const scoredAt = new Date("2026-06-10T00:00:00Z"); // 5 days
    expect(needsRefresh(scoredAt, now, FRESHNESS_WINDOW_DAYS)).toBe(false);
  });
  it("aged lead past the window → true", () => {
    const scoredAt = new Date("2026-05-30T00:00:00Z"); // 16 days
    expect(needsRefresh(scoredAt, now, FRESHNESS_WINDOW_DAYS)).toBe(true);
  });
  it("never-scored lead (null) → true (treat as stale)", () => {
    expect(needsRefresh(null, now, FRESHNESS_WINDOW_DAYS)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/jobs test freshness.test.ts`
Expected: FAIL — cannot find module `./freshness`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/jobs/src/pipeline/freshness.ts

/** Days a lead's AI score/insights stay "fresh" before a delayed email touch re-ranks it. */
export const FRESHNESS_WINDOW_DAYS = 12;

/** True when a lead must be re-ranked before sending (aged past the window, or never scored). */
export function needsRefresh(scoredAt: Date | null, now: Date, windowDays: number): boolean {
  if (!scoredAt) return true;
  const ageDays = (now.getTime() - scoredAt.getTime()) / 86_400_000;
  return ageDays > windowDays;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/jobs test freshness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/freshness.ts packages/jobs/src/pipeline/freshness.test.ts
git commit -m "feat(jobs): pure needsRefresh freshness check

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Add the refresh dependency + draftable-lead `scoredAt`

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`

- [ ] **Step 1: Extend the draftable-lead shape and `SequenceTouchDeps`**

Find the type returned by `store.getDraftableLead` (used in `sequence-touch.ts`) and add `scoredAt: Date | null` to it. Then add a `refreshLead` dependency to `SequenceTouchDeps`:

```ts
  /**
   * Re-enrich + re-rank one aged lead before an email touch. Returns the post-refresh
   * outcome: "ok" (still qualified, draft with current insights) or "dropped" (fell below
   * min_score → caller exits the sequence; not suppression).
   */
  refreshLead(accountId: string, leadId: string): Promise<"ok" | "dropped">;
```

Also add `minScore: number` to the `SequenceTouchDispatch` (or confirm the campaign/agent min-score is already reachable in `runSequenceTouch`; if not, thread it through the dispatch). The `refreshLead` impl owns the min-score comparison, so `runSequenceTouch` only needs the `"ok"|"dropped"` result.

- [ ] **Step 2: Type-check (errors limited to sequence-touch + pg-store + tests)**

Run: `pnpm --filter @vantera/jobs type-check`
Expected: errors only in `sequence-touch.ts`, `pg-store.ts`, `sequence-touch.test.ts` — fixed in Tasks 8–9.

- [ ] **Step 3: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): sequence-touch refreshLead dep + draftable-lead scoredAt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Hook refresh-on-release into `runSequenceTouch`

**Files:**
- Modify: `packages/jobs/src/pipeline/sequence-touch.ts`
- Modify: `packages/jobs/src/pipeline/sequence-touch.test.ts`

- [ ] **Step 1: Add the refresh branch (email stage only), after the suppression check**

In `runSequenceTouch`, the suppression check stays first (rule 11 — unchanged). After it passes and before drafting, for the email stage re-rank an aged lead:

```ts
  import { needsRefresh, FRESHNESS_WINDOW_DAYS } from "./freshness";
  // ... inside runSequenceTouch, after the isSuppressed early-return:
  if (d.stage === "email" && needsRefresh(lead.scoredAt, deps.now(), FRESHNESS_WINDOW_DAYS)) {
    const result = await deps.refreshLead(d.accountId, d.leadId);
    if (result === "dropped") return "dropped"; // lead exits the sequence; no send
  }
```

Add `"dropped"` to the `SequenceTouchOutcome` union in `types.ts` if not present, and ensure the orchestrator treats `"dropped"` as a terminal stop for that lead (archive the sequence run — mirror how `"suppressed"` is handled in `sequence-orchestrate.ts`, but without writing to suppression). Confirm `deps.now` exists on `SequenceTouchDeps`; if the file uses a different clock, match it.

- [ ] **Step 2: Add tests**

```ts
describe("runSequenceTouch — refresh on release", () => {
  it("re-ranks an aged lead before the email touch, then drafts", async () => {
    const deps = makeTouchDeps({ leadScoredAt: new Date("2026-05-01T00:00:00Z"), refresh: "ok" });
    const outcome = await runSequenceTouch({ ...emailDispatch }, deps);
    expect(deps.refreshed).toContain("lead_1"); // refreshLead was called
    expect(outcome).toBe("scheduled"); // or the file's success outcome for a drafted email
  });

  it("drops a lead that falls below min_score on refresh — no send, not suppressed", async () => {
    const deps = makeTouchDeps({ leadScoredAt: new Date("2026-05-01T00:00:00Z"), refresh: "dropped" });
    const outcome = await runSequenceTouch({ ...emailDispatch }, deps);
    expect(outcome).toBe("dropped");
    expect(deps.inserted.length).toBe(0); // nothing drafted/scheduled
    expect(deps.suppressedWrites.length).toBe(0); // never written to suppression
  });

  it("does NOT refresh a fresh lead", async () => {
    const deps = makeTouchDeps({ leadScoredAt: new Date("2026-06-13T00:00:00Z"), refresh: "ok" });
    await runSequenceTouch({ ...emailDispatch }, deps);
    expect(deps.refreshed).toHaveLength(0);
  });

  it("never refreshes a non-email stage", async () => {
    const deps = makeTouchDeps({ leadScoredAt: new Date("2026-05-01T00:00:00Z"), refresh: "ok" });
    await runSequenceTouch({ ...linkedinDispatch }, deps);
    expect(deps.refreshed).toHaveLength(0);
  });
});
```

Extend the existing fake `SequenceTouchDeps` in this test file with: a `refreshLead` returning the configured `"ok"|"dropped"` and recording `refreshed` leadIds; `now()` returning `new Date("2026-06-15T00:00:00Z")`; `getDraftableLead` returning the configured `leadScoredAt`. Reuse the file's existing dispatch/lead fixtures where possible.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @vantera/jobs test sequence-touch.test.ts`
Expected: PASS (existing + 4 new). Confirm the **existing suppression test still passes** (rule 11).

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/pipeline/sequence-touch.ts packages/jobs/src/pipeline/sequence-touch.test.ts packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): refresh-on-release — re-rank aged leads before the email touch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Implement `refreshLead` in `pg-store.ts` + wire the trigger task

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts`
- Modify: the sequence-touch trigger wrapper `packages/jobs/src/trigger/sequence-touch.ts`

- [ ] **Step 1: Implement `refreshLead`**

Re-enrich one lead via the prospect-data source, re-rank via the AI rank function, persist the new score/insights/`scored_at` (reuse `saveEnrichment` + `saveScore`), and return `"ok"`/`"dropped"` by comparing the new score to the agent's `min_score`. Reuse the same `prospectData.enrichProspects` + `rankFn` the Scout uses (inject them into the store factory the way `scout` deps are wired). Keep the drizzle work here; the score comparison is the only branch:

```ts
  async refreshLead(accountId: string, leadId: string) {
    const lead = await loadLeadForRefresh(accountId, leadId); // externalRef, icp criteria, min_score, rank context
    if (!lead) return "ok"; // nothing to refresh; let the normal draft proceed
    const [enriched] = await prospectData.enrichProspects([lead.externalRef]);
    if (enriched) await this.saveEnrichment(leadId, accountId, enriched);
    const [insight] = await rankFn([toRankCandidate(lead, enriched)], lead.rankContext);
    if (!insight) return "ok";
    const qualified = insight.score >= lead.minScore;
    await this.saveScore(leadId, insight, qualified);
    return qualified ? "ok" : "dropped";
  },
```

Add the helper `loadLeadForRefresh` (single-lead read joining lead + its ICP criteria + the scout agent's `min_score`) and `toRankCandidate` (mirror the mapping in `scout.ts:68-77`). DRY: if `toRankCandidate` is reusable, extract it from `scout.ts` into a shared helper rather than duplicating.

- [ ] **Step 2: Wire `refreshLead` into the sequence-touch trigger deps**

In `packages/jobs/src/trigger/sequence-touch.ts`, add `refreshLead` to the deps object passed to `runSequenceTouch` (pointing at the pg-store impl). Confirm the trigger wrapper still only wires deps + logs (rule 13 — `structure.test.ts` enforces thin tasks).

- [ ] **Step 3: Type-check + run the jobs suite**

Run: `pnpm --filter @vantera/jobs type-check && pnpm --filter @vantera/jobs test`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/trigger/sequence-touch.ts packages/jobs/src/pipeline/scout.ts
git commit -m "feat(jobs): refreshLead store impl + sequence-touch wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Activation UX (plain functional; owner restyles later)

> Per owner directive, ship a plain functional surface — no heavy styling. Knowledge-sync (rule 09) and white-label (rules 03–05) still apply: ship the help article and a copilot tool; no vendor names in any DTO/string.

### File structure (Phase 3)
- Create `apps/web/src/lib/warmup-status.ts` — `getWarmupStatus(accountId)` server DTO builder + pure `estimateReadyInDays`.
- Create `apps/web/src/lib/warmup-status.test.ts` — unit test for the pure estimator + DTO shaping.
- Modify the dashboard activation hub component — render the warmup card.
- Create `packages/help-content/content/warmup-status.md` — help article (frontmatter + body).
- Modify the copilot read-tools module — register `getWarmupStatus` (read tier).

---

### Task 10: Warmup status DTO + pure estimator

**Files:**
- Create: `apps/web/src/lib/warmup-status.ts`
- Test: `apps/web/src/lib/warmup-status.test.ts`

- [ ] **Step 1: Write the failing test (pure estimator + shaping)**

```ts
// apps/web/src/lib/warmup-status.test.ts
import { describe, expect, it } from "vitest";
import { estimateReadyInDays, shapeWarmupStatus } from "./warmup-status";

describe("estimateReadyInDays", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("returns remaining days from warmup start over the standard window", () => {
    // started 4 days ago, 21-day target → ~17 left
    expect(estimateReadyInDays(new Date("2026-06-11T00:00:00Z"), now)).toBe(17);
  });
  it("clamps to 0 once the window has elapsed", () => {
    expect(estimateReadyInDays(new Date("2026-05-01T00:00:00Z"), now)).toBe(0);
  });
  it("null start → null (unknown)", () => {
    expect(estimateReadyInDays(null, now)).toBeNull();
  });
});

describe("shapeWarmupStatus", () => {
  it("derives phase, ready counts, and live channels", () => {
    const dto = shapeWarmupStatus({
      mailboxes: [
        { status: "active", warmupStartedAt: null },
        { status: "warming", warmupStartedAt: new Date("2026-06-11T00:00:00Z") },
      ],
      linkedinConnected: true,
      now: new Date("2026-06-15T00:00:00Z"),
    });
    expect(dto.emailPhase).toBe("warming");      // any non-ready mailbox → warming
    expect(dto.mailboxesReady).toBe(1);
    expect(dto.mailboxesTotal).toBe(2);
    expect(dto.linkedinConnected).toBe(true);
    expect(dto.channelsLiveNow).toContain("linkedin");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test warmup-status.test.ts`
Expected: FAIL — cannot find module `./warmup-status`.

- [ ] **Step 3: Implement the pure helpers + the server DTO builder**

```ts
// apps/web/src/lib/warmup-status.ts
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, mailboxes, linkedinAccounts } from "@vantera/db";

/** Standard warmup window used only for the user-facing "~N days" estimate. */
const WARMUP_TARGET_DAYS = 21;

export function estimateReadyInDays(warmupStartedAt: Date | null, now: Date): number | null {
  if (!warmupStartedAt) return null;
  const elapsed = (now.getTime() - warmupStartedAt.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(WARMUP_TARGET_DAYS - elapsed));
}

export interface WarmupStatus {
  emailPhase: "warming" | "ready";
  estReadyInDays: number | null;
  mailboxesReady: number;
  mailboxesTotal: number;
  linkedinConnected: boolean;
  channelsLiveNow: ("linkedin" | "email")[];
}

interface ShapeInput {
  mailboxes: { status: string; warmupStartedAt: Date | null }[];
  linkedinConnected: boolean;
  now: Date;
}

export function shapeWarmupStatus(i: ShapeInput): WarmupStatus {
  const ready = i.mailboxes.filter((m) => m.status === "active");
  const emailPhase = i.mailboxes.length > 0 && ready.length === i.mailboxes.length ? "ready" : "warming";
  const earliestWarming = i.mailboxes
    .filter((m) => m.status === "warming" && m.warmupStartedAt)
    .map((m) => m.warmupStartedAt as Date)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const channelsLiveNow: ("linkedin" | "email")[] = [];
  if (i.linkedinConnected) channelsLiveNow.push("linkedin");
  if (ready.length > 0) channelsLiveNow.push("email");
  return {
    emailPhase,
    estReadyInDays: emailPhase === "ready" ? 0 : estimateReadyInDays(earliestWarming, i.now),
    mailboxesReady: ready.length,
    mailboxesTotal: i.mailboxes.length,
    linkedinConnected: i.linkedinConnected,
    channelsLiveNow,
  };
}

/** RLS-scoped DTO for the dashboard + copilot. accountId comes from the validated session. */
export async function getWarmupStatus(accountId: string): Promise<WarmupStatus> {
  const mbx = await db
    .select({ status: mailboxes.status, warmupStartedAt: mailboxes.warmupStartedAt })
    .from(mailboxes)
    .where(and(eq(mailboxes.accountId, accountId), inArray(mailboxes.status, ["warming", "active"])));
  const [li] = await db
    .select({ id: linkedinAccounts.id })
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
    .limit(1);
  return shapeWarmupStatus({ mailboxes: mbx, linkedinConnected: Boolean(li), now: new Date() });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test warmup-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/warmup-status.ts apps/web/src/lib/warmup-status.test.ts
git commit -m "feat(web): white-labeled warmup-status DTO + ready-in-days estimator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Render the warmup card on the activation hub

**Files:**
- Modify: the dashboard data loader `apps/web/src/app/(app)/dashboard/page.tsx` (fetch `getWarmupStatus`)
- Modify: the activation hub component (added in the `phase-activation-hub` merge — locate the component rendered for new/activating users in `dashboard-view.tsx`)

- [ ] **Step 1: Fetch the status server-side and pass it down**

In `dashboard/page.tsx`, call `getWarmupStatus(accountId)` (accountId from the validated session, same pattern as the other dashboard queries already there) and pass the `WarmupStatus` into `DashboardView` → the activation hub.

- [ ] **Step 2: Render a plain card**

In the activation hub, add a plain functional block (no heavy styling — owner restyles later):

```tsx
{warmup.emailPhase === "warming" && (
  <div className="rounded-lg border border-border p-4 text-sm">
    <p className="font-medium">
      Inboxes warming — email outreach begins in{" "}
      {warmup.estReadyInDays !== null ? `~${warmup.estReadyInDays} days` : "a couple of weeks"}.
    </p>
    <p className="mt-1 text-muted-foreground">
      {warmup.mailboxesReady}/{warmup.mailboxesTotal} inboxes ready.{" "}
      {warmup.linkedinConnected
        ? "Your agent is reaching out on LinkedIn in the meantime and building your pipeline."
        : null}
    </p>
    {!warmup.linkedinConnected && (
      <a href="/settings/channels" className="mt-2 inline-block underline">
        Connect LinkedIn to start reaching out today
      </a>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify it compiles + renders**

Run: `pnpm --filter web type-check`
Expected: PASS. Then load `http://localhost:3008/dashboard` (dev server already running) — for an account with a warming mailbox the card shows; confirm no console errors. (Auth redirect for unauthenticated is expected.)

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(app)/dashboard/page.tsx" "apps/web/src/app/(app)/dashboard/dashboard-view.tsx"
git commit -m "feat(web): warmup expectation-setting card on the activation hub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Help article + copilot tool (knowledge-sync, rule 09)

**Files:**
- Create: `packages/help-content/content/warmup-status.md`
- Modify: the copilot read-tools registry (e.g. `apps/web/src/server/copilot/read-tools.ts`)

- [ ] **Step 1: Write the help article**

Match the frontmatter shape of an existing article in `packages/help-content/content/` (open one to copy the exact `title`/`surface`/`routes` keys). Body explains, in plain white-labeled language: why email sending starts a couple of weeks after signup (inbox warmup protects deliverability), that LinkedIn outreach runs immediately in the meantime, and that the agent paces lead discovery to what can be contacted so leads stay fresh. **No vendor names.**

- [ ] **Step 2: Run the help-content tests**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS — including the no-vendor-names test (`articles.test.ts`).

- [ ] **Step 3: Register a read-tier copilot tool**

In the copilot read-tools module, add a `getWarmupStatus` tool following the existing read-tool pattern (e.g. how `getBillingStatus` / other read tools are defined): typed DTO over the user's own data, `accountId` from the validated session server-side, returns the `WarmupStatus`. Read tier auto-executes (rule 09).

- [ ] **Step 4: Type-check + test web**

Run: `pnpm --filter web type-check && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/help-content/content/warmup-status.md apps/web/src/server/copilot/read-tools.ts
git commit -m "feat(help): warmup-status article + copilot read tool (knowledge-sync)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Full gate green**

```bash
pnpm lint && pnpm type-check && pnpm test
```
Expected: lint 0 errors; type-check clean; all tests pass. (`pnpm build` runs Google-Fonts fetch and may not run offline — run it if network is available.)

- [ ] **Definition-of-done check (rules 11/12/13)**
  - Suppression test still green; the refresh path routes through the existing send-boundary suppression check (no bypass).
  - White-label: `whitelabel-auditor` over the new DTO, card strings, help article, and copilot tool.
  - Knowledge-sync: help article + copilot tool shipped this PR.
  - No new tables/migration (read queries + jsonb config only).

---

## Self-review notes (author)

- **Spec coverage:** §1 capacity model → Tasks 1–5; §2 scout integration → Task 3; §3 enrichment placement → no code (Tier 1 already at pull, bounded by Task 3; Tier 2 deferred, documented in spec); §4 refresh-on-release → Tasks 6–9; §5 activation UX → Tasks 10–12; §6 data/framework → no migration (Task 5/10 read queries, config in jsonb); §7 testing/compliance → tests in every task + Final verification.
- **Verify-before-coding flags for the implementer:** confirm the exact `scheduledSends.status` enum strings (Task 5) and the `getDraftableLead` return type location (Task 7) against current `schema.ts`/`types.ts`; confirm `SequenceTouchDeps.now` clock convention (Task 8); copy real frontmatter keys from an existing help article (Task 12) and the real read-tool registration pattern (Task 12).

# Phase 4 — Leads & Review Queue UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users see what their agents produced (leads table with AI insights) and approve outreach (review queue), plus suppression management UI, the 90-day retention purge job, and channel safety-limit scaffolding.

**Architecture:** Server components with RLS-scoped Supabase selects (accountId never leaves the session, rule 02); server actions following the `agents/actions.ts` pattern; pure validation functions with colocated vitest tests; Trigger.dev work follows rule 13 (pure pipeline core + thin trigger wrapper). One migration (0008) adds `scheduled_sends.style_flags`.

**Tech Stack:** Next.js App Router (read `node_modules/next/dist/docs/` before writing web code — this version has breaking changes), Supabase JS (RLS), Drizzle schema, Trigger.dev v4, vitest, shadcn-style components in `apps/web/src/components/ui/`.

**Session constraints (memory):** stay on local `main` — never create branches; commit only your own files by explicit path; re-read shared files (`package.json`, `.env.example`) before editing. Working spec: `docs/superpowers/specs/2026-06-11-leads-review-queue-design.md`.

---

### Task 1: Migration 0008 — `scheduled_sends.style_flags`

The humanizer flags currently ride the `error` column as `style: …` (`pg-store.ts` says "until a metadata column exists"). Give them a real column. Use the `vantera-db-migrations` skill checklist; have `rls-auditor` review the diff before committing (rule 12) — no new table, so no new policies expected.

**Files:**
- Create: `packages/db/migrations/0008_review_queue.sql`
- Modify: `packages/db/src/schema.ts` (scheduledSends table, after `body`)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`insertScheduledSend`)

- [ ] **Step 1: Write the migration**

```sql
-- Migration #9 (file 0008): review-queue support.
-- scheduled_sends.style_flags: unresolved humanizer violations shown as badges in the
-- review queue (rule 08 — flags surface, never silently shipped). Previously rode the
-- error column as 'style: …'; backfilled below. No new tables — existing RLS covers it.

alter table public.scheduled_sends add column style_flags text;

update public.scheduled_sends
  set style_flags = substring(error from 8), error = null
  where error like 'style: %';
```

- [ ] **Step 2: Add the column to the Drizzle schema**

In `packages/db/src/schema.ts`, `scheduledSends`, after `body: text("body"),`:

```ts
    // unresolved humanizer violations, shown as review-queue badges (0008)
    styleFlags: text("style_flags"),
```

- [ ] **Step 3: Switch pg-store to the real column**

In `packages/jobs/src/pipeline/pg-store.ts`, `insertScheduledSend`, replace:

```ts
        // review-queue style flags ride the error column until a metadata column exists
        error: send.styleFlags ? `style: ${send.styleFlags}` : null,
```

with:

```ts
        styleFlags: send.styleFlags,
```

- [ ] **Step 4: Run the gate for the touched packages**

Run: `pnpm --filter @vantera/db test && pnpm --filter @vantera/jobs test && pnpm type-check`
Expected: PASS (schema guardrail tests scan migrations; no new table so no new RLS demands).

- [ ] **Step 5: rls-auditor pass on the diff**

Dispatch the `rls-auditor` agent on the 0008 + schema.ts diff. Expected: no findings (column-only change). Fix anything it raises.

- [ ] **Step 6: Apply 0008 to the dev Supabase project**

Apply via Supabase MCP `apply_migration` (project `batyjchztbrqzkcvhkmk`, name `0008_review_queue`) with the SQL from Step 1. Memory note: migrations 0000–0007 already applied; prod is deferred.

- [ ] **Step 7: Commit**

```bash
git add packages/db/migrations/0008_review_queue.sql packages/db/src/schema.ts packages/jobs/src/pipeline/pg-store.ts
git commit -m "0008: scheduled_sends.style_flags column, retire the error-column hack"
```

---

### Task 2: Channel safety-limit scaffolding (rule 04)

Pure module + guardrail tests. Ceilings live in Vantera's scheduler, not the provider, and are **non-configurable below safety thresholds**. Wired for real at the Phase 5 send boundary; Phase 4 ships the module the send path must call.

**Files:**
- Create: `packages/jobs/src/pipeline/safety-limits.ts`
- Test: `packages/jobs/src/pipeline/safety-limits.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  LINKEDIN_WEEKLY_INVITE_CEILING,
  LINKEDIN_STEADY_DAILY_INVITES,
  dailyAllowance,
  paceWithJitter,
} from "./safety-limits";

describe("dailyAllowance", () => {
  it("ramps new linkedin accounts well below steady state", () => {
    expect(dailyAllowance("linkedin", 0)).toBeLessThanOrEqual(5);
    expect(dailyAllowance("linkedin", 10)).toBeLessThan(LINKEDIN_STEADY_DAILY_INVITES);
    expect(dailyAllowance("linkedin", 60)).toBe(LINKEDIN_STEADY_DAILY_INVITES);
  });

  it("keeps a steady linkedin week at or under the ~100 invite ceiling", () => {
    expect(LINKEDIN_STEADY_DAILY_INVITES * 5).toBeLessThanOrEqual(LINKEDIN_WEEKLY_INVITE_CEILING);
  });

  it("clamps user-requested volumes to the safety ceiling (non-configurable above)", () => {
    expect(dailyAllowance("linkedin", 60, 500)).toBe(LINKEDIN_STEADY_DAILY_INVITES);
    expect(dailyAllowance("email", 60, 10_000)).toBe(dailyAllowance("email", 60));
  });

  it("lets users request LESS than the ceiling", () => {
    expect(dailyAllowance("linkedin", 60, 3)).toBe(3);
  });

  it("never returns a negative allowance", () => {
    expect(dailyAllowance("linkedin", -5)).toBeGreaterThanOrEqual(0);
    expect(dailyAllowance("email", 60, -10)).toBe(0);
  });
});

describe("paceWithJitter", () => {
  it("is deterministic for a given seed", () => {
    expect(paceWithJitter(60_000, 7)).toBe(paceWithJitter(60_000, 7));
  });

  it("stays within ±30% of the base interval and is never negative", () => {
    for (let seed = 0; seed < 50; seed++) {
      const v = paceWithJitter(60_000, seed);
      expect(v).toBeGreaterThanOrEqual(42_000);
      expect(v).toBeLessThanOrEqual(78_000);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/jobs test -- safety-limits`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Channel safety limits (rule 04). These ceilings protect the USER'S OWN accounts
 * from provider restriction — treat them as compliance, not preference. They live
 * here in the scheduler, never in the provider, and callers cannot configure
 * outreach volume above them (requests are clamped). Enforced for real at the
 * Phase 5 send boundary; every send path must call dailyAllowance() first.
 */

export const LINKEDIN_WEEKLY_INVITE_CEILING = 100;
export const LINKEDIN_STEADY_DAILY_INVITES = 20; // ~100/week across weekdays

/** new-account ramp: stay tiny while the account builds history */
const LINKEDIN_RAMP: { maxAgeDays: number; daily: number }[] = [
  { maxAgeDays: 7, daily: 5 },
  { maxAgeDays: 14, daily: 10 },
  { maxAgeDays: 28, daily: 15 },
];

export const EMAIL_STEADY_DAILY_PER_MAILBOX = 30; // warmup-safe; revisited with Phase 5 warmup gating

export type SafetyChannel = "linkedin" | "email";

function channelCeiling(channel: SafetyChannel, accountAgeDays: number): number {
  if (channel === "email") return EMAIL_STEADY_DAILY_PER_MAILBOX;
  const step = LINKEDIN_RAMP.find((s) => accountAgeDays < s.maxAgeDays);
  return step ? step.daily : LINKEDIN_STEADY_DAILY_INVITES;
}

/** Max sends allowed today. `requested` may lower the volume, never raise it. */
export function dailyAllowance(
  channel: SafetyChannel,
  accountAgeDays: number,
  requested?: number
): number {
  const ceiling = channelCeiling(channel, Math.max(0, accountAgeDays));
  if (requested === undefined) return ceiling;
  return Math.max(0, Math.min(requested, ceiling));
}

/** Deterministic ±30% jitter so sends pace like a human, not a metronome. */
export function paceWithJitter(baseMs: number, seed: number): number {
  const x = Math.sin(seed + 1) * 10_000;
  const frac = x - Math.floor(x); // [0, 1)
  return Math.round(baseMs * (0.7 + 0.6 * frac));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/jobs test -- safety-limits`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/safety-limits.ts packages/jobs/src/pipeline/safety-limits.test.ts
git commit -m "Safety-limit scaffolding: rule 04 ceilings, ramp, jittered pacing (Phase 5 wires sends)"
```

---

### Task 3: Retention purge job (90-day window from 0002)

Rule 13 shape: predicate + core are pure and tested; the trigger wrapper is thin (the existing `structure.test.ts` guardrail enforces it imports from `../pipeline/`).

**Files:**
- Create: `packages/jobs/src/pipeline/retention-purge.ts`
- Test: `packages/jobs/src/pipeline/retention-purge.test.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (append store interfaces)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (two methods + return type)
- Create: `packages/jobs/src/trigger/retention-purge.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { isPurgeable, runRetentionPurge, RETENTION_DAYS } from "./retention-purge";
import type { PurgeCandidate, RetentionStore } from "./types";

const base: PurgeCandidate = {
  id: "l1",
  status: "rejected",
  rulesGatePassed: false,
  scoredAt: null,
};

describe("isPurgeable (the 0002 retention note, exactly)", () => {
  it("purges gate-failed leads", () => {
    expect(isPurgeable({ ...base, rulesGatePassed: false })).toBe(true);
  });

  it("purges never-scored leads (gate never ran)", () => {
    expect(isPurgeable({ ...base, status: "sourced", rulesGatePassed: null, scoredAt: null })).toBe(true);
  });

  it("NEVER purges qualified or in-campaign leads, whatever the gate says", () => {
    for (const status of ["qualified", "enriched", "in_campaign", "replied", "converted", "archived"]) {
      expect(isPurgeable({ ...base, status })).toBe(false);
    }
  });

  it("keeps gate-passed leads awaiting scoring", () => {
    expect(isPurgeable({ ...base, status: "sourced", rulesGatePassed: true, scoredAt: null })).toBe(false);
  });
});

describe("runRetentionPurge", () => {
  function fakeStore(candidates: PurgeCandidate[]) {
    const deleted: string[][] = [];
    const store: RetentionStore = {
      async getPurgeCandidates() {
        return candidates;
      },
      async deleteLeads(ids) {
        deleted.push(ids);
        return ids.length;
      },
    };
    return { store, deleted };
  }

  it("asks for candidates older than the 90-day cutoff", async () => {
    let seenCutoff: Date | null = null;
    const now = new Date("2026-06-11T00:00:00Z");
    const store: RetentionStore = {
      async getPurgeCandidates(cutoff) {
        seenCutoff = cutoff;
        return [];
      },
      async deleteLeads() {
        return 0;
      },
    };
    await runRetentionPurge({ store, now: () => now });
    expect(seenCutoff!.getTime()).toBe(now.getTime() - RETENTION_DAYS * 86_400_000);
  });

  it("deletes only purgeable candidates and reports the count", async () => {
    const { store, deleted } = fakeStore([
      { id: "old-rejected", status: "rejected", rulesGatePassed: false, scoredAt: null },
      { id: "old-qualified", status: "qualified", rulesGatePassed: true, scoredAt: new Date() },
      { id: "old-unscored", status: "sourced", rulesGatePassed: null, scoredAt: null },
    ]);
    const summary = await runRetentionPurge({ store });
    expect(deleted.flat()).toEqual(["old-rejected", "old-unscored"]);
    expect(summary).toMatchObject({ status: "completed", purged: 2 });
  });

  it("skips the delete call entirely when nothing qualifies", async () => {
    const { store, deleted } = fakeStore([]);
    const summary = await runRetentionPurge({ store });
    expect(deleted).toEqual([]);
    expect(summary.purged).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/jobs test -- retention-purge`
Expected: FAIL — module not found.

- [ ] **Step 3: Add store types**

Append to `packages/jobs/src/pipeline/types.ts`:

```ts
export interface PurgeCandidate {
  id: string;
  status: string;
  rulesGatePassed: boolean | null;
  scoredAt: Date | null;
}

export interface RetentionStore {
  /** leads with created_at < cutoff and status in ('sourced','rejected') — pre-filter only, isPurgeable decides */
  getPurgeCandidates(cutoff: Date): Promise<PurgeCandidate[]>;
  deleteLeads(ids: string[]): Promise<number>;
}

export interface RetentionDeps {
  store: RetentionStore;
  now?: () => Date;
}

export interface RetentionSummary {
  status: "completed";
  purged: number;
  cutoff: string;
}
```

- [ ] **Step 4: Implement the core**

`packages/jobs/src/pipeline/retention-purge.ts`:

```ts
import type { PurgeCandidate, RetentionDeps, RetentionSummary } from "./types";

/** retention(leads), 0002: prospects with rules_gate_passed = false or never scored purge after 90 days */
export const RETENTION_DAYS = 90;

/**
 * Safety predicate — the deciding logic lives HERE, tested, not in SQL.
 * Anything that ever qualified (or is still awaiting scoring after passing
 * the gate) is kept; only gate-failed or never-scored prospects purge.
 */
export function isPurgeable(lead: PurgeCandidate): boolean {
  if (lead.status !== "sourced" && lead.status !== "rejected") return false;
  if (lead.rulesGatePassed === false) return true;
  return lead.rulesGatePassed === null && lead.scoredAt === null;
}

export async function runRetentionPurge(deps: RetentionDeps): Promise<RetentionSummary> {
  const now = deps.now ? deps.now() : new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  const candidates = await deps.store.getPurgeCandidates(cutoff);
  const ids = candidates.filter(isPurgeable).map((l) => l.id);
  const purged = ids.length > 0 ? await deps.store.deleteLeads(ids) : 0;
  return { status: "completed", purged, cutoff: cutoff.toISOString() };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @vantera/jobs test -- retention-purge`
Expected: PASS.

- [ ] **Step 6: Add the pg-store methods**

In `packages/jobs/src/pipeline/pg-store.ts`: add `lt` to the drizzle-orm import, add `RetentionStore` and `PurgeCandidate` to the `./types` import, widen the return type to `ScoutStore & CopyDraftStore & SchedulerStore & RetentionStore`, and add inside the returned object:

```ts
    // ── RetentionStore ───────────────────────────────────────────────────────

    async getPurgeCandidates(cutoff: Date): Promise<PurgeCandidate[]> {
      return db
        .select({
          id: leads.id,
          status: leads.status,
          rulesGatePassed: leads.rulesGatePassed,
          scoredAt: leads.scoredAt,
        })
        .from(leads)
        .where(and(lt(leads.createdAt, cutoff), inArray(leads.status, ["sourced", "rejected"])));
    },

    async deleteLeads(ids: string[]): Promise<number> {
      // enrichment_results cascade with the lead; suppression entries set-null and survive (0003)
      const rows = await db.delete(leads).where(inArray(leads.id, ids)).returning({ id: leads.id });
      return rows.length;
    },
```

- [ ] **Step 7: Thin trigger wrapper**

`packages/jobs/src/trigger/retention-purge.ts`:

```ts
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { runRetentionPurge } from "../pipeline/retention-purge";

/** Daily GDPR-hygiene purge: never-qualified prospects past the 90-day window (0002, rule 11). */
export const retentionPurge = schedules.task({
  id: "retention-purge",
  cron: "0 4 * * *",
  run: async () => {
    const summary = await runRetentionPurge({ store: createPgStore(createDb()) });
    logger.info("retention purge finished", { ...summary });
    return summary;
  },
});
```

- [ ] **Step 8: Full package gate**

Run: `pnpm --filter @vantera/jobs test && pnpm type-check`
Expected: PASS — including the existing `structure.test.ts` (wrapper imports from `../pipeline/`).

- [ ] **Step 9: Commit**

```bash
git add packages/jobs/src/pipeline/retention-purge.ts packages/jobs/src/pipeline/retention-purge.test.ts packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/trigger/retention-purge.ts
git commit -m "Retention purge job: 90-day window for never-qualified leads (0002, rule 11)"
```

---

### Task 4: Shared suppression helpers in the web app

Both the suppression page and the review queue's "Decline & suppress" need the same normalization/matching, and it must agree with the pipeline (`pg-store.isSuppressed` lowercases; `normalizeLinkedInUrl` in `copy-draft.ts` trims trailing slashes) and the DB check `value = lower(value)`.

**Files:**
- Create: `apps/web/src/lib/suppression.ts`
- Test: `apps/web/src/lib/suppression.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeSuppressionValue, parseSuppressionInput } from "./suppression";

describe("normalizeSuppressionValue", () => {
  it("lowercases and trims emails (DB check: value = lower(value))", () => {
    expect(normalizeSuppressionValue("email", "  Jane.Doe@ACME.com ")).toBe("jane.doe@acme.com");
  });

  it("lowercases linkedin URLs and strips trailing slashes (matches pipeline normalizeLinkedInUrl)", () => {
    expect(normalizeSuppressionValue("linkedin", "https://LinkedIn.com/in/Jane-Doe//")).toBe(
      "https://linkedin.com/in/jane-doe"
    );
  });
});

describe("parseSuppressionInput", () => {
  it("accepts a valid email", () => {
    const r = parseSuppressionInput("email", "jane@acme.com", "bounced before");
    expect(r).toEqual({
      ok: true,
      values: { kind: "email", value: "jane@acme.com", note: "bounced before" },
    });
  });

  it("rejects malformed emails", () => {
    expect(parseSuppressionInput("email", "not-an-email", null).ok).toBe(false);
  });

  it("requires linkedin values to be linkedin.com URLs", () => {
    expect(parseSuppressionInput("linkedin", "https://x.com/jane", null).ok).toBe(false);
    expect(parseSuppressionInput("linkedin", "https://www.linkedin.com/in/jane", null).ok).toBe(true);
  });

  it("rejects unknown kinds and empty values", () => {
    expect(parseSuppressionInput("sms", "x", null).ok).toBe(false);
    expect(parseSuppressionInput("email", "   ", null).ok).toBe(false);
  });

  it("caps notes at 500 chars", () => {
    expect(parseSuppressionInput("email", "a@b.co", "x".repeat(501)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/web test -- suppression`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export type SuppressionKind = "email" | "linkedin";

export type ParsedSuppression =
  | { ok: true; values: { kind: SuppressionKind; value: string; note: string | null } }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE_MAX = 500;

/** Must agree with pg-store.isSuppressed (lowercase) and copy-draft normalizeLinkedInUrl (trailing slashes). */
export function normalizeSuppressionValue(kind: SuppressionKind, raw: string): string {
  const v = raw.trim().toLowerCase();
  return kind === "linkedin" ? v.replace(/\/+$/, "") : v;
}

export function parseSuppressionInput(
  kind: string,
  rawValue: string,
  note: string | null
): ParsedSuppression {
  if (kind !== "email" && kind !== "linkedin") return { ok: false, error: "Pick a channel." };
  const value = normalizeSuppressionValue(kind, rawValue ?? "");
  if (!value) return { ok: false, error: "Enter a value to suppress." };
  if (kind === "email" && !EMAIL_RE.test(value)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  if (kind === "linkedin" && !value.includes("linkedin.com/")) {
    return { ok: false, error: "Enter a LinkedIn profile URL (linkedin.com/…)." };
  }
  const trimmedNote = note?.trim() ? note.trim() : null;
  if (trimmedNote && trimmedNote.length > NOTE_MAX) {
    return { ok: false, error: "Keep the note under 500 characters." };
  }
  return { ok: true, values: { kind, value, note: trimmedNote } };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/web test -- suppression`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/suppression.ts apps/web/src/lib/suppression.test.ts
git commit -m "Shared suppression normalization/validation helpers for web surfaces"
```

---

### Task 5: Suppression management UI (`/settings/suppression`)

Add + view only — the 0003 migration deliberately ships **no update/delete policy** (entries never expire, rule 11). Insert RLS is admin-only; surface the error nicely for members. Adding an entry flips matching queued drafts to `suppressed` immediately.

**Files:**
- Create: `apps/web/src/app/(app)/settings/suppression/actions.ts`
- Create: `apps/web/src/app/(app)/settings/suppression/add-form.tsx`
- Create: `apps/web/src/app/(app)/settings/suppression/page.tsx`
- Modify: `apps/web/src/app/(app)/settings/page.tsx` (link card)

- [ ] **Step 1: Server action**

`actions.ts` (mirror the `sessionAccount` pattern from `agents/actions.ts`):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSuppressionInput } from "@/lib/suppression";

export type SuppressionActionState = { error?: string; added?: string };

export async function addSuppressionEntry(
  _prev: SuppressionActionState,
  formData: FormData
): Promise<SuppressionActionState> {
  const parsed = parseSuppressionInput(
    String(formData.get("kind") ?? ""),
    String(formData.get("value") ?? ""),
    formData.get("note") ? String(formData.get("note")) : null
  );
  if (!parsed.ok) return { error: parsed.error };
  const { kind, value, note } = parsed.values;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  // account from the validated session via RLS-scoped select — never from the form (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.from("suppression_entries").insert({
    account_id: account.id,
    kind,
    value,
    source: "manual",
    note,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "That contact is already suppressed." };
    return { error: "Could not add the entry. Only workspace admins can manage suppression." };
  }

  // rule 11: a suppressed contact never stays queued — flip matching drafts on this channel
  const { data: matchedLeads } = await supabase
    .from("leads")
    .select("id")
    // ilike with no wildcard = exact case-insensitive; linkedin gets % for trailing-slash variants
    .ilike(kind === "email" ? "email" : "linkedin_url", kind === "email" ? value : `${value}%`);
  const leadIds = (matchedLeads ?? []).map((l) => l.id);
  if (leadIds.length > 0) {
    await supabase
      .from("scheduled_sends")
      .update({ status: "suppressed" })
      .in("lead_id", leadIds)
      .eq("channel", kind)
      .in("status", ["pending_review", "approved"]);
  }

  revalidatePath("/settings/suppression");
  revalidatePath("/review");
  return { added: value };
}
```

- [ ] **Step 2: Add form (client)**

`add-form.tsx` — follow the existing `useActionState` form pattern (see `settings/profile-form.tsx` for idiom; reuse `components/ui` Input/Label/Button/Textarea and `form-error.tsx`):

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { addSuppressionEntry, type SuppressionActionState } from "./actions";

export function AddSuppressionForm() {
  const [state, action, pending] = useActionState<SuppressionActionState, FormData>(
    addSuppressionEntry,
    {}
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="kind">Channel</Label>
        <select
          id="kind"
          name="kind"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="email"
        >
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </div>
      <div className="min-w-64 flex-1 space-y-1">
        <Label htmlFor="value">Email address or LinkedIn URL</Label>
        <Input id="value" name="value" placeholder="jane@acme.com" required />
      </div>
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="Asked us to stop" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Suppress"}
      </Button>
      {state.error && <FormError className="w-full">{state.error}</FormError>}
      {state.added && (
        <p className="w-full text-sm text-muted-foreground">
          {state.added} is suppressed — no agent will ever contact them.
        </p>
      )}
    </form>
  );
}
```

(Adapt `FormError` usage to its actual props — read `components/form-error.tsx` first.)

- [ ] **Step 3: Page (server)**

`page.tsx`:

```tsx
import Link from "next/link";
import { ShieldBan } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddSuppressionForm } from "./add-form";

const SOURCE_LABELS: Record<string, string> = {
  unsubscribe: "Unsubscribed",
  bounce: "Bounced",
  complaint: "Spam complaint",
  manual: "Added manually",
  not_interested: "Not interested",
  gdpr: "GDPR request",
};

export default async function SuppressionPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("suppression_entries")
    .select("id, kind, value, source, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppression list</h1>
        <p className="text-sm text-muted-foreground">
          Contacts here are never messaged by your agents, on any channel they're suppressed for.
          Entries are permanent — they protect you and your prospects.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suppress a contact</CardTitle>
        </CardHeader>
        <CardContent>
          <AddSuppressionForm />
        </CardContent>
      </Card>

      {!entries || entries.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <ShieldBan className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Nothing suppressed yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Unsubscribes, bounces, and "not interested" replies land here automatically once
              sending goes live. You can add contacts manually any time.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Contact</th>
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Reason</th>
                  <th className="pb-2">Added</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="max-w-80 truncate py-2 font-medium" title={e.value}>
                      {e.value}
                      {e.note && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {e.note}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{e.kind === "email" ? "Email" : "LinkedIn"}</td>
                    <td className="py-2">
                      <Badge variant="secondary">{SOURCE_LABELS[e.source] ?? e.source}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

(Check `components/ui/badge.tsx` for its actual variants before using `secondary`.)

- [ ] **Step 4: Link card on `/settings`**

Read `apps/web/src/app/(app)/settings/page.tsx` and add a card consistent with its existing sections, linking to `/settings/suppression`, copy along the lines of: title "Suppression list", body "Contacts your agents must never message — unsubscribes, bounces, and manual adds.", link/button "Manage suppression".

- [ ] **Step 5: Verify**

Run: `pnpm --filter @vantera/web test && pnpm type-check && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/settings/suppression apps/web/src/app/\(app\)/settings/page.tsx
git commit -m "Suppression management UI: view + manual adds, queued drafts flip to suppressed (rule 11)"
```

---

### Task 6: Review queue actions + validation

Server actions for approve / edit / decline / decline-and-suppress. Edit re-runs the humanizer so the flags stay honest. `@vantera/agent-brains` exports `validateHumanity` and `describeViolations` (pure functions — fine to use in the web app; the purity guardrail constrains what agent-brains imports, not who imports it).

**Files:**
- Modify: `apps/web/package.json` (add `"@vantera/agent-brains": "workspace:*"` to dependencies — **re-read the file first**, another session may have touched it)
- Create: `apps/web/src/app/(app)/review/validation.ts`
- Test: `apps/web/src/app/(app)/review/validation.test.ts`
- Create: `apps/web/src/app/(app)/review/actions.ts`

- [ ] **Step 1: Write the failing validation tests**

```ts
import { describe, expect, it } from "vitest";
import { parseDraftEdit } from "./validation";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseDraftEdit", () => {
  it("accepts an email edit with subject and body", () => {
    const r = parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "Hi", body: "Short note." }));
    expect(r).toEqual({
      ok: true,
      values: { sendId: "s1", channel: "email", subject: "Hi", body: "Short note." },
    });
  });

  it("accepts a linkedin edit with no subject", () => {
    const r = parseDraftEdit(form({ sendId: "s1", channel: "linkedin", body: "Hello there" }));
    expect(r.ok && r.values.subject).toBe(null);
  });

  it("rejects an empty body", () => {
    expect(parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "Hi", body: "  " })).ok).toBe(false);
  });

  it("rejects a missing sendId and unknown channels", () => {
    expect(parseDraftEdit(form({ channel: "email", subject: "Hi", body: "x" })).ok).toBe(false);
    expect(parseDraftEdit(form({ sendId: "s1", channel: "sms", body: "x" })).ok).toBe(false);
  });

  it("rejects oversized content", () => {
    expect(
      parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "x".repeat(121), body: "x" })).ok
    ).toBe(false);
    expect(
      parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "Hi", body: "x".repeat(5001) })).ok
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @vantera/web test -- review`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement validation**

`validation.ts`:

```ts
export const SUBJECT_MAX = 120;
export const BODY_MAX = 5000;

export type ParsedDraftEdit =
  | { ok: true; values: { sendId: string; channel: "email" | "linkedin"; subject: string | null; body: string } }
  | { ok: false; error: string };

export function parseDraftEdit(formData: FormData): ParsedDraftEdit {
  const sendId = String(formData.get("sendId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const rawSubject = formData.get("subject");
  const subject = rawSubject ? String(rawSubject).trim() || null : null;

  if (!sendId) return { ok: false, error: "Invalid request." };
  if (channel !== "email" && channel !== "linkedin") return { ok: false, error: "Invalid request." };
  if (!body) return { ok: false, error: "The message can't be empty." };
  if (body.length > BODY_MAX) return { ok: false, error: "Keep the message under 5,000 characters." };
  if (subject && subject.length > SUBJECT_MAX) {
    return { ok: false, error: "Keep the subject under 120 characters." };
  }
  return { ok: true, values: { sendId, channel, subject, body } };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/web test -- review`
Expected: PASS.

- [ ] **Step 5: Add the agent-brains dependency**

Re-read `apps/web/package.json`, add `"@vantera/agent-brains": "workspace:*"` to `dependencies` (keep other sessions' edits intact), then run `pnpm install`.

- [ ] **Step 6: Implement the actions**

`actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { describeViolations, validateHumanity } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { normalizeSuppressionValue } from "@/lib/suppression";
import { parseDraftEdit } from "./validation";

export type ReviewActionState = { error?: string };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null };
  // account from the validated session via RLS-scoped select (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return { supabase, user, account };
}

export async function approveDraft(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", sendId)
    .eq("status", "pending_review"); // only queued drafts can be approved
  if (error) return { error: "Could not approve the draft. Only workspace admins can review." };
  revalidatePath("/review");
  return {};
}

export async function saveDraftEdit(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const parsed = parseDraftEdit(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { sendId, subject, body } = parsed.values;
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  // the humanizer verdict follows the text — edits re-lint, clean edits clear the flags
  const violations = validateHumanity([subject, body].filter(Boolean).join("\n"));
  const styleFlags = violations.length > 0 ? describeViolations(violations) : null;

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ subject, body, style_flags: styleFlags })
    .eq("id", sendId)
    .eq("status", "pending_review");
  if (error) return { error: "Could not save the edit. Only workspace admins can review." };
  revalidatePath("/review");
  return {};
}

export async function declineDraft(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ status: "canceled" })
    .eq("id", sendId)
    .eq("status", "pending_review");
  if (error) return { error: "Could not decline the draft. Only workspace admins can review." };
  revalidatePath("/review");
  return {};
}

export async function declineAndSuppress(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user, account } = await session();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  const { data: send } = await supabase
    .from("scheduled_sends")
    .select("id, channel, lead_id, leads(email, linkedin_url)")
    .eq("id", sendId)
    .maybeSingle<{
      id: string;
      channel: "email" | "linkedin";
      lead_id: string;
      leads: { email: string | null; linkedin_url: string | null } | null;
    }>();
  if (!send?.leads) return { error: "Draft not found." };

  const raw = send.channel === "email" ? send.leads.email : send.leads.linkedin_url;
  if (!raw) return { error: "This lead has no contact info to suppress." };
  const value = normalizeSuppressionValue(send.channel, raw);

  const { error: suppressError } = await supabase.from("suppression_entries").insert({
    account_id: account.id,
    kind: send.channel,
    value,
    source: "manual",
    note: "Declined from the review queue",
    lead_id: send.lead_id,
    created_by: user.id,
  });
  // 23505 = already suppressed; still cancel the drafts below
  if (suppressError && suppressError.code !== "23505") {
    return { error: "Could not suppress the contact. Only workspace admins can review." };
  }

  // rule 11: nothing for this contact stays queued on this channel
  await supabase
    .from("scheduled_sends")
    .update({ status: "suppressed" })
    .eq("lead_id", send.lead_id)
    .eq("channel", send.channel)
    .in("status", ["pending_review", "approved"]);

  revalidatePath("/review");
  revalidatePath("/settings/suppression");
  return {};
}
```

- [ ] **Step 7: Verify**

Run: `pnpm --filter @vantera/web test && pnpm type-check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/\(app\)/review/validation.ts apps/web/src/app/\(app\)/review/validation.test.ts apps/web/src/app/\(app\)/review/actions.ts apps/web/package.json pnpm-lock.yaml
git commit -m "Review queue actions: approve, edit (re-lints humanizer), decline, decline+suppress"
```

---

### Task 7: Review queue UI (`/review`) + nav swap

Campaigns are never the primary user surface (rule 08): the nav slot becomes **Review**; `/campaigns` redirects. Before building this and the leads UI, run the `retention-experience` skill for the surfaces' empty/value framing, and follow `ultimate-ui-builder` craft guidance — but stay visually consistent with the existing app shell (cards, badges, muted-foreground secondary text).

**Files:**
- Create: `apps/web/src/app/(app)/review/page.tsx`
- Create: `apps/web/src/app/(app)/review/draft-card.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx` (NAV array)
- Modify: `apps/web/src/app/(app)/campaigns/page.tsx` (redirect)

- [ ] **Step 1: Nav swap**

In `layout.tsx`: replace the campaigns entry with `{ href: "/review", label: "Review", icon: Inbox }`; swap the `Megaphone` lucide import for `Inbox`.

- [ ] **Step 2: Campaigns redirect**

Replace `campaigns/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation";

// campaigns are an internal execution grouping, never the primary surface (rule 08)
export default function CampaignsPage() {
  redirect("/review");
}
```

- [ ] **Step 3: Review page (server)**

`page.tsx`:

```tsx
import Link from "next/link";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DraftCard, type DraftRow } from "./draft-card";

const CHANNELS = ["all", "email", "linkedin"] as const;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("scheduled_sends")
    .select(
      "id, channel, subject, body, style_flags, created_at, leads(first_name, last_name, title, company_name)",
      { count: "exact" }
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(50);
  if (channel === "email" || channel === "linkedin") query = query.eq("channel", channel);
  const { data: drafts, count } = await query;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          {count ?? 0} draft{count === 1 ? "" : "s"} waiting. Nothing sends without your approval.
        </p>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {CHANNELS.map((c) => (
          <Link
            key={c}
            href={c === "all" ? "/review" : `/review?channel=${c}`}
            className={`rounded-full border px-3 py-1 capitalize ${
              (channel ?? "all") === c ? "border-primary bg-primary/10 font-medium" : "border-border"
            }`}
          >
            {c === "linkedin" ? "LinkedIn" : c}
          </Link>
        ))}
      </div>

      {!drafts || drafts.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Queue's clear</CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              When your Copy Agent drafts outreach for qualified leads, every message lands here
              for your sign-off first. Check{" "}
              <Link href="/agents" className="underline underline-offset-2">
                your agents
              </Link>{" "}
              are live.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {(drafts as unknown as DraftRow[]).map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Draft card (client)**

`draft-card.tsx` — one card per draft: lead context line, channel badge, **style-flag badges** (amber, visible — never hidden), body (and subject for email), and the four actions. Edit toggles an inline form with subject/body fields. Use `useActionState` per action (see `agent-card.tsx` for the idiom). Skeleton:

```tsx
"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Linkedin, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { approveDraft, declineDraft, declineAndSuppress, saveDraftEdit } from "./actions";
import type { ReviewActionState } from "./actions";

export interface DraftRow {
  id: string;
  channel: "email" | "linkedin";
  subject: string | null;
  body: string;
  style_flags: string | null;
  created_at: string;
  leads: {
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    company_name: string | null;
  } | null;
}

export function DraftCard({ draft }: { draft: DraftRow }) {
  const [editing, setEditing] = useState(false);
  const [approveState, approve, approving] = useActionState<ReviewActionState, FormData>(approveDraft, {});
  const [declineState, decline, declining] = useActionState<ReviewActionState, FormData>(declineDraft, {});
  const [suppressState, suppress, suppressing] = useActionState<ReviewActionState, FormData>(declineAndSuppress, {});
  const [editState, saveEdit, saving] = useActionState<ReviewActionState, FormData>(saveDraftEdit, {});

  const lead = draft.leads;
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown prospect";
  const context = [lead?.title, lead?.company_name].filter(Boolean).join(" · ");
  const error = approveState.error ?? declineState.error ?? suppressState.error ?? editState.error;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <p className="font-medium">{name}</p>
          {context && <p className="text-sm text-muted-foreground">{context}</p>}
        </div>
        <Badge variant="outline" className="gap-1">
          {draft.channel === "email" ? <Mail className="size-3" /> : <Linkedin className="size-3" />}
          {draft.channel === "email" ? "Email" : "LinkedIn"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.style_flags && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Style check: {draft.style_flags}
          </p>
        )}

        {editing ? (
          <form
            action={(fd) => {
              saveEdit(fd);
              setEditing(false);
            }}
            className="space-y-2"
          >
            <input type="hidden" name="sendId" value={draft.id} />
            <input type="hidden" name="channel" value={draft.channel} />
            {draft.channel === "email" && (
              <Input name="subject" defaultValue={draft.subject ?? ""} placeholder="Subject" />
            )}
            <Textarea name="body" defaultValue={draft.body} rows={6} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            {draft.subject && <p className="mb-1 font-medium">{draft.subject}</p>}
            <p className="whitespace-pre-wrap">{draft.body}</p>
          </div>
        )}

        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={approve}>
              <input type="hidden" name="sendId" value={draft.id} />
              <Button type="submit" size="sm" disabled={approving}>
                {approving ? "Approving…" : "Approve"}
              </Button>
            </form>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <form action={decline}>
              <input type="hidden" name="sendId" value={draft.id} />
              <Button type="submit" size="sm" variant="ghost" disabled={declining}>
                Decline
              </Button>
            </form>
            <form action={suppress}>
              <input type="hidden" name="sendId" value={draft.id} />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={suppressing}
              >
                Decline &amp; never contact
              </Button>
            </form>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
```

(Verify `Badge`/`Button` variants against the actual `components/ui` files; verify lucide still exports `Linkedin` — fall back to a text label if not.)

- [ ] **Step 5: Verify**

Run: `pnpm --filter @vantera/web test && pnpm type-check && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/review/page.tsx apps/web/src/app/\(app\)/review/draft-card.tsx apps/web/src/app/\(app\)/layout.tsx apps/web/src/app/\(app\)/campaigns/page.tsx
git commit -m "Review queue UI: approve/edit/decline drafts, style flags visible; nav swaps Campaigns for Review"
```

---

### Task 8: Leads table UI (`/leads`)

Server component with status tabs + pagination via searchParams; row click opens a client slide-over with the rule 06 surface: score, rationale, structured insights, gate reasons, enrichment statuses.

**Files:**
- Create: `apps/web/src/app/(app)/leads/leads-table.tsx`
- Modify: `apps/web/src/app/(app)/leads/page.tsx` (replace the ComingSoon stub)

- [ ] **Step 1: Page (server)**

```tsx
import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadsTable, type LeadRow } from "./leads-table";

const PAGE_SIZE = 25;

const TABS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "qualified", label: "Qualified", statuses: ["qualified", "enriched"] },
  { key: "in_campaign", label: "In outreach", statuses: ["in_campaign"] },
  { key: "replied", label: "Replied", statuses: ["replied", "converted"] },
  { key: "rejected", label: "Filtered out", statuses: ["rejected"] },
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(
      "id, first_name, last_name, title, company_name, industry, location, status, ai_score, ai_rationale, ai_insights, rules_gate_reasons, email, email_status, phone, phone_status, linkedin_url, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (tab.statuses) query = query.in("status", tab.statuses);
  const { data: leads, count } = await query;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Every prospect your agents sourced, with the reasoning behind each score.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/leads" : `/leads?tab=${t.key}`}
            className={`rounded-full border px-3 py-1 ${
              tab.key === t.key ? "border-primary bg-primary/10 font-medium" : "border-border"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!leads || leads.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {tab.key === "all" ? "No leads yet" : "Nothing here yet"}
            </CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              {tab.key === "all"
                ? "Your Prospect Agent fills this page on its schedule — sourcing, scoring, and keeping only high-quality leads."
                : "Leads move here as your agents work the pipeline."}
            </p>
            {tab.key === "all" && (
              <Button asChild variant="outline" size="sm" className="mx-auto mt-2">
                <Link href="/agents">Check your agents</Link>
              </Button>
            )}
          </CardHeader>
        </Card>
      ) : (
        <>
          <LeadsTable leads={leads as unknown as LeadRow[]} />
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {count} leads
              </span>
              <span className="flex gap-2">
                {page > 1 && (
                  <Link className="underline underline-offset-2" href={`/leads?tab=${tab.key}&page=${page - 1}`}>
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link className="underline underline-offset-2" href={`/leads?tab=${tab.key}&page=${page + 1}`}>
                    Next
                  </Link>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Table + slide-over (client)**

`leads-table.tsx`. `LeadRow` mirrors the select above (snake_case fields; `ai_insights` is the `StoredInsights` shape: `pain_points`, `triggers`, `motivations`, `value_angle`, `aha_moment`, `summary` — first five are string arrays except `value_angle`/`aha_moment`/`summary` strings; check `packages/agent-brains/src/prospect/schema.ts` `toStoredInsights` before rendering). Structure:

- `<table>` rows: name+title / company+industry / status badge / score (em-dash when null) / channel icons (Mail when `email`, Linkedin when `linkedin_url`, muted when missing).
- Clicking a row sets `selected` state → fixed right-side panel (`fixed inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-border bg-background p-6 shadow-xl` + a click-away overlay). No new shared UI primitive needed; this stays an agent-page-style composition.
- Panel sections, in order: header (name, title, company, status badge); **Score** (big `ai_score`, `ai_rationale` paragraph); **Why this lead** (insights: summary paragraph, then labeled lists for pain points / triggers / motivations, then value angle + aha moment); **Gate** (when `rejected`: render `rules_gate_reasons` array); **Contact** (email + `email_status` badge, phone + `phone_status`, LinkedIn link `target="_blank"`).
- Status badge labels: sourced → "Sourced", rejected → "Filtered out", qualified → "Qualified", enriched → "Enriched", in_campaign → "In outreach", replied → "Replied", converted → "Converted", archived → "Archived".

- [ ] **Step 3: Verify**

Run: `pnpm --filter @vantera/web test && pnpm type-check && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/leads
git commit -m "Leads table UI: status tabs, pagination, insights slide-over (rule 06 surface)"
```

---

### Task 9: Help articles (knowledge-sync, rule 09)

Frontmatter format (see `packages/help-content/content/agents-prospect.md`): `title` / `surface` / `routes`. **No vendor names** (Smartlead, Unipile, Explorium, Trigger.dev, Supabase must not appear — `articles.test.ts` guards this).

**Files:**
- Create: `packages/help-content/content/leads.md`
- Create: `packages/help-content/content/review-queue.md`
- Create: `packages/help-content/content/suppression.md`

- [ ] **Step 1: Write the three articles**

`leads.md`:

```markdown
---
title: Your leads and how they're scored
surface: leads
routes: /leads
---

# Your leads and how they're scored

The Leads page shows every prospect your Prospect Agent sourced. Each lead goes through two checks: a rules gate that confirms basic fit with your ideal customer profile, and an AI ranking that scores nuanced fit from 0–100 with a written rationale.

Click any lead to see why it scored the way it did: pain points, buying triggers, motivations, the angle most likely to land, and the "aha moment" your outreach can build on. Leads that didn't fit are under "Filtered out", each with the reasons.

Only high-quality leads (score 70+ by default) move on to outreach drafting. Prospects that never qualify are automatically removed after 90 days.
```

`review-queue.md`:

```markdown
---
title: Reviewing drafts before they send
surface: review
routes: /review
---

# Reviewing drafts before they send

Every message your Copy Agent writes waits in the review queue — nothing sends without your approval.

Each draft shows who it's for, the channel, and the message. If our style check spotted anything that could read as robotic, you'll see a flag on the card; edit the draft and the flag clears once the text passes.

- **Approve** — the draft is cleared to send once live sending launches.
- **Edit** — change the subject or message; we re-check the style automatically.
- **Decline** — drop this draft.
- **Decline & never contact** — drop the draft and add the contact to your suppression list so no agent messages them again.
```

`suppression.md`:

```markdown
---
title: The suppression list
surface: settings
routes: /settings/suppression, /settings
---

# The suppression list

The suppression list is the master "do not contact" record for your workspace. Before any agent drafts or sends a message, it checks this list — suppressed contacts are never messaged on that channel.

Entries are added automatically when someone unsubscribes, an email bounces, a message is marked as spam, or a prospect replies that they're not interested. You can also add anyone manually with their email address or LinkedIn profile URL.

Suppression entries are permanent by design: they protect your prospects' wishes and your sending reputation. Adding an entry also pulls any of that contact's queued drafts out of the review queue immediately.
```

- [ ] **Step 2: Verify the content guardrails**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS (frontmatter parses, no vendor names).

- [ ] **Step 3: Commit**

```bash
git add packages/help-content/content/leads.md packages/help-content/content/review-queue.md packages/help-content/content/suppression.md
git commit -m "Help articles: leads, review queue, suppression (knowledge-sync, rule 09)"
```

---

### Task 10: Ship — full gate, audits, roadmap flip

- [ ] **Step 1: Full CI gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 2: whitelabel-auditor pass**

Dispatch the `whitelabel-auditor` agent over the new user-facing surfaces (`apps/web/src/app/(app)/leads`, `review`, `settings/suppression`, help articles). Fix any findings.

- [ ] **Step 3: Manual smoke check**

`pnpm dev`, then: `/leads` tabs + slide-over, `/review` approve/edit/decline on a seeded draft, `/settings/suppression` add + verify the queued draft flips, `/campaigns` redirects.

- [ ] **Step 4: Flip the roadmap + close out**

Mark Phase 4 `[x]` in `docs/roadmap.md` with a "Shipped" note mirroring the Phase 3 entry (scope shipped + anything descoped). Then run the `/ship-phase` flow (it re-verifies the rule 12 definition of done).

```bash
git add docs/roadmap.md
git commit -m "Phase 4 complete: leads & review queue UI — roadmap flipped"
```

---

## Self-review notes

- **Spec coverage:** leads table (Task 8), review queue + nav (Tasks 6–7), style_flags migration (Task 1), suppression UI add-only + draft flip (Tasks 4–5), retention purge (Task 3), safety limits (Task 2), help articles (Task 9), audits + roadmap (Task 10). Lead detail panel covers rule 06's "rationale shown on the dashboard".
- **Rule 11 DoD:** the "suppressed contact never stays queued" behavior ships in Tasks 5 & 6; the draft-path suppression test already exists (`copy-draft.test.ts`). Normalization equivalence is tested in Task 4.
- **Types:** `style_flags` (DB/snake) vs `styleFlags` (Drizzle/TS) used consistently; `DraftRow`/`LeadRow` mirror the supabase selects (snake_case).
- **Known judgment calls:** review queue caps at 50 oldest-first (no pagination v1); leads slide-over is a local composition, not a shared primitive; `paceWithJitter` is deterministic-by-seed so Phase 5 sends can be both random-feeling and testable.

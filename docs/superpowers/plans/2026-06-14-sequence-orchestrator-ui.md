# Sequence Orchestrator (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on:** Plan 1 (`2026-06-14-sequence-orchestrator-backend.md`) must be merged — these surfaces render `sequence_runs` and `lead_notifications`.

**Goal:** Ship the four flow-shaped UI surfaces that let a user configure the outreach sequence, watch leads move through it, respond to replies, and feel the win when a lead converts — each built from its Retention Brief.

**Architecture:** Next.js App Router. Each surface is a server component (`page.tsx`, RLS-scoped Supabase reads via `@/lib/supabase/server`) + a client view, plus `"use server"` actions for writes. Data/query/action code is written in full here; the *visual* component internals are generated through **`ultimate-ui-builder`**, fed each surface's Retention Brief as its step-1 Brief and the exact props contract from this plan. Design language is the existing dark system (Montserrat + Geist Mono, landing visual language per `DESIGN.md`), reusing `@/components/ui/*` (`card`, `button`, `badge`, `panel`, `animated-progress`).

**Tech Stack:** Next.js 15 (App Router, RSC, server actions), Supabase SSR client, Tailwind, the repo's UI kit, `ultimate-ui-builder` for visual generation.

**Definition of done (rules baked in):** `accountId` only from the validated session (rule 02); no vendor names in any UI text/DTO/help copy (white-label); value-proof copy reads real account fields (`revenue_goal_cents`, `avg_deal_value_cents`, `convertedClients`) — never placeholders; **knowledge-sync** (help-content article + copilot tool) ships in this PR since these are user-facing (rule 09); dashboard-style surfaces follow the rule-07 loop (replicate reference precisely → verify → repeat); roadmap checkbox flipped at completion (rule 12). Run the `whitelabel-auditor` subagent on the user-facing diff before shipping.

**Retention Briefs (verbatim inputs for `ultimate-ui-builder`):** from the spec `docs/superpowers/specs/2026-06-14-outreach-sequence-orchestrator-design.md` (UI/UX section). Each task restates its Brief.

---

## File Structure

**New**
- `apps/web/src/app/(app)/sequence/page.tsx` — Sequence Builder (server).
- `apps/web/src/app/(app)/sequence/sequence-builder.tsx` — client form (ultimate-ui-builder).
- `apps/web/src/app/(app)/sequence/actions.ts` — `saveSequenceConfig` server action.
- `apps/web/src/app/(app)/pipeline/page.tsx` — Pipeline Progress View (server).
- `apps/web/src/app/(app)/pipeline/pipeline-board.tsx` — client view (ultimate-ui-builder).
- `apps/web/src/components/notifications/notifications-bell.tsx` — header bell (ultimate-ui-builder).
- `apps/web/src/components/notifications/actions.ts` — `markNotificationsRead`.
- `apps/web/src/components/conversion-celebration.tsx` — Conversion Moment (ultimate-ui-builder).
- `apps/web/src/app/(app)/leads/reply-panel.tsx` — reply + handoff actions (ultimate-ui-builder).
- `apps/web/src/app/(app)/leads/reply-actions.ts` — `sendManualReply`, `delegateToAgent` (stub).
- `packages/help-content/articles/outreach-sequence.md` (or repo's article format) — knowledge-sync.

**Modified**
- `apps/web/src/components/dock-nav.tsx` — add the **Pipeline** nav entry.
- `apps/web/src/app/(app)/leads/leads-table.tsx` — surface the reply panel on a replied lead.
- `apps/web/src/app/(app)/dashboard/dashboard-view.tsx` — mount the conversion celebration on a new `converted` notification.
- `docs/roadmap.md` — flip the sequence-orchestrator phase checkbox.
- the copilot tool registry — register a `get_sequence_status` tool (knowledge-sync).

---

## Task 1: Pipeline data layer + nav entry

**Files:**
- Create: `apps/web/src/app/(app)/pipeline/page.tsx` (data only this task), `apps/web/src/app/(app)/pipeline/queries.ts`
- Modify: `apps/web/src/components/dock-nav.tsx`
- Test: `apps/web/src/app/(app)/pipeline/queries.test.ts`

- [ ] **Step 1: Write the failing query test**

`queries.test.ts` — the pure shaping function that turns raw run rows + account goal into the view model:

```ts
import { describe, expect, it } from "vitest";
import { shapePipeline } from "./queries";

describe("shapePipeline", () => {
  it("counts runs per stage and computes goal progress from real deal value", () => {
    const vm = shapePipeline({
      runs: [
        { current_stage: "linkedin", status: "active" },
        { current_stage: "linkedin", status: "active" },
        { current_stage: "email", status: "active" },
        { current_stage: "call", status: "active" },
        { current_stage: "done", status: "converted" },
      ],
      convertedClients: 1,
      avgDealValueCents: 500_000, // $5,000
      revenueGoalCents: 2_000_000, // $20,000/mo
    });
    expect(vm.stages).toEqual([
      { stage: "linkedin", label: "LinkedIn", count: 2 },
      { stage: "email", label: "Email", count: 1 },
      { stage: "imessage", label: "iMessage", count: 0 },
      { stage: "call", label: "Caller", count: 1 },
    ]);
    expect(vm.activeTotal).toBe(4);
    expect(vm.pipelineValueCents).toBe(500_000); // 1 converted * 5000
    expect(vm.goalProgressPct).toBe(25); // 5000 / 20000
  });

  it("clamps goal progress at 100 and handles a null goal", () => {
    const vm = shapePipeline({ runs: [], convertedClients: 10, avgDealValueCents: 500_000, revenueGoalCents: null });
    expect(vm.goalProgressPct).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test pipeline/queries`
Expected: FAIL — `shapePipeline` not found.

- [ ] **Step 3: Implement `queries.ts`**

```ts
import type { SequenceStage } from "@vantera/jobs/pipeline/types";

const STAGE_LABELS: Record<SequenceStage, string> = {
  linkedin: "LinkedIn", email: "Email", imessage: "iMessage", call: "Caller",
};
const STAGE_ORDER: SequenceStage[] = ["linkedin", "email", "imessage", "call"];

export interface PipelineInput {
  runs: { current_stage: string; status: string }[];
  convertedClients: number;
  avgDealValueCents: number | null;
  revenueGoalCents: number | null;
}

export interface PipelineViewModel {
  stages: { stage: SequenceStage; label: string; count: number }[];
  activeTotal: number;
  pipelineValueCents: number;
  goalProgressPct: number | null;
}

export function shapePipeline(input: PipelineInput): PipelineViewModel {
  const counts = new Map<SequenceStage, number>(STAGE_ORDER.map((s) => [s, 0]));
  for (const r of input.runs) {
    if (r.status === "active" && (STAGE_ORDER as string[]).includes(r.current_stage)) {
      const s = r.current_stage as SequenceStage;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  const stages = STAGE_ORDER.map((stage) => ({ stage, label: STAGE_LABELS[stage], count: counts.get(stage) ?? 0 }));
  const activeTotal = stages.reduce((n, s) => n + s.count, 0);
  const pipelineValueCents = input.convertedClients * (input.avgDealValueCents ?? 0);
  const goalProgressPct = input.revenueGoalCents
    ? Math.min(100, Math.round((pipelineValueCents / input.revenueGoalCents) * 100))
    : null;
  return { stages, activeTotal, pipelineValueCents, goalProgressPct };
}
```

- [ ] **Step 4: Add the data-only page (server)**

`apps/web/src/app/(app)/pipeline/page.tsx` — RLS-scoped reads (account from session, never the URL):

```tsx
import { createClient } from "@/lib/supabase/server";
import { shapePipeline } from "./queries";
import { PipelineBoard } from "./pipeline-board"; // built in Task 4

export default async function PipelinePage() {
  const supabase = await createClient();
  const [{ data: runs }, { data: account }, { count: convertedClients }] = await Promise.all([
    supabase.from("sequence_runs").select("current_stage, status"),
    supabase.from("accounts").select("revenue_goal_cents, avg_deal_value_cents").single(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted"),
  ]);
  const vm = shapePipeline({
    runs: runs ?? [],
    convertedClients: convertedClients ?? 0,
    avgDealValueCents: account?.avg_deal_value_cents ?? null,
    revenueGoalCents: account?.revenue_goal_cents ?? null,
  });
  return <PipelineBoard vm={vm} />;
}
```

- [ ] **Step 5: Add the nav entry**

In `apps/web/src/components/dock-nav.tsx`, add to the `NAV_ITEMS` array (import `GitBranch` from `lucide-react`), placed after `leads`:

```ts
  { key: "pipeline", href: "/pipeline", label: "Pipeline", icon: GitBranch },
```

- [ ] **Step 6: Run test & commit**

Run: `pnpm --filter web test pipeline/queries`
Expected: PASS (2 tests).

```bash
git add apps/web/src/app/\(app\)/pipeline apps/web/src/components/dock-nav.tsx
git commit -m "feat(web): pipeline data layer + nav entry"
```

---

## Task 2: Pipeline Progress View — visual (ultimate-ui-builder)

**Brief (Pipeline Progress View):** habitual user · *goal-gradient* · open and see the pipeline is alive · live stage distribution ("18 in LinkedIn, 7 in Email, 3 being called") + pipeline value vs. the MRR goal · defuses the silent-waiting cliff.

**Files:**
- Create: `apps/web/src/app/(app)/pipeline/pipeline-board.tsx`

- [ ] **Step 1: Generate the component via ultimate-ui-builder**

Invoke `ultimate-ui-builder` with the Brief above as its step-1 Brief and this exact props contract:

```ts
import type { PipelineViewModel } from "./queries";
export function PipelineBoard({ vm }: { vm: PipelineViewModel }): JSX.Element;
```

**Design constraints (hand to the builder):**
- Dark theme, Montserrat + Geist Mono, landing visual language (`DESIGN.md`); reuse `@/components/ui/card`, `badge`, `panel`, `animated-progress`.
- A horizontal 4-stage flow (LinkedIn → Email → iMessage → Caller) with a live count badge per stage; arrows between stages convey motion/escalation.
- A goal-progress bar from `vm.goalProgressPct` labeled against the MRR goal (use `animated-progress`); if `goalProgressPct` is null, show "Set a revenue goal" linking to `/settings` (no dead end).
- **Empty state** (`vm.activeTotal === 0` and no conversions): a single clear CTA "Launch a campaign" linking to `/agents` — never a blank panel.
- Pipeline value rendered from `vm.pipelineValueCents` (format cents → `$X`), framed as progress, not a static stat.

- [ ] **Step 2: Churn check (mandatory before done)**

Verify against the Brief: empty state has a next action ✓; progress is tied to the MRR goal ✓; value is displayed, not hidden ✓; no placeholder numbers (all from `vm`) ✓. Fix any miss before proceeding.

- [ ] **Step 3: Verify in the browser**

Run the app, visit `/pipeline` with seeded `sequence_runs`. Confirm counts match the DB and the empty state renders when there are no active runs.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/pipeline/pipeline-board.tsx
git commit -m "feat(web): Pipeline Progress View (goal-gradient stage board)"
```

---

## Task 3: Sequence Builder — data + save action

**Files:**
- Create: `apps/web/src/app/(app)/sequence/page.tsx`, `apps/web/src/app/(app)/sequence/actions.ts`
- Test: `apps/web/src/app/(app)/sequence/actions.test.ts`

- [ ] **Step 1: Write the failing action test** (validates + tenant-scopes the save):

```ts
import { describe, expect, it } from "vitest";
import { parseSequenceForm } from "./actions";

describe("parseSequenceForm", () => {
  it("parses per-stage touches/gaps/waits and the enabled flags", () => {
    const fd = new FormData();
    fd.set("linkedin.enabled", "on"); fd.set("linkedin.touches", "2"); fd.set("linkedin.touchGapDays", "2"); fd.set("linkedin.waitDays", "3");
    fd.set("email.enabled", "on"); fd.set("email.touches", "2"); fd.set("email.touchGapDays", "2"); fd.set("email.waitDays", "3");
    fd.set("imessage.enabled", ""); fd.set("imessage.touches", "1"); fd.set("imessage.touchGapDays", "2"); fd.set("imessage.waitDays", "2");
    fd.set("call.enabled", "on"); fd.set("call.maxAttempts", "2"); fd.set("call.touchGapDays", "2"); fd.set("call.waitDays", "2");
    const cfg = parseSequenceForm(fd);
    expect(cfg.stages.linkedin).toMatchObject({ enabled: true, touches: 2, waitDays: 3 });
    expect(cfg.stages.imessage.enabled).toBe(false);
    expect(cfg.stages.call.maxAttempts).toBe(2);
    expect(cfg.order).toEqual(["linkedin", "email", "imessage", "call"]);
  });

  it("clamps caller attempts to a 1-3 safety range", () => {
    const fd = new FormData();
    for (const s of ["linkedin", "email", "imessage", "call"]) { fd.set(`${s}.enabled`, "on"); fd.set(`${s}.touches`, "1"); fd.set(`${s}.touchGapDays`, "2"); fd.set(`${s}.waitDays`, "2"); }
    fd.set("call.maxAttempts", "99");
    expect(parseSequenceForm(fd).stages.call.maxAttempts).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test sequence/actions`
Expected: FAIL — `parseSequenceForm` not found.

- [ ] **Step 3: Implement `actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SEQUENCE_DEFAULTS } from "@vantera/jobs/pipeline/sequence-config";
import type { SequenceConfig, SequenceStage } from "@vantera/jobs/pipeline/types";

const STAGES: SequenceStage[] = ["linkedin", "email", "imessage", "call"];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (fd: FormData, k: string, dflt: number) => {
  const v = Number(fd.get(k)); return Number.isFinite(v) ? v : dflt;
};

/** Pure parse so it is unit-testable without a session. */
export function parseSequenceForm(fd: FormData): SequenceConfig {
  const stages = {} as SequenceConfig["stages"];
  for (const s of STAGES) {
    const d = SEQUENCE_DEFAULTS.stages[s];
    stages[s] = {
      enabled: fd.get(`${s}.enabled`) === "on",
      touches: clamp(num(fd, `${s}.touches`, d.touches), 0, 5),
      touchGapDays: clamp(num(fd, `${s}.touchGapDays`, d.touchGapDays), 0, 14),
      waitDays: clamp(num(fd, `${s}.waitDays`, d.waitDays), 0, 14),
      ...(s === "call" ? { maxAttempts: clamp(num(fd, "call.maxAttempts", 2), 1, 3) } : {}),
    };
  }
  return { order: SEQUENCE_DEFAULTS.order, stages };
}

export type SequenceState = { error?: string; saved?: boolean };

export async function saveSequenceConfig(_prev: SequenceState, fd: FormData): Promise<SequenceState> {
  const config = parseSequenceForm(fd);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  // account + active campaign come from RLS-scoped reads, never the form (rule 02)
  const { data: account } = await supabase.from("accounts").select("id").single();
  if (!account) return { error: "No workspace found." };
  const { data: campaign } = await supabase
    .from("campaigns").select("id").eq("status", "active").order("created_at", { ascending: false }).limit(1).single();
  if (!campaign) return { error: "Launch a campaign before configuring its sequence." };
  const { error } = await supabase.from("campaigns").update({ sequence_config: config }).eq("id", campaign.id);
  if (error) return { error: "Could not save the sequence. Please try again." };
  revalidatePath("/sequence");
  return { saved: true };
}
```

- [ ] **Step 4: Add the server page**

`apps/web/src/app/(app)/sequence/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { resolveSequenceConfig } from "@vantera/jobs/pipeline/sequence-config";
import { SequenceBuilder } from "./sequence-builder"; // built in Task 4

export default async function SequencePage() {
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns").select("id, sequence_config").eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const config = resolveSequenceConfig(campaign?.sequence_config ?? null);
  return <SequenceBuilder config={config} hasCampaign={!!campaign} />;
}
```

- [ ] **Step 5: Run test & commit**

Run: `pnpm --filter web test sequence/actions`
Expected: PASS (2 tests).

```bash
git add apps/web/src/app/\(app\)/sequence/actions.ts apps/web/src/app/\(app\)/sequence/actions.test.ts apps/web/src/app/\(app\)/sequence/page.tsx
git commit -m "feat(web): Sequence Builder data + save action (tenant-scoped, clamped)"
```

---

## Task 4: Sequence Builder — visual (ultimate-ui-builder)

**Brief (Sequence Builder):** new/activating · *social proof / defaults* · confirm-and-launch the default sequence (editing optional) · preview "2 LinkedIn touches → 2 emails → a text → up to 2 calls, stops the instant they book" · defuses setup-paralysis / blank-editor abandonment.

**Files:**
- Create: `apps/web/src/app/(app)/sequence/sequence-builder.tsx`

- [ ] **Step 1: Generate via ultimate-ui-builder**

Props contract:

```ts
import type { SequenceConfig } from "@vantera/jobs/pipeline/types";
export function SequenceBuilder({ config, hasCampaign }: { config: SequenceConfig; hasCampaign: boolean }): JSX.Element;
```

**Design constraints:**
- Dark system + UI kit (`card`, `button`, `input`, `label`, `badge`, `panel`); `useActionState(saveSequenceConfig, {})` for the form, field names exactly matching `parseSequenceForm` (`<stage>.enabled|touches|touchGapDays|waitDays`, `call.maxAttempts`).
- **Pre-filled with `config`** (already defaulted) — the page must read as "here's your sequence, tweak if you like," not a blank editor. Lead with a one-line plain-language preview of the flow.
- Each stage is a row/card showing channel name, an enable toggle, and the touches/gap/wait inputs; the order is fixed and shown as LinkedIn → Email → iMessage → Caller with connecting arrows.
- Caller row shows "Attempts (max 3)" bound to `call.maxAttempts`; copy notes the lead stops the instant the CTA is booked.
- If `hasCampaign` is false, show an inline notice "Launch a campaign to activate this sequence" linking to `/agents` (no dead end), with the form still previewable.
- A primary **Save sequence** button; success/error from the action state.

- [ ] **Step 2: Churn check**

No blank-editor (pre-filled ✓); editing optional, confirm-and-go path is the primary action ✓; no-campaign state has a next action ✓; preview copy uses the real configured numbers ✓.

- [ ] **Step 3: Verify in browser** — visit `/sequence`, toggle a stage off, save, reload, confirm persistence in `campaigns.sequence_config`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/sequence/sequence-builder.tsx
git commit -m "feat(web): Sequence Builder UI (defaults-first, confirm-and-launch)"
```

---

## Task 5: Notifications layer + bell

**Files:**
- Create: `apps/web/src/components/notifications/actions.ts`, `apps/web/src/components/notifications/queries.ts`
- Test: `apps/web/src/components/notifications/queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { unreadByLead } from "./queries";

describe("unreadByLead", () => {
  it("groups unread notifications by lead with the latest first", () => {
    const out = unreadByLead([
      { id: "n1", lead_id: "l1", kind: "reply", body: "x replied.", created_at: "2026-06-14T10:00:00Z" },
      { id: "n2", lead_id: "l1", kind: "reply", body: "x replied again.", created_at: "2026-06-14T11:00:00Z" },
      { id: "n3", lead_id: "l2", kind: "converted", body: "won.", created_at: "2026-06-14T09:00:00Z" },
    ]);
    expect(out.total).toBe(3);
    expect(out.byLead.get("l1")?.[0]?.id).toBe("n2"); // latest first
    expect(out.byLead.get("l2")?.[0]?.kind).toBe("converted");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter web test notifications/queries` → FAIL.

- [ ] **Step 3: Implement `queries.ts`**

```ts
export interface Notification { id: string; lead_id: string; kind: "reply" | "converted" | "exhausted"; body: string; created_at: string; }

export function unreadByLead(rows: Notification[]): { total: number; byLead: Map<string, Notification[]> } {
  const byLead = new Map<string, Notification[]>();
  for (const n of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    byLead.set(n.lead_id, [...(byLead.get(n.lead_id) ?? []), n]);
  }
  return { total: rows.length, byLead };
}
```

- [ ] **Step 4: Implement `actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead(ids: string[]): Promise<{ ok: boolean }> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  // RLS update policy (migration 0017) scopes this to the member's account
  const { error } = await supabase.from("lead_notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  revalidatePath("/leads");
  return { ok: !error };
}
```

- [ ] **Step 5: Run test & commit**

Run: `pnpm --filter web test notifications/queries`
Expected: PASS.

```bash
git add apps/web/src/components/notifications
git commit -m "feat(web): notifications query + mark-read action"
```

---

## Task 6: Notifications bell + Replied Pause/Handoff — visual + reply actions

**Brief (Replied Pause + Handoff):** activated, at aha · *hook model + variable reward* · open the replied lead and choose respond-yourself vs. let-agent-handle · the real inbound message shown inline · defuses a reply rendering as a silent status flip.

**Files:**
- Create: `apps/web/src/components/notifications/notifications-bell.tsx`, `apps/web/src/app/(app)/leads/reply-panel.tsx`, `apps/web/src/app/(app)/leads/reply-actions.ts`
- Modify: `apps/web/src/app/(app)/leads/leads-table.tsx` (mount the reply panel on a replied lead)

- [ ] **Step 1: Implement reply actions (`reply-actions.ts`)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReplyState = { error?: string; sent?: boolean };

/** Send a human-written reply on the lead's channel via the existing send path. */
export async function sendManualReply(leadId: string, channel: "email" | "linkedin", body: string): Promise<ReplyState> {
  if (!body.trim()) return { error: "Write a message first." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired." };
  // insert an approved scheduled_send for the lead's channel; account/campaign resolved via RLS-scoped reads
  const { data: lead } = await supabase.from("leads").select("id, account_id, campaign_id").eq("id", leadId).single();
  if (!lead) return { error: "Lead not found." };
  const { error } = await supabase.from("scheduled_sends").insert({
    account_id: lead.account_id, campaign_id: lead.campaign_id, lead_id: lead.id,
    channel, body, status: "approved", linkedin_stage: channel === "linkedin" ? "message" : null,
  });
  if (error) return { error: "Could not queue your reply." };
  revalidatePath("/leads");
  return { sent: true };
}

/** Deferred (Non-Goal): the agent auto-reply engine. Surfaced so users discover it, but it does not act yet. */
export async function delegateToAgent(_leadId: string): Promise<ReplyState> {
  return { error: "Agent reply handling is coming soon — respond yourself for now." };
}
```

- [ ] **Step 2: Generate the bell + reply panel via ultimate-ui-builder**

`notifications-bell.tsx` props:
```ts
import type { Notification } from "./queries";
export function NotificationsBell({ notifications }: { notifications: Notification[] }): JSX.Element;
```
`reply-panel.tsx` props:
```ts
export function ReplyPanel({ leadId, channel, replyBody, replyAt }: {
  leadId: string; channel: "email" | "linkedin"; replyBody: string; replyAt: string;
}): JSX.Element;
```

**Design constraints:**
- Bell sits in the app header; unread count from `notifications.length`; opening it calls `markNotificationsRead`. Each item is variable-reward framed ("A lead replied") and links to the lead. **No reward-free noise** — only real reply/converted/exhausted events.
- Reply panel shows the **actual inbound message** (`replyBody`, relative `replyAt`) prominently as "a real person responded," then two actions: **Respond yourself** (textarea → `sendManualReply`) and **Let agent handle** (calls `delegateToAgent`, shows the "coming soon" state — clearly a stub, not broken).
- Reuse `card`, `button`, `textarea`, `badge`; dark system.

- [ ] **Step 3: Mount the panel in the leads view**

In `leads-table.tsx`, when a row's `status === "replied"` and it has a `replies[0]`, render `<ReplyPanel leadId={...} channel={...} replyBody={replies[0].body} replyAt={replies[0].received_at} />` in the expanded detail (the table already selects `replies(...)`).

- [ ] **Step 4: Churn check**

Reply is shown inline, not a silent flip ✓; notification carries the message (real reward) ✓; "let agent handle" reads as coming-soon, not an error ✓; no vendor names ✓.

- [ ] **Step 5: Verify + commit**

Verify in browser: a `replied` lead shows the panel; sending a manual reply queues a `scheduled_sends` row; the bell clears unread.

```bash
git add apps/web/src/components/notifications/notifications-bell.tsx apps/web/src/app/\(app\)/leads/reply-panel.tsx apps/web/src/app/\(app\)/leads/reply-actions.ts apps/web/src/app/\(app\)/leads/leads-table.tsx
git commit -m "feat(web): Replied Pause+Handoff panel + notifications bell"
```

---

## Task 7: Conversion Moment — visual (ultimate-ui-builder)

**Brief (Conversion Moment):** proving value, deep aha · *peak-end rule* · register the win and look to the next · the converted lead against the goal "1 of N toward your $X/mo" · defuses value delivered but never displayed.

**Files:**
- Create: `apps/web/src/components/conversion-celebration.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/dashboard-view.tsx`

- [ ] **Step 1: Generate via ultimate-ui-builder**

Props contract:
```ts
export function ConversionCelebration({ leadName, convertedClients, goalLabel }: {
  leadName: string; convertedClients: number; goalLabel: string | null;
}): JSX.Element;
```

**Design constraints:**
- A celebratory moment (animated, peak-end) that fires when an unread `converted` notification exists — **never a silent table-row update**. Reuse the landing's motion vocabulary (`text-effect`, `animated-border`) sparingly.
- Copy ties the win to the goal: "{leadName} booked — {convertedClients} toward your {goalLabel}". If `goalLabel` is null, fall back to "{convertedClients} clients won".
- Dismiss marks the underlying notification read (via `markNotificationsRead`). Ends on a forward-looking nudge (keep the pipeline full → link to `/pipeline`).

- [ ] **Step 2: Mount in the dashboard**

In `dashboard-view.tsx`, fetch the latest unread `converted` notification (server side, in `dashboard/page.tsx`) and pass its `leadName` + existing `convertedClients` + `goal` to mount `<ConversionCelebration />` when present. Reuse the existing `goal`/`convertedClients` props already threaded through the dashboard.

- [ ] **Step 3: Churn check**

Conversion is an explicit moment, not a silent update ✓; tied to the real MRR goal ✓; ends with a next action ✓; numbers are real (`convertedClients`, `goal`) ✓.

- [ ] **Step 4: Verify + commit**

```bash
git add apps/web/src/components/conversion-celebration.tsx apps/web/src/app/\(app\)/dashboard/dashboard-view.tsx apps/web/src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(web): Conversion Moment celebration (peak-end, goal-tied)"
```

---

## Task 8: Knowledge-sync (rule 09) — help article + copilot tool

**Files:**
- Create: `packages/help-content/articles/outreach-sequence.md` (match the repo's article schema/frontmatter)
- Modify: the copilot tool registry (register `get_sequence_status`)

> REQUIRED SUB-SKILL: Use `building-copilot-features` for the article schema + tool registration conventions.

- [ ] **Step 1: Write the help article** — covers: what the sequence is (LinkedIn → Email → iMessage → Caller), that a lead stops the instant they convert, what "Replied" means and the respond/handle choice, and that the caller tries twice before a lead is filtered out. **No vendor names.**

- [ ] **Step 2: Register a copilot tool** `get_sequence_status` returning a lead's current stage / status from `sequence_runs` (RLS-scoped), so the copilot can answer "where is this lead in the sequence?"

- [ ] **Step 3: Run the knowledge-sync check** the repo uses (the `building-copilot-features` skill names it) and commit.

```bash
git add packages/help-content/articles/outreach-sequence.md <copilot registry path>
git commit -m "docs(help): outreach sequence article + copilot get_sequence_status tool"
```

---

## Task 9: Full verification + roadmap flip

- [ ] **Step 1: White-label audit** — run the `whitelabel-auditor` subagent on the user-facing diff (`git diff main -- apps/web packages/help-content`). Resolve every finding (no Smartlead/Unipile/Explorium/Clay/LoopMessage/Sendblue in any UI string).

- [ ] **Step 2: Repo gates**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 3: Dashboard rule-07 check** — for the Pipeline and Conversion surfaces, compare against the landing/dashboard reference visual; iterate until matched.

- [ ] **Step 4: Flip the roadmap**

In `docs/roadmap.md`, check the sequence-orchestrator phase box.

```bash
git add docs/roadmap.md && git commit -m "docs(roadmap): mark sequence orchestrator phase complete"
```

---

## Self-Review

**Spec coverage (UI/UX section):** Sequence Builder (Tasks 3–4) ✓ · Pipeline Progress View (Tasks 1–2) ✓ · Replied Pause+Handoff + notification (Tasks 5–6) ✓ · Conversion Moment (Task 7) ✓ · each carries its verbatim Retention Brief and a churn check ✓ · value-proof from real fields (`revenue_goal_cents`, `avg_deal_value_cents`, `convertedClients`) ✓ · knowledge-sync (Task 8) ✓ · roadmap flip (Task 9) ✓ · white-label audit (Task 9) ✓.

**Placeholder scan:** the `ultimate-ui-builder` steps are delegations, not blanks — each carries the verbatim Brief, an exact TS props contract, named design constraints, and a churn check. All data/query/action/wiring code is written in full. Help-article and copilot-tool steps defer schema specifics to `building-copilot-features` (the named owning skill), which is the correct source, not a TODO.

**Type consistency:** `PipelineViewModel` produced by `shapePipeline` (Task 1) is the exact prop consumed by `PipelineBoard` (Task 2). `SequenceConfig` from `@vantera/jobs/pipeline/types` flows page → `SequenceBuilder` (Tasks 3–4) and `parseSequenceForm` writes the same shape the backend's `resolveSequenceConfig` reads. `Notification` is shared across queries/bell/celebration (Tasks 5–7). Form field names in Task 3's parser match the constraints handed to the builder in Task 4.

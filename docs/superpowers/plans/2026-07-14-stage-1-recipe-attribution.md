# Stage 1 — Message-Level Recipe Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stamp every agent-drafted message with the exact recipe that produced it (strategy knobs, experiment arm, playbook version, exemplar count, drafting brain) and join sends to outcomes — the plumbing the full generate→gate→bandit→measure→decide→remember loop stands on (spec `2026-07-14-self-evolving-brain-positioning-design.md`, Stage 1).

**Architecture:** A versioned `SendRecipe` jsonb stamp on `scheduled_sends`, written at draft time by all three drafting brains (first-touch copy-draft, conversation reply responder, sequence follow-up). Outcome join is query-time (like Stage 0.5's winning-openers): recipe → sent rows → lead outcomes. First visible consumer: honest "receipts" under the What's-working Adopted block ("N messages sent under this play · M interested replies").

**Tech Stack:** Drizzle + plain-SQL migration 0049, pure recipe builder in `@vantera/agent-brains` (rule 13 purity), pipeline stamping in `packages/jobs/src/pipeline/*`, Supabase RLS reads in `apps/web/src/lib/optimize.ts`.

## Global Constraints

- **Rule 13 brain purity:** `packages/agent-brains` imports no Trigger.dev/drizzle/DB (guarded by `purity.test.ts`).
- **Rule 02:** accountId always from validated session / RLS scope; the new column gets NO client write grant (service-role stamped only).
- **Honesty rule (spec):** never backfill or invent attribution — old rows stay `recipe = null`; the receipts line renders only when `sent > 0`. Human-typed (`origin: 'manual'`) sends stay unstamped (no brain wrote them).
- **Voice rules (owner, 2026-07-14):** "gets smarter" vocabulary; NO she/her pronouns for Vera; no SDR framing.
- **Experiment semantics unchanged:** the running prod experiments keep lead-level measurement (`getArmFlags` untouched). Message-level attribution is additive plumbing.
- **Knowledge-sync (rule 09):** user-facing change ⇒ update `packages/help-content/content/optimization.md` in the same change.
- **Gate:** `pnpm lint && pnpm type-check && pnpm test && pnpm build` green before merge to main.
- **Prod ops:** migration applied to prod Supabase (`batyjchztbrqzkcvhkmk`) after merge; Vercel domain is PINNED — `npx vercel promote` + curl live-proof after push.

---

### Task 1: `SendRecipe` type + pure builder (agent-brains)

**Files:**
- Create: `packages/agent-brains/src/optimize/recipe.ts`
- Test: `packages/agent-brains/src/optimize/recipe.test.ts`
- Modify: `packages/agent-brains/src/index.ts` (export the new module)

**Interfaces:**
- Consumes: `CopyStrategy` from `../copy/shared`
- Produces: `type RecipeBrain`, `type SendRecipe`, `function buildSendRecipe(input): SendRecipe` — used by Tasks 3 and 4 via `@vantera/agent-brains`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent-brains/src/optimize/recipe.test.ts
import { describe, expect, it } from "vitest";
import { buildSendRecipe } from "./recipe";

describe("buildSendRecipe", () => {
  it("stamps v1 with full attribution when everything is known", () => {
    expect(
      buildSendRecipe({
        brain: "first_touch",
        strategy: { openWith: "pain" },
        experimentId: "exp-1",
        variant: "challenger",
        playbookVersion: 3,
        exemplars: 2,
      })
    ).toEqual({
      v: 1,
      brain: "first_touch",
      strategy: { openWith: "pain" },
      experimentId: "exp-1",
      variant: "challenger",
      playbookVersion: 3,
      exemplars: 2,
    });
  });

  it("normalizes absent fields to honest nulls/empties (conversation paths)", () => {
    expect(buildSendRecipe({ brain: "conversation_reply" })).toEqual({
      v: 1,
      brain: "conversation_reply",
      strategy: {},
      experimentId: null,
      variant: null,
      playbookVersion: null,
      exemplars: 0,
    });
  });

  it("floors exemplars at 0 and truncates fractions", () => {
    expect(buildSendRecipe({ brain: "sequence_followup", exemplars: -1 }).exemplars).toBe(0);
    expect(buildSendRecipe({ brain: "sequence_followup", exemplars: 2.7 }).exemplars).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/agent-brains test -- run src/optimize/recipe.test.ts`
Expected: FAIL — `Cannot find module './recipe'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/agent-brains/src/optimize/recipe.ts
import type { CopyStrategy } from "../copy/shared";

/**
 * Message-level recipe attribution (Vera Stage 1, spec 2026-07-14). Every agent-drafted
 * message is stamped at draft time with the recipe that produced it, so outcomes can be
 * joined to the exact approach — the data spine the bandit loop will stand on. Pure.
 */

/** Which drafting brain produced the message. `origin` on the row says which LANE queued it;
 *  this says which BRAIN wrote it (first-touch and follow-ups both ride origin='sequence'). */
export type RecipeBrain = "first_touch" | "conversation_reply" | "sequence_followup";

export type SendRecipe = {
  /** stamp schema version — bump when the shape changes so old stamps stay parseable */
  v: 1;
  brain: RecipeBrain;
  /** the copy knobs that shaped THIS draft ({} = no strategy directives were applied) */
  strategy: CopyStrategy;
  /** the experiment the lead is enrolled in (null = drafted outside any experiment) */
  experimentId: string | null;
  variant: "champion" | "challenger" | null;
  /** optimization_playbook.version at draft time (null = no playbook / not consulted) */
  playbookVersion: number | null;
  /** how many winning exemplars were injected into the prompt (Stage 0.5 memory) */
  exemplars: number;
};

/** Normalizing constructor: absent facts become honest nulls — never invented. */
export function buildSendRecipe(input: {
  brain: RecipeBrain;
  strategy?: CopyStrategy | null;
  experimentId?: string | null;
  variant?: "champion" | "challenger" | null;
  playbookVersion?: number | null;
  exemplars?: number;
}): SendRecipe {
  return {
    v: 1,
    brain: input.brain,
    strategy: input.strategy ?? {},
    experimentId: input.experimentId ?? null,
    variant: input.variant ?? null,
    playbookVersion: input.playbookVersion ?? null,
    exemplars: Math.max(0, Math.floor(input.exemplars ?? 0)),
  };
}
```

- [ ] **Step 4: Export from the package index**

In `packages/agent-brains/src/index.ts`, next to the existing `./optimize/experiment` exports, add:

```ts
export { buildSendRecipe } from "./optimize/recipe";
export type { SendRecipe, RecipeBrain } from "./optimize/recipe";
```

(Match the file's existing export style exactly — check whether it uses `export *` or named exports and follow it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @vantera/agent-brains test -- run src/optimize/recipe.test.ts`
Expected: PASS (3 tests). Also run the purity guard: `pnpm --filter @vantera/agent-brains test -- run src/purity.test.ts` — PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/agent-brains/src/optimize/recipe.ts packages/agent-brains/src/optimize/recipe.test.ts packages/agent-brains/src/index.ts
git commit -m "feat(brains): SendRecipe v1 — message-level recipe stamp type + pure builder (Stage 1)"
```

---

### Task 2: Migration 0049 + drizzle column

**Files:**
- Create: `packages/db/migrations/0049_send_recipe.sql`
- Modify: `packages/db/src/schema.ts` (scheduledSends table, after the `origin` column ~line 410)

**Interfaces:**
- Produces: `scheduledSends.recipe` (jsonb, nullable) — written by Task 3/4 via `toRow`, read by Task 5 via PostgREST `recipe->>...` filters.

- [ ] **Step 1: Write the migration**

```sql
-- 0049: message-level recipe attribution (Vera Stage 1, spec 2026-07-14).
-- Every agent-drafted scheduled_send is stamped at draft time with the recipe that
-- produced it: {v, brain, strategy, experimentId, variant, playbookVersion, exemplars}.
-- NULL = drafted before this migration OR human-typed (origin 'manual') — attribution is
-- never backfilled or invented (honesty rule). Service-role write only (the drafting
-- pipelines); members read via the existing scheduled_sends select policy — no client
-- write grant on purpose (column-grant gotcha, 0038→0039).
alter table scheduled_sends add column if not exists recipe jsonb;

comment on column scheduled_sends.recipe is
  'Draft-time recipe stamp (SendRecipe v1): {v, brain, strategy, experimentId, variant, playbookVersion, exemplars}. Null = pre-Stage-1 row or human-typed message.';
```

- [ ] **Step 2: Add the drizzle column**

In `packages/db/src/schema.ts`, in `scheduledSends` directly after the `origin` column:

```ts
    // 0049: message-level recipe attribution (Vera Stage 1) — the SendRecipe stamp written at
    // draft time by the drafting pipelines. Null = pre-Stage-1 row or human-typed message.
    recipe: jsonb("recipe"),
```

- [ ] **Step 3: Run the schema guardrail tests**

Run: `pnpm --filter @vantera/db test`
Expected: PASS (no new table ⇒ no new RLS requirement; existing policies cover the column).

- [ ] **Step 4: Commit**

```bash
git add packages/db/migrations/0049_send_recipe.sql packages/db/src/schema.ts
git commit -m "feat(db): 0049 scheduled_sends.recipe — message-level recipe stamp column"
```

---

### Task 3: Stamp first-touch drafts (copy-draft pipeline)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (`NewScheduledSend`, `CopyDraftStore`)
- Modify: `packages/jobs/src/pipeline/copy-draft.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getChampion`, `toRow`)
- Test: `packages/jobs/src/pipeline/copy-draft.test.ts`

**Interfaces:**
- Consumes: `buildSendRecipe`, `SendRecipe` from `@vantera/agent-brains` (Task 1); `scheduledSends.recipe` (Task 2)
- Produces: `CopyDraftStore.getChampion(accountId): Promise<{ strategy: CopyStrategy; version: number | null }>` — REPLACES `getChampionStrategy` (rename all fakes/implementations); `NewScheduledSend.recipe?: SendRecipe | null`

- [ ] **Step 1: Write the failing tests**

Add to `packages/jobs/src/pipeline/copy-draft.test.ts` (adapt the file's existing fake-store builder — it currently fakes `getChampionStrategy`; rename that fake to `getChampion` returning `{ strategy, version }` everywhere in the file):

```ts
it("stamps both rows of the pair with the first-touch recipe (experiment arm)", async () => {
  // fake store: active experiment {id: "exp-1", allocationPct: 100, challengerStrategy: {openWith: "pain"}},
  // getChampion → { strategy: { openWith: "trigger" }, version: 2 }, winningOpeners: ["Saw the Series B"]
  // allocationPct 100 ⇒ assignVariant always "challenger"
  const { deps, inserted } = makeDeps(/* per this file's existing helper style */);
  await runCopyDraft(payload, deps);
  const [invite, message] = inserted[0]; // the insertLinkedInSendPair capture
  for (const row of [invite, message]) {
    expect(row.recipe).toEqual({
      v: 1,
      brain: "first_touch",
      strategy: { openWith: "pain" },
      experimentId: "exp-1",
      variant: "challenger",
      playbookVersion: 2,
      exemplars: 1,
    });
  }
});

it("stamps a champion recipe with null experiment when nothing is running", async () => {
  // fake store: getActiveExperiment → null, getChampion → { strategy: {}, version: null }, winningOpeners: []
  const { deps, inserted } = makeDeps(/* no experiment */);
  await runCopyDraft(payload, deps);
  const [invite] = inserted[0];
  expect(invite.recipe).toEqual({
    v: 1,
    brain: "first_touch",
    strategy: {},
    experimentId: null,
    variant: null,
    playbookVersion: null,
    exemplars: 0,
  });
});
```

(Write them against the file's real helper names — read the existing tests first and reuse their fixtures; the assertions above are the contract.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/jobs test -- run src/pipeline/copy-draft.test.ts`
Expected: FAIL — `recipe` undefined / `getChampion` not a function.

- [ ] **Step 3: Update types.ts**

In `NewScheduledSend` add:

```ts
  /** message-level recipe stamp (Stage 1) — null/omitted only for human-typed sends */
  recipe?: SendRecipe | null;
```

Import `SendRecipe` in the type import block from `@vantera/agent-brains`. In `CopyDraftStore`, replace:

```ts
  /** the account's adopted champion copy strategy; {} (no directives = pre-optimizer) when none */
  getChampionStrategy(accountId: string): Promise<CopyStrategy>;
```

with:

```ts
  /** the account's adopted champion strategy + playbook version; {strategy:{}, version:null} when none */
  getChampion(accountId: string): Promise<{ strategy: CopyStrategy; version: number | null }>;
```

- [ ] **Step 4: Update copy-draft.ts**

```ts
import { describeViolations, assignVariant, buildSendRecipe } from "@vantera/agent-brains";
// ...
const experiment = await deps.store.getActiveExperiment(accountId);
const champion = await deps.store.getChampion(accountId);
// ... inside the per-lead callback:
const variant = experiment ? assignVariant(experiment, lead.id) : null;
const strategy = variant === "challenger" ? experiment!.challengerStrategy : champion.strategy;
const input = toDraftInput(lead, ctx, strategy);
// ...
// Stage 1: stamp the pair with the recipe that produced it — outcomes join back to this.
const recipe = buildSendRecipe({
  brain: "first_touch",
  strategy,
  experimentId: experiment?.id ?? null,
  variant,
  playbookVersion: champion.version,
  exemplars: (ctx.winningOpeners ?? []).length,
});
const common = {
  accountId,
  campaignId,
  leadId: lead.id,
  channel: "linkedin" as const,
  subject: null,
  status,
  styleFlags: flags,
  recipe,
};
```

- [ ] **Step 5: Update pg-store.ts**

Replace `getChampionStrategy` implementation with:

```ts
    async getChampion(accountId) {
      const [row] = await db
        .select({
          championStrategy: optimizationPlaybook.championStrategy,
          version: optimizationPlaybook.version,
        })
        .from(optimizationPlaybook)
        .where(eq(optimizationPlaybook.accountId, accountId))
        .limit(1);
      return {
        strategy: (row?.championStrategy ?? {}) as CopyStrategy,
        version: row?.version ?? null,
      };
    },
```

And in `toRow` add `recipe: send.recipe ?? null,`.

- [ ] **Step 6: Sweep remaining `getChampionStrategy` references**

Run: `grep -rn "getChampionStrategy" packages/ apps/` — rename every remaining fake/caller (expected: only jobs tests). Expected result after sweep: zero hits.

- [ ] **Step 7: Run the jobs suite**

Run: `pnpm --filter @vantera/jobs test`
Expected: PASS (new tests + all existing suites — the existing copy-draft tests updated for `getChampion`).

- [ ] **Step 8: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/copy-draft.ts packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/pipeline/copy-draft.test.ts
git commit -m "feat(jobs): stamp first-touch draft pairs with their SendRecipe (Stage 1)"
```

---

### Task 4: Stamp conversation sends (inbound responder + sequence follow-up)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (`ResponderBundle`)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getResponderBundle`)
- Modify: `packages/jobs/src/pipeline/inbound.ts:141`
- Modify: `packages/jobs/src/pipeline/sequence-touch.ts:113`
- Test: `packages/jobs/src/pipeline/inbound.test.ts`, `packages/jobs/src/pipeline/sequence-touch.test.ts`

**Interfaces:**
- Consumes: `buildSendRecipe` (Task 1); `NewScheduledSend.recipe` (Task 3)
- Produces: `ResponderBundle.attribution: { experimentId: string | null; variant: "champion" | "challenger" | null }` — every fake bundle in tests must add it.

- [ ] **Step 1: Write the failing tests**

In `inbound.test.ts` (reusing its existing responder fixtures; set `attribution: { experimentId: "exp-9", variant: "champion" }` on the fake bundle):

```ts
it("stamps the contextual reply with a conversation_reply recipe carrying the lead's arm", async () => {
  // drive the existing auto-reply path; capture insertScheduledSend
  expect(insertedSend.recipe).toEqual({
    v: 1,
    brain: "conversation_reply",
    strategy: {},
    experimentId: "exp-9",
    variant: "champion",
    playbookVersion: null,
    exemplars: 0,
  });
});
```

In `sequence-touch.test.ts` (fake bundle `attribution: { experimentId: null, variant: null }`):

```ts
it("stamps the proactive follow-up with a sequence_followup recipe", async () => {
  expect(insertedSend.recipe).toEqual({
    v: 1,
    brain: "sequence_followup",
    strategy: {},
    experimentId: null,
    variant: null,
    playbookVersion: null,
    exemplars: 0,
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @vantera/jobs test -- run src/pipeline/inbound.test.ts src/pipeline/sequence-touch.test.ts`
Expected: FAIL — `attribution` missing on bundle type / `recipe` undefined.

- [ ] **Step 3: Extend ResponderBundle in types.ts**

```ts
  /** the lead's experiment-arm stamp (0040, lead-level) — carried onto every conversation
   *  send's recipe so message-level attribution never loses the arm (Stage 1) */
  attribution: { experimentId: string | null; variant: "champion" | "challenger" | null };
```

- [ ] **Step 4: Populate it in pg-store getResponderBundle**

The bundle already selects the full lead row. In the return object add:

```ts
        attribution: {
          experimentId: lead.experimentId ?? null,
          variant: (lead.strategyVariant as "champion" | "challenger" | null) ?? null,
        },
```

- [ ] **Step 5: Stamp in inbound.ts**

In the `insertScheduledSend` call at `inbound.ts:141`, add:

```ts
    // Stage 1: conversation replies carry the lead's arm so message-level attribution is complete.
    recipe: buildSendRecipe({
      brain: "conversation_reply",
      experimentId: bundle.attribution.experimentId,
      variant: bundle.attribution.variant,
    }),
```

Import `buildSendRecipe` from `@vantera/agent-brains` (the file already imports `describeViolations` from there).

- [ ] **Step 6: Stamp in sequence-touch.ts**

In the `send: NewScheduledSend` literal (~line 113), add:

```ts
    recipe: buildSendRecipe({
      brain: "sequence_followup",
      experimentId: bundle.attribution.experimentId,
      variant: bundle.attribution.variant,
    }),
```

Same import addition.

- [ ] **Step 7: Fix every fake bundle + run the jobs suite**

Run: `pnpm --filter @vantera/jobs test`
Expected: type errors first (every fake `ResponderBundle` in inbound/sequence-touch tests needs `attribution`) — add `attribution: { experimentId: null, variant: null }` to each, except the fixtures the new tests parameterize. Then: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/pipeline/inbound.ts packages/jobs/src/pipeline/sequence-touch.ts packages/jobs/src/pipeline/inbound.test.ts packages/jobs/src/pipeline/sequence-touch.test.ts
git commit -m "feat(jobs): stamp conversation replies + follow-ups with their SendRecipe (Stage 1)"
```

---

### Task 5: Receipts on the What's-working panel (send→outcome join, first consumer)

**Files:**
- Modify: `apps/web/src/lib/optimize.ts` (`lastAdoption.receipts` + pure helper)
- Test: `apps/web/src/lib/optimize.test.ts` (new file, pure helper only)
- Modify: `apps/web/src/app/(app)/analytics/outreach-diagnosis.tsx` (Adopted block)

**Interfaces:**
- Consumes: `scheduled_sends.recipe` via PostgREST jsonb filters (RLS-scoped)
- Produces: `OutreachDiagnosisVM["lastAdoption"]` gains `receipts: { sent: number; interested: number } | null`

- [ ] **Step 1: Write the failing test for the pure join helper**

```ts
// apps/web/src/lib/optimize.test.ts
import { describe, expect, it } from "vitest";
import { countInterestedSince } from "./optimize";

describe("countInterestedSince", () => {
  const interested = [
    { lead_id: "a", received_at: "2026-07-10T00:00:00Z" },
    { lead_id: "a", received_at: "2026-07-12T00:00:00Z" }, // same lead twice → 1
    { lead_id: "b", received_at: "2026-07-01T00:00:00Z" }, // before adoption → excluded
    { lead_id: "c", received_at: "2026-07-13T00:00:00Z" }, // lead not in stamped set → excluded
  ];
  it("counts distinct stamped leads with an interested reply after adoption", () => {
    expect(
      countInterestedSince(new Set(["a", "b"]), interested, "2026-07-05T00:00:00Z")
    ).toBe(1);
  });
  it("null concludedAt counts all stamped interested leads", () => {
    expect(countInterestedSince(new Set(["a", "b"]), interested, null)).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test -- run src/lib/optimize.test.ts`
Expected: FAIL — `countInterestedSince` not exported.

- [ ] **Step 3: Implement helper + receipts query in lib/optimize.ts**

Export the pure helper:

```ts
/** Distinct stamped leads with an interested reply after the adoption moment (Stage 1 receipts). Pure. */
export function countInterestedSince(
  stampedLeadIds: Set<string>,
  interested: { lead_id: string; received_at: string }[],
  concludedAt: string | null
): number {
  const cutoff = concludedAt ? new Date(concludedAt).getTime() : null;
  const winners = new Set<string>();
  for (const r of interested) {
    if (!stampedLeadIds.has(r.lead_id)) continue;
    if (cutoff !== null && new Date(r.received_at).getTime() <= cutoff) continue;
    winners.add(r.lead_id);
  }
  return winners.size;
}
```

Extend the VM type:

```ts
  lastAdoption: {
    experimentId: string;
    label: string;
    reason: string | null;
    concludedAt: string | null;
    /** real message-level receipts (Stage 1): sends stamped with the CURRENT playbook version.
     *  null until at least one stamped send exists — numbers are never invented. */
    receipts: { sent: number; interested: number } | null;
  } | null;
```

After the `adoptedRow` block, when `lastAdoption` is non-null, fetch receipts (change the earlier `interestedRes` select to `select("lead_id, received_at")` so it can be reused here):

```ts
  let receipts: { sent: number; interested: number } | null = null;
  if (lastAdoption) {
    const { data: pb } = await db
      .from("optimization_playbook")
      .select("version")
      .maybeSingle<{ version: number }>();
    if (pb?.version) {
      const { data: stamped } = await db
        .from("scheduled_sends")
        .select("lead_id")
        .eq("status", "sent")
        .eq("recipe->>playbookVersion", String(pb.version));
      const stampedRows = (stamped ?? []) as { lead_id: string }[];
      if (stampedRows.length > 0) {
        receipts = {
          sent: stampedRows.length,
          interested: countInterestedSince(
            new Set(stampedRows.map((r) => r.lead_id)),
            (interestedRes.data ?? []) as { lead_id: string; received_at: string }[],
            lastAdoption.concludedAt
          ),
        };
      }
    }
  }
```

Attach `receipts` to the returned `lastAdoption` object.

- [ ] **Step 4: Run the helper test**

Run: `pnpm --filter web test -- run src/lib/optimize.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the receipts line in outreach-diagnosis.tsx**

In the Adopted block (find `lastAdoption` usage), under the reason line, add — voice: pronoun-free, real numbers only:

```tsx
{vm.lastAdoption.receipts && (
  <p className="mt-1.5 text-[12.5px] text-[var(--ink-3)]">
    Since this change: {vm.lastAdoption.receipts.sent}{" "}
    {vm.lastAdoption.receipts.sent === 1 ? "message" : "messages"} sent
    {vm.lastAdoption.receipts.interested > 0 && (
      <> · {vm.lastAdoption.receipts.interested} interested{" "}
      {vm.lastAdoption.receipts.interested === 1 ? "reply" : "replies"}</>
    )}
  </p>
)}
```

(Match the block's existing classes/tokens — read the surrounding JSX and reuse its text styles.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/optimize.ts apps/web/src/lib/optimize.test.ts "apps/web/src/app/(app)/analytics/outreach-diagnosis.tsx"
git commit -m "feat(web): real per-recipe receipts under the What's-working adopted block (Stage 1)"
```

---

### Task 6: Knowledge sync (rule 09)

**Files:**
- Modify: `packages/help-content/content/optimization.md`

- [ ] **Step 1: Add the receipts section**

After the section describing adoption/what's-working (read the article; match its tone), add:

```markdown
## Every message keeps its receipt

Every message Vera drafts is stamped with the exact approach used to write it — which
opener style, which test it belonged to, which version of your playbook. When a change
is adopted, the panel shows the real numbers behind it: how many messages have gone out
under the new approach and how many earned an interested reply. The numbers are always
your real results — never estimates, and never shown before at least one message has
actually been sent.
```

- [ ] **Step 2: Run help-content tests (vendor-name guard)**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/help-content/content/optimization.md
git commit -m "docs(help): message receipts — recipe attribution explained (knowledge-sync)"
```

---

### Task 7: Full gate, merge, prod migration, deploy proof (verification mandate)

- [ ] **Step 1: Full gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green. Fix anything red before proceeding.

- [ ] **Step 2: Merge to main + push**

```bash
git push origin main
```

(Trigger.dev auto-deploys packages/jobs from main; Vercel builds apps/web.)

- [ ] **Step 3: Apply 0049 to prod Supabase**

Via Supabase MCP `apply_migration` on project `batyjchztbrqzkcvhkmk` with the 0049 SQL, then verify: `select column_name from information_schema.columns where table_name='scheduled_sends' and column_name='recipe';` returns 1 row. **Apply BEFORE the new Trigger worker goes live** (the stamp write needs the column).

- [ ] **Step 4: Promote + live-proof (pinned domain)**

```bash
npx vercel ls vantera-web --scope tradsy   # newest Production deployment for the new commit
npx vercel promote <deployment-url> --scope tradsy --yes
curl -sL https://www.vanterasystem.dev/ | grep -c "Self-learning lead gen"   # sanity: site serves
```

- [ ] **Step 5: Real-readiness verification (no hallucinating)**

1. Trigger MCP: confirm a new prod worker version deployed after the merge.
2. Prod DB: confirm the two running experiments are untouched (`select id, status from optimization_experiments where status='running';` → same 2 rows).
3. End-to-end stamp proof: after the next copy-draft/sequence cron cycle, `select recipe from scheduled_sends where recipe is not null order by created_at desc limit 3;` shows v1 stamps. If no cycle has run yet, state that honestly and add it to the monitor list — never claim the stamp is proven live until a real row shows it.

- [ ] **Step 6: Update memory + report**

Update `project-vantera-self-evolving-brain.md` (Stage 1 shipped state + what remains: bandit/open-ended recipes are Stage 1b) and the MEMORY.md hook line.

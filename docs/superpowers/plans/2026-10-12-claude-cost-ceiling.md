# Claude per-user cost ceiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hold Claude spend for one active $79 user at about $15/month without moving prospect-facing copy off Sonnet 4.6, and without lowering the existing eval floors.

**Architecture:** `@vantera/ai` grows a second pin, `getClassifierModel()`, fixed to Haiku 4.5 unless `ANTHROPIC_CLASSIFIER_MODEL` is set. It does not follow `ANTHROPIC_MODEL`, so a draft-model override cannot drag ranking and classification back onto Sonnet. Prospect-facing brains (`draftLinkedIn`, `draftConversationMessage`, `fixLinkedInDraft`, `fixConversationMessage`) keep `getModel()` (Sonnet 4.6). First-touch drafting gains a hard cap of 15 invite drafts per account per UTC day inside `runCopyDraft`, after suppression and after best-first ordering, so overflow leads stay qualified for tomorrow. Reply and sequence messages are not capped. Best-of-N stays default 1. Public tools stay on `getPublicModel()` (Vercel AI Gateway), off the console key that bills per user. Nightly evals stay funded as a platform cost and must score classifiers on Haiku and drafts on Sonnet, or a green run does not describe production.

**Tech Stack:** TypeScript strict, Vitest 4, Vercel AI SDK `generateObject`, models only via `@vantera/ai`, Trigger.dev jobs, existing eval floors in `@vantera/evals`.

**Spec:** This plan is the spec. The cost rules it implements, copied from the 2026-10-12 decision:

- Sonnet 4.6 only for text a prospect reads (first touch, reply, and the one style-fix rewrite of those).
- Haiku 4.5 for rank, intent classification, and reply classification. Also for the infrequent non-prospect calls: website scan, ICP draft, criteria derive, intent watchlist, optimizer angle generation.
- At most 15 first-touch drafts per account per UTC day. Scout may still look at up to 60 prospects. Leads over the cap are not drafted and are not marked skipped.
- `best_of_n` stays unset. Absent setting means 1 draft and zero judge calls, including when `judgeFn` is wired.
- Public LinkedIn tools do not call `api.anthropic.com`. Nightly evals are not part of the $15. Do not disable them.
- Floors stay: reply interested recall ≥ 0.90, intent recall ≥ 0.85, intent precision ≥ 0.80, hard-intent precision ≥ 0.85, rank qualify precision ≥ 0.80, rank qualify recall ≥ 0.85, live copy lint pass rate ≥ 0.90.

## Global Constraints

- Models only through `@vantera/ai`. No new `@ai-sdk/*` or `@anthropic-ai/*` import outside `packages/ai`.
- No vendor name (Anthropic, Claude, Haiku, Sonnet, Opus) in UI, help articles, API error strings, or copilot copy.
- `accountId` only from the validated session or the job payload the scheduler already scoped. Never from a request body on this work.
- Suppression still runs before any draft. A capped lead is not a suppressed lead.
- Do not change `PLAN_DISPLAY` prices. $79 stays the price. $15 is the Claude ceiling.
- Do not set `app_settings.best_of_n` in any migration or seed.
- TDD: failing test, then implementation, per task.

## Review Focus

- A lead past the daily cap must remain draftable the next UTC day. Marking it `skipped` would drop it forever. Test in Task 4.
- A reply or sequence follow-up must still draft when the account already has 15 invites today. Test in Task 4 (the counter ignores `linkedin_stage = 'message'`).
- `ANTHROPIC_MODEL=claude-opus-4-8` must not change `getClassifierModel()`. Test in Task 1.
- Live evals must pass Haiku into the classifier floors and Sonnet into the copy gate. A floor run that still calls `getModel()` would certify the wrong model. Test in Task 3.
- `judgeFn` wired and `bestOfN` omitted must still draft once and never call the judge. Already covered in `copy-draft.test.ts` ("bestOfN=1 with a judgeFn wired"). Task 4 re-asserts it next to the cap so a cap refactor cannot turn N back on.

---

### Task 1: Classifier model pin

**Files:**
- Modify: `packages/ai/src/client.ts`
- Modify: `packages/ai/src/client.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Consumes: existing `getModel(modelId?: string)` — an explicit id bypasses `ANTHROPIC_MODEL`.
- Produces:
  - `export const CLASSIFIER_MODEL_ID = "claude-haiku-4-5-20251001"`
  - `export function getClassifierModel(): LanguageModel` — uses `process.env.ANTHROPIC_CLASSIFIER_MODEL` when set, otherwise `CLASSIFIER_MODEL_ID`. Never reads `ANTHROPIC_MODEL`.
  - `getModel()` / `getModelId()` unchanged (default `claude-sonnet-4-6`).

- [ ] **Step 1: Write the failing test**

Add to `packages/ai/src/client.test.ts` inside the existing env save/restore pattern:

```ts
describe("getClassifierModel", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_CLASSIFIER_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses Haiku and ignores ANTHROPIC_MODEL", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    expect(getClassifierModel().modelId).toBe("claude-haiku-4-5-20251001");
    expect(getModel().modelId).toBe("claude-opus-4-8");
  });

  it("honors ANTHROPIC_CLASSIFIER_MODEL only", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_CLASSIFIER_MODEL = "claude-haiku-4-5";
    expect(getClassifierModel().modelId).toBe("claude-haiku-4-5");
  });
});
```

Import `getClassifierModel` from `./client`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/ai test src/client.test.ts`

Expected: FAIL — `getClassifierModel` is not exported.

- [ ] **Step 3: Implement**

In `packages/ai/src/client.ts`, next to `DEFAULT_MODEL`:

```ts
/** Rank, intent, and reply classification. Not the draft model. Does not follow ANTHROPIC_MODEL. */
export const CLASSIFIER_MODEL_ID = "claude-haiku-4-5-20251001";

export function getClassifierModel() {
  const id = process.env.ANTHROPIC_CLASSIFIER_MODEL?.trim() || CLASSIFIER_MODEL_ID;
  return getModel(id);
}
```

Export `getClassifierModel` and `CLASSIFIER_MODEL_ID` from `packages/ai/src/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vantera/ai test src/client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/client.ts packages/ai/src/client.test.ts packages/ai/src/index.ts
git commit -m "feat(ai): pin classifiers to Haiku without following the draft model"
```

---

### Task 2: Point non-draft brains at Haiku

**Files:**
- Modify: `packages/agent-brains/src/prospect/rank.ts` (default model arg)
- Modify: `packages/agent-brains/src/intent/classify.ts`
- Modify: `packages/agent-brains/src/reply/classify.ts`
- Modify: `packages/agent-brains/src/prospect/website-scan.ts`
- Modify: `packages/agent-brains/src/prospect/icp-draft.ts`
- Modify: `packages/agent-brains/src/prospect/derive-criteria.ts`
- Modify: `packages/agent-brains/src/intent/watchlist.ts`
- Modify: `packages/agent-brains/src/optimize/generate.ts`
- Create: `packages/agent-brains/src/model-split.test.ts`
- Do not modify: `packages/agent-brains/src/copy/linkedin.ts`, `packages/agent-brains/src/reply/respond.ts`, `packages/agent-brains/src/copy/fix.ts`, `packages/agent-brains/src/copy/judge.ts`

**Interfaces:**
- Consumes: `getClassifierModel` from `@vantera/ai`.
- Produces: those eight functions default their `model` argument to `getClassifierModel()`. Draft and fix functions still default to `getModel()`. Judge still defaults to `getModel("claude-opus-4-8")`.

- [ ] **Step 1: Write the failing test**

`packages/agent-brains/src/model-split.test.ts` reads source so it fails before the defaults change and does not call the network:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function src(rel: string): string {
  return readFileSync(join(__dirname, rel), "utf8");
}

const HAIKU = [
  "prospect/rank.ts",
  "intent/classify.ts",
  "reply/classify.ts",
  "prospect/website-scan.ts",
  "prospect/icp-draft.ts",
  "prospect/derive-criteria.ts",
  "intent/watchlist.ts",
  "optimize/generate.ts",
];

const SONNET = ["copy/linkedin.ts", "reply/respond.ts", "copy/fix.ts"];

describe("model split", () => {
  it.each(HAIKU)("%s defaults to getClassifierModel", (rel) => {
    const text = src(rel);
    expect(text).toContain("getClassifierModel");
    expect(text).not.toMatch(/model[^=]*=\s*getModel\(\)/);
  });

  it.each(SONNET)("%s still defaults to getModel()", (rel) => {
    expect(src(rel)).toMatch(/getModel\(\)/);
    expect(src(rel)).not.toContain("getClassifierModel");
  });

  it("the copy judge stays on the Opus pin", () => {
    expect(src("copy/judge.ts")).toContain('JUDGE_MODEL_ID = "claude-opus-4-8"');
  });
});
```

The Haiku assertion `model[^=]*=\s*getModel\(\)` is meant to catch a default parameter `model = getModel()` and a fallback `options.model ?? getModel()`. It must not match `getClassifierModel`. If `website-scan.ts` uses `options.model ?? getModel()`, the negative regex must be updated to also reject `?? getModel()` — write the test against the real line, then change that line to `options.model ?? getClassifierModel()`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/agent-brains test src/model-split.test.ts`

Expected: FAIL — rank.ts does not contain `getClassifierModel`.

- [ ] **Step 3: Implement**

In each Haiku file, change the import from `getModel` to `getClassifierModel` (keep `getModel` if the file still needs it — none of the eight should). Replace the default `getModel()` with `getClassifierModel()`.

`website-scan.ts` today uses `options.model ?? getModel()`. Change that to `options.model ?? getClassifierModel()`.

Leave `linkedin.ts`, `respond.ts`, `fix.ts`, and `judge.ts` on `getModel` / `JUDGE_MODEL_ID`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @vantera/agent-brains test src/model-split.test.ts src/prospect/rank.test.ts src/intent/classify.test.ts src/reply/classify.test.ts src/purity.test.ts`

Expected: PASS. Existing brain tests inject a mock model, so they do not hit the new default.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src
git commit -m "feat(brains): score and classify on Haiku, draft on Sonnet"
```

---

### Task 3: Evals measure the models production uses

**Files:**
- Modify: `packages/evals/src/ci.ts` (the `main()` model wiring around the `runReplyFloors` / `runIntentFloors` / `runIntentHardFloors` / `runRankFloors` calls)
- Modify: `packages/evals/src/run-classifier.ts` (default parameters only)
- Modify: `packages/evals/src/ci.test.ts`
- Modify: `docs/evals.md` (the Cost section — one paragraph, no new workflow)

**Interfaces:**
- Consumes: `getModel`, `getClassifierModel` from `@vantera/ai`. `JUDGE_MODEL_ID` stays `claude-opus-4-8`.
- Produces: `main()` calls `runReplyFloors(classifierModel)`, `runIntentFloors(classifierModel)`, `runIntentHardFloors(classifierModel)`, `runRankFloors(classifierModel)` where `classifierModel = getClassifierModel()`. `runDeterministic("live", draftingModel)` and `generateLiveCandidates(draftingModel)` still use `getModel()`.

- [ ] **Step 1: Write the failing test**

In `packages/evals/src/ci.test.ts`, add a source-level test (this file already unit-tests `decide()` with fixtures; do not boot a live model):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("live evals score classifiers on getClassifierModel and drafts on getModel", () => {
  const ci = readFileSync(join(__dirname, "ci.ts"), "utf8");
  expect(ci).toContain("getClassifierModel()");
  expect(ci).toContain("runReplyFloors(classifierModel)");
  expect(ci).toContain("runIntentFloors(classifierModel)");
  expect(ci).toContain("runIntentHardFloors(classifierModel)");
  expect(ci).toContain("runRankFloors(classifierModel)");
  expect(ci).toContain("runDeterministic(\"live\", draftingModel)");
  expect(ci).not.toMatch(/runReplyFloors\(\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vantera/evals test src/ci.test.ts`

Expected: FAIL — `ci.ts` still calls `runReplyFloors()` with no argument.

- [ ] **Step 3: Implement**

In `packages/evals/src/ci.ts` `main()`, after `const draftingModel = getModel()`:

```ts
const classifierModel = getClassifierModel();
```

Pass `classifierModel` into the four floor runners. Leave `draftingModel` and `judgeModel` as they are.

In `packages/evals/src/run-classifier.ts`, change the default parameters of `runReplyFloors`, `runIntentFloors`, `runIntentHardFloors`, and `runRankFloors` from `getModel()` to `getClassifierModel()` so a future caller that omits the argument still measures production.

In `docs/evals.md`, replace the sentence that says the live run is "around $2-5 per run" with:

```markdown
Classifier floors run on `getClassifierModel()` (Haiku 4.5). The copy gate, pairwise drafts, and the judge stay on Sonnet 4.6 and Opus 4.8. That split is the production split. A green floor on Sonnet would not describe production. Budget stays about $2-5 per nightly run ($50-100/month) and is a platform cost, not part of the per-user $15 ceiling.
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @vantera/evals test`

Expected: PASS (129+ tests, mock models, no network).

- [ ] **Step 5: Commit**

```bash
git add packages/evals/src/ci.ts packages/evals/src/ci.test.ts packages/evals/src/run-classifier.ts docs/evals.md
git commit -m "test(evals): measure classifier floors on the Haiku production pin"
```

---

### Task 4: Cap first-touch drafts at 15 per account per UTC day

**Files:**
- Modify: `packages/jobs/src/pipeline/copy-draft.ts`
- Modify: `packages/jobs/src/pipeline/copy-draft.test.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (`CopyDraftStore`, `CopyDraftSummary`)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`countFirstTouchDraftsSince`)

**Interfaces:**
- Consumes: `scheduled_sends.linkedin_stage`, `scheduled_sends.created_at`, `scheduled_sends.account_id`.
- Produces:
  - `export const DAILY_FIRST_TOUCH_DRAFT_CAP = 15`
  - `CopyDraftStore.countFirstTouchDraftsSince(accountId: string, since: Date): Promise<number>` — count of `linkedin_stage = 'invite'` rows for that account with `created_at >= since`.
  - `CopyDraftSummary.deferred: number` — leads left undrafted because the cap was full. They are not `skipped`.

- [ ] **Step 1: Write the failing tests**

`copy-draft.test.ts` already has `function lead(id, overrides)` and `class FakeCopyStore`. Add a field and method on `FakeCopyStore`:

```ts
firstTouchDraftsToday = 0;
async countFirstTouchDraftsSince() {
  return this.firstTouchDraftsToday;
}
```

`lead()` does not take a score. `StoredInsights` does have `score`. For the ordering test, spread insights:

```ts
function scored(id: string, score: number): DraftableLead {
  const row = lead(id);
  return { ...row, aiInsights: { ...row.aiInsights!, score } };
}
```

Existing tests use `expect(summary).toMatchObject(...)`. `deferred` can be absent from those objects. New tests:

```ts
const CLEAN = { connectionNote: "note", followupMessage: "follow", violations: [] as [] };

it("drafts at most 15 first touches and leaves the rest unqualified-for-today only", async () => {
  const store = new FakeCopyStore();
  store.firstTouchDraftsToday = 14;
  for (const id of ["a", "b", "c"]) store.leads.push(lead(id));
  const draftLinkedInFn = vi.fn(async () => CLEAN);
  const summary = await runCopyDraft(
    { copyAgentId: "copy1", accountId: "acc1", leadIds: ["a", "b", "c"] },
    { store, draftLinkedInFn }
  );
  expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
  expect(summary).toMatchObject({ drafted: 1, deferred: 2, skipped: 0 });
  const draftedIds = new Set(store.sends.map((s) => s.leadId));
  expect(draftedIds.size).toBe(1);
  for (const id of ["a", "b", "c"]) {
    if (!draftedIds.has(id)) expect(store.campaignLeads.has(id)).toBe(false);
  }
});

it("does not call the model when 15 invites were already drafted today", async () => {
  const store = new FakeCopyStore();
  store.firstTouchDraftsToday = 15;
  store.leads.push(lead("a"));
  const draftLinkedInFn = vi.fn(async () => CLEAN);
  const summary = await runCopyDraft(
    { copyAgentId: "copy1", accountId: "acc1", leadIds: ["a"] },
    { store, draftLinkedInFn }
  );
  expect(draftLinkedInFn).not.toHaveBeenCalled();
  expect(summary).toMatchObject({ drafted: 0, deferred: 1, skipped: 0 });
  expect(store.campaignLeads.has("a")).toBe(false);
});

it("spends the last slot on the higher score", async () => {
  const store = new FakeCopyStore();
  store.firstTouchDraftsToday = 14;
  store.leads.push(scored("low", 71), scored("high", 96));
  const draftLinkedInFn = vi.fn(async () => CLEAN);
  await runCopyDraft(
    { copyAgentId: "copy1", accountId: "acc1", leadIds: ["low", "high"] },
    { store, draftLinkedInFn }
  );
  expect(store.sends.map((s) => s.leadId)).toEqual(["high", "high"]);
});
```

`getDraftableLeads` on the fake returns `this.leads` and ignores `leadIds`. Push only the leads under test. The existing test `"bestOfN=1 with a judgeFn wired"` must stay green: cap logic must not start calling the judge.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vantera/jobs test src/pipeline/copy-draft.test.ts`

Expected: FAIL — `countFirstTouchDraftsSince` is not on the store, or `summary.deferred` is undefined.

- [ ] **Step 3: Implement**

`packages/jobs/src/pipeline/types.ts`:

```ts
countFirstTouchDraftsSince(accountId: string, since: Date): Promise<number>;
```

on `CopyDraftStore`, and `deferred: number` on `CopyDraftSummary`.

`packages/jobs/src/pipeline/copy-draft.ts`:

```ts
export const DAILY_FIRST_TOUCH_DRAFT_CAP = 15;

export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function scoreOf(lead: DraftableLead): number {
  const score = lead.aiInsights && "score" in lead.aiInsights ? Number(lead.aiInsights.score) : 0;
  return Number.isFinite(score) ? score : 0;
}
```

After `getDraftableLeads` and the `alreadyDrafted` filter, sort a copy by `scoreOf` descending and slice to `remaining`:

```ts
const used = await deps.store.countFirstTouchDraftsSince(accountId, utcDayStart(new Date()));
const remaining = Math.max(0, DAILY_FIRST_TOUCH_DRAFT_CAP - used);
const ranked = [...leads].sort((a, b) => scoreOf(b) - scoreOf(a));
const room = ranked.slice(0, remaining);
const deferred = ranked.length - room.length;
```

Pass `room` to `mapWithConcurrency`, not `leads`. Do not call `setCampaignLeadStatus` for deferred leads. Add `deferred` to the returned summary. The early skip return `{ status: "skipped", drafted: 0, suppressed: 0, skipped: 0 }` also gets `deferred: 0`.

`packages/jobs/src/pipeline/pg-store.ts`, next to `getBestOfN`:

```ts
async countFirstTouchDraftsSince(accountId, since) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(scheduledSends)
    .where(
      and(
        eq(scheduledSends.accountId, accountId),
        eq(scheduledSends.linkedinStage, "invite"),
        gte(scheduledSends.createdAt, since)
      )
    );
  return row?.n ?? 0;
},
```

Import `gte` from `drizzle-orm` if it is not already imported. Sequence touches and inbound replies insert `linkedin_stage: "message"`, so they do not consume the cap.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @vantera/jobs test src/pipeline/copy-draft.test.ts src/pipeline/scout.test.ts src/pipeline/sequence-touch.test.ts src/pipeline/inbound.test.ts`

Expected: PASS. Scout tests mock the store and never call `countFirstTouchDraftsSince`. If a type error names a fake store missing the new method, add `async countFirstTouchDraftsSince() { return 0; }` on that fake only.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/copy-draft.ts packages/jobs/src/pipeline/copy-draft.test.ts packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts
git commit -m "feat(jobs): cap first-touch drafts at 15 per account per day"
```

---

### Task 5: Keep public tools off the console key

**Files:**
- Modify: `packages/ai/src/client.ts` and `packages/ai/src/index.ts` only if `getPublicModel` is not already on `main`. On this branch it already exists; do not rewrite it.
- Modify: `apps/web/src/app/api/tools/[slug]/route.ts` so generation uses `getPublicModel()`, not `getModel()`.
- Test: `apps/web/src/lib/tools/route-guardrail.test.ts` (create if missing)

**Interfaces:**
- Consumes: `getPublicModel()` from `@vantera/ai`, which returns a gateway model id string (`anthropic/claude-haiku-4.5`), not an Anthropic client.
- Produces: the public tools route never imports `getModel`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public tools billing", () => {
  const route = readFileSync(
    join(__dirname, "../../app/api/tools/[slug]/route.ts"),
    "utf8"
  );

  it("drafts through the AI Gateway helper, not the console client", () => {
    expect(route).toContain("getPublicModel");
    expect(route).not.toContain("getModel(");
    expect(route).not.toMatch(/api\.anthropic\.com|ANTHROPIC_API_KEY/);
  });
});
```

Adjust the relative path so it resolves to `apps/web/src/app/api/tools/[slug]/route.ts` from the test file's directory.

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @vantera/web exec vitest run src/lib/tools/route-guardrail.test.ts`

Expected: PASS if this branch's route already calls `getPublicModel()`. FAIL if `main` still calls `getModel()` — then do Step 3. If it already passes, skip Step 3 and commit only when the test is new.

- [ ] **Step 3: Implement only if the test failed**

In the route, `model: getPublicModel()` inside `generateObject`. Delete any `getModel` import. Do not put an Anthropic API key read in this file.

- [ ] **Step 4: Run the test again**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/tools/[slug]/route.ts apps/web/src/lib/tools/route-guardrail.test.ts packages/ai/src/client.ts packages/ai/src/index.ts packages/ai/src/client.test.ts
git commit -m "fix(tools): bill public generators through the AI Gateway"
```

---

### Task 6: Confirm the ceiling and the quality gate

No new product behavior. This task is the proof the earlier tasks fit together.

- [ ] **Step 1: Run the affected suites**

```bash
pnpm --filter @vantera/ai test
pnpm --filter @vantera/agent-brains test
pnpm --filter @vantera/jobs test src/pipeline/copy-draft.test.ts src/pipeline/scout.test.ts src/pipeline/inbound.test.ts src/pipeline/sequence-touch.test.ts
pnpm --filter @vantera/evals test
```

Expected: all PASS.

- [ ] **Step 2: Do not enable best-of-N**

Confirm no migration, seed, or trigger writes `best_of_n`. `rg "best_of_n" packages/db` should show no insert of a value greater than 1. The production row stays absent, which `getBestOfN()` treats as 1.

- [ ] **Step 3: Ops, after the code is on main**

These are not code. They are what makes the $15 number true in production:

- Add Anthropic credits. Classifiers and drafts share that key until a later split. The $15 figure assumes Haiku for rank and Sonnet for at most 15 drafts a day.
- Leave `ANTHROPIC_MODEL` unset, or set it to `claude-sonnet-4-6`. Do not set it to Opus.
- Leave `ANTHROPIC_CLASSIFIER_MODEL` unset so the Haiku pin holds.
- Re-run the Evals workflow once. Classifier floors must pass on Haiku. Copy lint must pass on Sonnet. If a floor fails, revert that brain to Sonnet (`getModel()` default) and stop. Do not ship a failing floor to meet the dollar cap.
- Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Vercel production so the public tools cannot burn the gateway without a limit.
- Do not change the $79 Stripe price.

- [ ] **Step 4: Commit only if a test or comment changed in this task**

Otherwise there is nothing to commit. The ops list is for the human after deploy.

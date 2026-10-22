# UX-1 — Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new user sees ≥5 real, scored, why-now-annotated prospects from their own ICP before connecting LinkedIn and before entering a card; Today becomes the single home with a persistent Get Started checklist; activation is instrumented end to end.

**Architecture:** Re-sequence onboarding to Details → Your buyers → First prospects → Plan by extending the pure step resolver and adding two account milestone timestamps. The buyers step edits the ICP draft `saveDetails` already writes, provisions Scout + campaign + Outreach agent (extracted from `finishOnboarding`), and starts the existing dormant fast-pass; the prospects step reads `reveal_runs` + scored leads through the existing pure `buildRevealStatus`, and a reject is a `wrong_person` cancel of the lead's drafts plus a `not_fit` feedback row, so the next scored lead fills the slot. Accounts still in onboarding are held out of the scheduler. Today gets a pure checklist module carried on `TodayView`, and every post-auth redirect lands on `/today`.

**Tech Stack:** Next.js App Router (server actions, `useActionState`), Supabase (RLS + service role), Drizzle migrations, Trigger.dev task `fast-pass`, vitest. Rule 07 landing-parity system (`components/app/surface.tsx`: `PageHeader`, `PANEL`, `StatusChip`), onboarding spacing scale (rule 07 focused surfaces).

**Spec:** `docs/superpowers/specs/2026-10-21-activation-ux-gojiberry-gap-design.md` §0, §1, §3.1, §3.2, §3.7, §3.8 (one-home + events), §5 "UX-1", §7 decisions 1–3 and 6 taken as recommended.

## Global Constraints

- Onboarding order: `Details → Your buyers → First prospects → Plan → Today` (spec §3.1). LinkedIn connect is **not** an onboarding step.
- Endowed progress: segments `Account ✓ · Details · Buyers · Prospects · Plan` — 5 segments, 20% endowed (§3.1).
- Preview: 5 leads shown, up to 15 surfaced, ≤50 evaluated, exactly one readable draft (`FAST_PASS_DEFAULTS`, `REVEAL_SURFACED_CAP`, unchanged). Reject → replaced from the evaluated pool; when exhausted the step says so and continues (§7.3).
- Pre-card spend is exactly one fast-pass run; an account with `onboarding_completed_at IS NULL` is **held**: scheduler skips its Scout/Intent (§3.1 "held", keyed on onboarding completion because founder/dev bypass finish without a Stripe subscription).
- Card stays before Today (§7.1). Trial is 7 days (`TRIAL_DAYS`); the DB trial clock starts at checkout (§7.6), not at LinkedIn connect.
- One home: login, signup, OAuth, confirm, invite accept and `finishOnboarding` land on `/today`; `/today` never forwards to `/approvals` (§3.8). `/dashboard` stays Results.
- Anti-goals: no blank wait (skeleton + narration while the fast-pass runs); no toast over the top-right; no new review surface; no vendor name on any surface; no send cap hardcoded in a component.
- Wizard scope rule (rule 08): steps collect identity, goal, context only. ICP confirmation and lead preview are context.
- Every new/changed user-visible behavior ships its help article in the same PR (rule 09). Suppression is already enforced inside fast-pass/copy-draft; the preview is read-only (rule 11).
- Migration numbering: this plan adds `0073_onboarding_milestones.sql`. `0070`–`0072` live uncommitted in the other session's tree; if they have not landed on `main` when this branch merges, **renumber this file to the next free number** (gapless guardrail `schema.test.ts` "files are sequentially numbered with no gaps"). Apply to prod before deploying (manual, `supabase db query --linked -f`).
- Copy voice: sentence case, plain words, trust line "Nothing is sent without your approval" on the Plan step.

## Review Focus

1. **Fast-pass never finishes** (Trigger down, `low_credits`, provider 5xx): the Prospects step must still let the user continue to Plan after a bounded wait, and `confirmProspects` must not require a `done` run. Pinned in Task 7 ("continue is enabled while the run is still working / after failed").
2. **Regenerate after the preview already ran**: `regenerateBuyers` must reset `reveal_runs` so the preview re-runs, and `confirmBuyers` after a reset must start a new run (not return `{started:false}`). Pinned in Task 4 (`resetRevealRun` + `maybeStartFastPass` restart test).
3. **Rejecting the only drafted lead**: its `pending_review` sends are canceled with `wrong_person`, the status view must not show a `topDraft` from a rejected lead. Pinned in Task 4 (`buildRevealStatus` with `rejectedLeadIds`).
4. **Founder/dev bypass accounts** (`accountSkipsPayment`, `billingBypassAllowed`): they skip the Plan step; the hold must release when `onboarding_completed_at` is stamped, not when a subscription appears. Pinned in Task 3 (`isHeldForOnboarding` tests) and Task 8 (gate test "subscribed via exemption → done").
5. **Returning user who already connected LinkedIn in the old flow but never paid**: `resolveOnboardingStep` must ignore `linkedinConnected` and route by the two new milestones. Pinned in Task 2 ("legacy context with linkedin but no buyers → 2").

---

### Task 1: Migration — onboarding milestones

**Files:**
- Create: `packages/db/migrations/0073_onboarding_milestones.sql`
- Modify: `packages/db/src/schema.ts` (`accounts` table, after `onboardingCompletedAt`)
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces: columns `accounts.buyers_confirmed_at timestamptz null`, `accounts.prospects_reviewed_at timestamptz null`; Drizzle `accounts.buyersConfirmedAt`, `accounts.prospectsReviewedAt`.

- [ ] **Step 1: Write the failing test** (append to `schema.test.ts`, same style as the `0063` describe at :209)

```ts
describe("onboarding milestones (0073, UX-1)", () => {
  const sql = readFileSync(join(migrationsDir, "0073_onboarding_milestones.sql"), "utf8").toLowerCase();
  it("adds two nullable timestamps on accounts", () => {
    expect(sql).toMatch(/alter table public\.accounts\s+add column buyers_confirmed_at timestamptz/);
    expect(sql).toMatch(/add column prospects_reviewed_at timestamptz/);
    expect(sql).not.toMatch(/not null/);
  });
  it("is mirrored in Drizzle", () => {
    expect(schema.accounts.buyersConfirmedAt).toBeDefined();
    expect(schema.accounts.prospectsReviewedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run** `pnpm -C packages/db exec vitest run src/schema.test.ts -t "onboarding milestones"` → FAIL (ENOENT).
- [ ] **Step 3: Write the migration**: header comment `-- 0073 (UX-1): onboarding milestones — when the user confirmed the drafted ICP and reviewed the first prospects. Nullable; stamped by server actions; read by the onboarding step resolver and the Today checklist. No RLS change (accounts policies already cover them).` then the two `alter table public.accounts add column … timestamptz;` statements. Mirror in `schema.ts` as `buyersConfirmedAt: timestamp("buyers_confirmed_at", { withTimezone: true })` and `prospectsReviewedAt` likewise.
- [ ] **Step 4: Run** the whole db suite → PASS (including "files are sequentially numbered with no gaps" — see Global Constraints if it fails on numbering).
- [ ] **Step 5: Commit** `feat(db): 0073 onboarding milestones (buyers_confirmed_at, prospects_reviewed_at)`.

---

### Task 2: Pure onboarding step resolver — four steps, LinkedIn out

**Files:**
- Modify: `apps/web/src/lib/auth/onboarding-gate.ts`, `apps/web/src/lib/auth/onboarding-context.ts`
- Delete: `apps/web/src/lib/auth/start-gate.ts`, `start-gate.test.ts`, `start-context.ts` (the abandoned "/start" journey v2; zero page callers — verify with `grep -rn "start-gate\|start-context" apps/web/src` before deleting)
- Test: `apps/web/src/lib/auth/onboarding-gate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OnboardingStep = 1 | 2 | 3 | 4;              // Details · Buyers · Prospects · Plan
  export const ONBOARDING_SEGMENTS = ["Account", "Details", "Buyers", "Prospects", "Plan"] as const;
  export type OnboardingContext = {
    hasAccount: boolean; detailsConfirmed: boolean; buyersConfirmed: boolean;
    prospectsReviewed: boolean; subscribed: boolean; onboardingComplete: boolean;
  };
  export function resolveOnboardingStep(ctx: OnboardingContext): OnboardingStep | "done";
  export function onboardingProgressPercent(step: OnboardingStep | "done"): number; // 20·step, 100 for done
  ```
  `getOnboardingData()` returns `OnboardingData = OnboardingContext & { userId; accountId; prefill }` with `buyersConfirmed = buyers_confirmed_at != null`, `prospectsReviewed = prospects_reviewed_at != null`; it no longer reads `linkedin_accounts`.

- [ ] **Step 1: Rewrite the tests** in `onboarding-gate.test.ts`: resolve order (`!hasAccount → 1`, `details && !buyers → 2`, `buyers && !prospects → 3`, `prospects && !subscribed → 4`, `subscribed → "done"`, `onboardingComplete → "done"` regardless), percent `20/40/60/80/100`, and the Review-Focus case `"a legacy context that connected LinkedIn but never confirmed buyers resolves to 2"` (build the ctx with an extra `linkedinConnected: true` cast to `OnboardingContext`, assert `2`).
- [ ] **Step 2: Run** `pnpm -C apps/web exec vitest run src/lib/auth/onboarding-gate.test.ts` → FAIL (type errors / wrong values).
- [ ] **Step 3: Implement** the new types and resolver; update `getOnboardingData` to select `buyers_confirmed_at, prospects_reviewed_at` from `accounts` and drop the `linkedin_accounts` query. Delete the `/start` files.
- [ ] **Step 4: Run** the test file → PASS; `pnpm -C apps/web type-check` will now fail in `onboarding/*` (expected until Task 8). Note the failures; do not fix them here.
- [ ] **Step 5: Commit** `feat(onboarding): four-step resolver — buyers + prospects milestones, LinkedIn out`.

---

### Task 3: Hold accounts still in onboarding out of the scheduler

**Files:**
- Create: `packages/jobs/src/pipeline/onboarding-hold.ts`, `onboarding-hold.test.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`DueAgent`, `getDueAgents` ≈ :2063 and the `SchedulerStore` interface ≈ :3413), `packages/jobs/src/trigger/agent-scheduler.ts`

**Interfaces:**
- Produces:
  ```ts
  // onboarding-hold.ts (pure)
  export type HoldFacts = { onboardingCompletedAt: Date | null };
  export function isHeldForOnboarding(f: HoldFacts): boolean;   // true iff onboardingCompletedAt === null
  ```
  `DueAgent` gains `onboardingCompletedAt: Date | null` (from a join on `accounts`).

- [ ] **Step 1: Write the failing tests**

```ts
describe("isHeldForOnboarding", () => {
  it("holds an account that has not finished onboarding", () =>
    expect(isHeldForOnboarding({ onboardingCompletedAt: null })).toBe(true));
  it("releases on completion regardless of subscription (founder/dev bypass)", () =>
    expect(isHeldForOnboarding({ onboardingCompletedAt: new Date("2026-10-22T00:00:00Z") })).toBe(false));
});
```

- [ ] **Step 2: Run** `pnpm -C packages/jobs exec vitest run src/pipeline/onboarding-hold.test.ts` → FAIL.
- [ ] **Step 3: Implement** the predicate; in `getDueAgents` inner-join `accounts` on `agents.accountId` and select `onboardingCompletedAt`; in `agent-scheduler.ts` `continue` when `isHeldForOnboarding(agent)` (log `held_onboarding` with the agentId — thin wrapper, no other logic).
- [ ] **Step 4: Run** `pnpm -C packages/jobs test` → PASS (structure guardrail still passes: the trigger imports from `../pipeline/`).
- [ ] **Step 5: Commit** `feat(jobs): hold scheduled runs for accounts still in onboarding`.

---

### Task 4: Fast-pass start without LinkedIn, reset, and the read path

**Files:**
- Modify: `apps/web/src/lib/reveal/start-fast-pass.ts`, `apps/web/src/lib/reveal/status.ts`
- Create: `apps/web/src/lib/reveal/read.ts` (server-only), `apps/web/src/lib/reveal/start-fast-pass.test.ts`
- Test: `apps/web/src/lib/reveal/status.test.ts`

**Interfaces:**
- Consumes: `buildRevealStatus(run, matchRows, draftRow)` and `RevealStatus` from `status.ts`; `tasks.trigger("fast-pass", …)`.
- Produces:
  ```ts
  // start-fast-pass.ts
  export async function maybeStartFastPass(accountId: string): Promise<{ started: boolean }>; // precondition: onboarding not complete + onboarding ICP exists (LinkedIn check removed)
  export async function resetRevealRun(accountId: string): Promise<void>;                     // service role: delete reveal_runs row for the account
  // status.ts
  export const PREVIEW_SHOWN = 5;
  export function buildRevealStatus(run: RevealRunRow | null, matchRows: RevealMatchRow[], draftRows: RevealDraftRow[], rejectedLeadIds: ReadonlySet<string>): RevealStatus;
  // RevealStatus.matches = top PREVIEW_SHOWN of non-rejected scored rows (desc score); RevealStatus.poolRemaining = non-rejected scored rows beyond the shown 5 (0 ⇒ "pool exhausted"); topDraft = the draft row whose lead_id is the highest-scored shown lead with a body, else null
  // read.ts
  export async function getRevealStatus(accountId: string): Promise<RevealStatus>;            // RLS client: reveal_runs row, leads (id, first_name, last_name, title, company_name, ai_score, ai_rationale, ai_insights) with ai_score not null ordered desc limit 50, scheduled_sends (lead_id, body) where status='pending_review' and linkedin_stage='invite', lead_feedback (lead_id) where verdict='not_fit'
  ```

- [ ] **Step 1: Extend `status.test.ts`**: (a) `"shows 5 and reports the remaining pool"` — 9 scored rows, no rejections → `matches.length === 5`, `poolRemaining === 4`; (b) `"a rejected lead is replaced by the next scored lead and never supplies the draft"` — reject the top lead, its draft row present → `matches[0]` is the former #2, `topDraft.leadId !== rejected`, `topDraft` taken from the new top if it has a body else `null`; (c) `"pool exhausted"` — 5 scored, 1 rejected → `matches.length === 4`, `poolRemaining === 0`. Keep the existing seven cases (adapt the signature).
- [ ] **Step 2: Write `start-fast-pass.test.ts`** with a mocked service client + `tasks.trigger` (vi.mock `@trigger.dev/sdk`): `"starts without any linkedin_accounts row"`, `"does not start twice for a non-failed run"`, `"resetRevealRun deletes the row so the next start inserts fresh"`.
- [ ] **Step 3: Run** both files → FAIL.
- [ ] **Step 4: Implement**: remove the `linkedin_accounts` precondition (:33-41); add `resetRevealRun`; extend `buildRevealStatus` per the Interfaces block (drop the duplicate `REVEAL_SURFACED_CAP` in `status.ts` in favour of importing nothing — keep a local `SURFACED_CAP = 15` with a comment pointing at `fast-pass.ts:48`); write `read.ts` as one `Promise.all` of the four reads.
- [ ] **Step 5: Run** `pnpm -C apps/web exec vitest run src/lib/reveal` → PASS.
- [ ] **Step 6: Commit** `feat(reveal): fast-pass starts pre-LinkedIn; status shows 5 with reject-and-replace`.

---

### Task 5: Extract agent provisioning from `finishOnboarding`

**Files:**
- Create: `apps/web/src/app/onboarding/provision.ts` (server-only), `provision.test.ts`
- Modify: `apps/web/src/app/onboarding/actions.ts` (`finishOnboarding` :280-333 → call the helper)

**Interfaces:**
- Produces:
  ```ts
  export type ProvisionDeps = { supabase: SupabaseClient; accountId: string; userId: string; icp: { id: string; name: string } };
  export type ProvisionResult = { scoutId: string; campaignId: string; copyAgentId: string };
  export async function provisionOnboardingAgents(d: ProvisionDeps): Promise<ProvisionResult>; // idempotent: reuses existing rows by (account_id, kind) and the campaign named "Outreach (agent)"; exact column values copied from finishOnboarding :280-333 (scout config {prospects_per_run:60,min_score:70}, 08:00 daily UTC, agent_icps position 0; campaign channels ['linkedin'], copywriting_mode 'agent', send_mode 'review'; copy config {cta: DEFAULT_CTA, channels:{linkedin:true}})
  ```
  Intent-agent and playbook seeding stay in `finishOnboarding`.

- [ ] **Step 1: Write `provision.test.ts`** with an in-memory fake of the four tables (`agents`, `agent_icps`, `campaigns`) exposing the subset of the supabase builder used: `"creates scout, campaign and copy agent once"` (3 rows + link), `"second call reuses all three"` (same ids, no new rows), `"copy agent carries campaign_id"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; replace the inline blocks in `finishOnboarding` with `await provisionOnboardingAgents(...)`. **Step 4: Run** `pnpm -C apps/web exec vitest run src/app/onboarding` → PASS. **Step 5: Commit** `refactor(onboarding): extract provisionOnboardingAgents`.

---

### Task 6: "Your buyers" step — ICP editor, confirm, regenerate

**Files:**
- Create: `apps/web/src/components/icp/icp-editor.tsx` (client), `apps/web/src/app/onboarding/buyers-step.tsx` (client), `apps/web/src/lib/validation/buyers.ts`, `buyers.test.ts`
- Modify: `apps/web/src/app/onboarding/actions.ts` (add `confirmBuyers`, `regenerateBuyers`)

**Interfaces:**
- Consumes: `IcpDraft`, `ICP_SIZE_BUCKETS`, `draftIcp`, `icpDraftIsEmpty` from `@vantera/agent-brains`; `TargetingRules`, `normalizeTargetingRules` (`@vantera/agent-brains`); `parseTargetingForm` (`app/(app)/playbook/validation.ts:208`); `provisionOnboardingAgents` (Task 5); `maybeStartFastPass`, `resetRevealRun` (Task 4).
- Produces:
  ```ts
  // lib/validation/buyers.ts (pure)
  export type BuyersFormValues = { name: string; criteria: { titles: string[]; industries: string[]; companySizes: string[]; geos: string[]; signals: string[] }; targeting: TargetingRules };
  export const BUYERS_CAPS = { titles: 6, industries: 4, companySizes: 4, geos: 3, signals: 5, entry: 60 } as const; // same caps as icp-draft.ts
  export function parseBuyersForm(form: FormData): Result<BuyersFormValues>; // chips arrive as repeated fields titles[], industries[], …; sizes must be in ICP_SIZE_BUCKETS; name 2..80 chars; delegates targeting to parseTargetingForm
  // components/icp/icp-editor.tsx
  export type IcpEditorValue = BuyersFormValues;
  export function IcpEditor(props: { value: IcpEditorValue; onRegenerate?: () => void; regenerating?: boolean; mode: "onboarding" | "settings" }): JSX.Element; // renders chip groups with counts in headers (JOB TITLES 4 · INDUSTRIES 3 · COMPANY SIZE · LOCATIONS · SIGNALS), add/remove chips, Exclusions group (excludeAgencies, excludeFreelancers default ON, competitors textarea), "Who to prioritize or avoid" under a <details> disclosure; emits the repeated form fields parseBuyersForm expects; no network
  // onboarding/actions.ts
  export async function confirmBuyers(_prev: DetailsState, formData: FormData): Promise<DetailsState>; // parse → update icps(source='onboarding') {name, criteria} → accounts.onboarding_icp = name → provisionOnboardingAgents → agents(scout).config.targeting = targeting → accounts.buyers_confirmed_at = now() (only if null) → maybeStartFastPass → redirect("/onboarding?done=buyers")
  export async function regenerateBuyers(): Promise<{ error?: string }>;                        // draftIcp({companyName: accounts.name, scan: accounts.website_scan}) → update icps criteria+name → resetRevealRun → revalidatePath("/onboarding")
  ```

- [ ] **Step 1: Write `buyers.test.ts`**: `"accepts the drafted shape and trims/dedupes chips"`, `"rejects a size outside ICP_SIZE_BUCKETS"`, `"caps titles at 6 and entries at 60 chars"`, `"defaults exclusions to agencies+freelancers on"`, `"passes guidance through parseTargetingForm limits"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `parseBuyersForm`, `IcpEditor`, `BuyersStep` (`useActionState(confirmBuyers, {})`; Regenerate button calls `regenerateBuyers` via `useTransition` then `router.refresh()`; busy label "Rewriting your buyer profile…"; submit label "These are my buyers"), the two actions. Copy: title "Your buyers", sub "We read your site and drafted who to go after. Edit anything that's off — your agents score every prospect against this." Footer note: "Where this came from → Settings › Positioning" linking `/settings/positioning` (verify route exists; else `/settings`).
- [ ] **Step 4: Run** `pnpm -C apps/web exec vitest run src/lib/validation` → PASS; `pnpm -C apps/web lint` 0 errors on the new files.
- [ ] **Step 5: Commit** `feat(onboarding): Your buyers step — editable ICP draft, exclusions, regenerate, provisions agents and starts the preview`.

---

### Task 6b: Playbook → Targeting uses the same editor (one component, two placements)

**Files:**
- Modify: `apps/web/src/app/(app)/playbook/scout/targeting/page.tsx`, `targeting-form.tsx` (becomes a thin wrapper around `IcpEditor mode="settings"`), `apps/web/src/app/(app)/playbook/actions.ts:573` (`updateScoutTargeting`), `apps/web/src/app/(app)/playbook/validation.test.ts`
- Test: `apps/web/src/app/(app)/playbook/validation.test.ts`

**Interfaces:**
- Consumes: `IcpEditor`, `parseBuyersForm` (Task 6).
- Produces: `updateScoutTargeting(_prev, formData)` now parses with `parseBuyersForm` and writes **both** the onboarding `icps` row (`name`, `criteria`) and `agents(scout).config.targeting`; `page.tsx` loads both and passes `value: IcpEditorValue`. Redirect unchanged (`/playbook?updated=scout`).

- [ ] **Step 1: Test** in `validation.test.ts`: `"targeting page values round-trip through parseBuyersForm (criteria + targeting)"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; delete the now-unused field markup in `targeting-form.tsx`. **Step 4: Run** `pnpm -C apps/web test` → PASS; manual: `/playbook/scout/targeting` shows the chip editor pre-filled. **Step 5: Commit** `feat(playbook): targeting page shares the ICP editor with onboarding`.

---

### Task 7: "First prospects" step — preview, reject-and-replace, continue

**Files:**
- Create: `apps/web/src/app/onboarding/prospects-step.tsx` (client), `apps/web/src/app/onboarding/preview-actions.ts` (server), `preview-actions.test.ts`
- Modify: `apps/web/src/lib/learning/fit.ts` only if a shared `upsertLeadFit` helper is extracted from `prospects/fit-actions.ts` (recommended; keep `setLeadFit` behavior identical)

**Interfaces:**
- Consumes: `getRevealStatus` (Task 4), `RevealStatus`, `scoreVerdict` tier helper (search `apps/web/src/lib` for `scoreVerdict`; hot ≥85 / strong ≥70 / look), `rejectDraftWithReason` semantics (`today/actions.ts:87` — `scheduled_sends.status='canceled', rejection_reason`).
- Produces:
  ```ts
  // preview-actions.ts
  export async function rejectPreviewLead(leadId: string): Promise<{ error?: string }>; // lead_feedback upsert {verdict:'not_fit', reason:'onboarding_preview', created_by: auth.uid()} on conflict lead_id; scheduled_sends for (account_id, lead_id) with status in ('pending_review','approved') → {status:'canceled', rejection_reason:'wrong_person'}; revalidatePath('/onboarding')
  export async function confirmProspects(): Promise<never>;                             // accounts.prospects_reviewed_at = now() if null → redirect("/onboarding?done=prospects"); never requires the run to be done
  // prospects-step.tsx
  export function ProspectsStep(props: { status: RevealStatus; accountId: string }): JSX.Element;
  ```
  Behavior: while `status.status ∈ {not_started, queued, scanning, ranking, drafting}` render a 5-card skeleton + narration line that advances with status ("Reading your site" → "Building your buyer profile" → "Scoring the first matches" → "Writing the first message") and `router.refresh()` every 2 s; after 120 s of polling show "Still working — you can keep going, your prospects will be on Today." with Continue enabled. When `done`: 5 cards (name · title · company · tier glyph + score · evidence line), "Not a fit" per card → `rejectPreviewLead` (optimistic remove; the server re-renders the next lead), exactly one draft rendered as a LinkedIn note (≤300 chars) under its card. `poolRemaining === 0` → inline note "That's everyone from the first pass — your agent keeps looking after you pick a plan." `failed` → "We couldn't finish the first pass. Your agent will retry after you pick a plan." Continue is always enabled.

- [ ] **Step 1: Write `preview-actions.test.ts`** with a mocked supabase client: `"reject writes not_fit with reason onboarding_preview and cancels the lead's pending sends as wrong_person"`, `"confirmProspects stamps prospects_reviewed_at once and redirects even when the run is scanning"` (mock `redirect` throwing).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** actions and the step component. **Step 4: Run** `pnpm -C apps/web exec vitest run src/app/onboarding` → PASS.
- [ ] **Step 5: Commit** `feat(onboarding): First prospects step — five scored leads, reject-and-replace, one readable draft`.

---

### Task 8: Re-sequence the onboarding pages; Plan is step 4; remove the LinkedIn step

**Files:**
- Modify: `apps/web/src/app/onboarding/page.tsx`, `onboarding-shell.tsx`, `onboarding-progress.tsx`, `step-copy.tsx`, `onboarding-scene.tsx` (CAPTIONS + ternary), `subscription-step.tsx` (copy only), `actions.ts` (`finishOnboarding` redirect → `/today?onboarded=1`; delete `createOnboardingConnectLink`), `apps/web/src/app/onboarding-preview/page.tsx` + `fixtures.ts`
- Delete: `apps/web/src/app/onboarding/linkedin-step.tsx`
- Test: `apps/web/src/app/onboarding/page.test.tsx` if present, else none (page is glue); `onboarding-gate.test.ts` already covers routing.

**Interfaces:**
- Consumes: `BuyersStep` (Task 6), `ProspectsStep` + `getRevealStatus` (Tasks 4, 7), `resolveOnboardingStep` (Task 2).
- Produces: `STEP_COPY: Record<OnboardingStep, {title; sub}>` with keys 1–4; `OnboardingScene` renders `ProfileScene | BuyersScene | ProspectsScene | LaunchScene` (BuyersScene/ProspectsScene may reuse ProfileScene visuals with new captions — builder's call); Plan step copy adds the trust line "Nothing is sent without your approval."

- [ ] **Step 1: Make type-check red on purpose**: `pnpm -C apps/web type-check` — list every error from Task 2's type change (expected in `page.tsx`, `step-copy.tsx`, `onboarding-scene.tsx`, `onboarding-preview/*`, `fixtures.ts`).
- [ ] **Step 2: Implement** `page.tsx`: step 2 loads the onboarding `icps` row + scout `config.targeting` (if any) → `<BuyersStep value>`; step 3 → `<ProspectsStep status={await getRevealStatus(accountId)}>`; step 4 → existing `<SubscriptionStep>`; remove the `connected`/`account_id` reconcile branches (:47-66, :87-95) and the `returnedFromConnect` logic; keep `checkout=success` confirm; `step==="done"` → `finishOnboarding()`. Shell: "Step N of 4". Progress: 5 segments. Delete `linkedin-step.tsx` and `createOnboardingConnectLink` (the senders page keeps its own connect, `settings/senders/actions.ts`).
- [ ] **Step 3: Run** `pnpm -C apps/web type-check && pnpm -C apps/web test` → PASS.
- [ ] **Step 4: Manual check** with `pnpm dev`: a fresh dev account walks Details → Buyers → Prospects (skeleton then cards) → Plan; the progress bar reads 20/40/60/80.
- [ ] **Step 5: Commit** `feat(onboarding): Details → Buyers → Prospects → Plan; LinkedIn connect leaves onboarding`.

---

### Task 9: One home — every landing is `/today`

**Files:**
- Modify: `apps/web/src/app/(auth)/actions.ts` (:39, :106, :158, :186), `apps/web/src/lib/auth/oauth-complete.ts:119`, `apps/web/src/app/auth/confirm/route.ts:12`, `apps/web/src/lib/auth/gate.ts` (:15, :18), `apps/web/src/app/invite/[token]/accept-actions.ts:23`, `apps/web/src/app/(app)/today/page.tsx:37` (delete the forward + docblock lines 20-21), `apps/web/src/lib/today/state.ts:25`, `types.ts` (`TodayState` minus `"first_session"`), `sentence.ts`, `engine-line.ts` (drop the `first_session` cases), `apps/web/src/app/(app)/today/actions.ts` (delete unused `markFirstSessionDone`)
- Test: `gate.test.ts`, `oauth-complete.test.ts`, `lib/today/state.test.ts`

**Interfaces:**
- Produces: `resolveGate("auth"|"onboarding", ctx)` returns `/today` where it returned `/dashboard`; `TodayState` has 8 members.

- [ ] **Step 1: Update tests first**: in `gate.test.ts` and `oauth-complete.test.ts` replace expected `/dashboard` with `/today` (keep `/settings` for `email_change`); in `state.test.ts` replace the `first_session` case with `"a first visit with drafts is steady, not a forward"` → `resolveTodayState({...fixture, firstSessionDone: false, drafts: 3})` equals `"steady"`.
- [ ] **Step 2: Run** the three files → FAIL. **Step 3: Implement** the redirects and remove the state. **Step 4: Run** `pnpm -C apps/web test` → PASS. **Step 5: Commit** `feat(home): Today is the only home — login, onboarding and gate land on /today`.

---

### Task 10: Today — Get Started checklist, "no LinkedIn yet" tile, first-view copy

**Files:**
- Create: `apps/web/src/lib/today/checklist.ts`, `checklist.test.ts`, `apps/web/src/components/today/get-started.tsx` (client)
- Modify: `apps/web/src/lib/today/rows.ts` (`TodayView.checklist`), `data.ts` (facts), `tiles.ts` (`TileKind` + `sender_missing`), `tiles.test.ts`, `sentence.ts` (working_empty copy), `apps/web/src/app/(app)/today/today-client.tsx` (rail grid), `apps/web/src/app/(app)/today/actions.ts` (`dismissAsk` allowlist + permanent key), `apps/web/src/app/(app)/dashboard/dashboard-view.tsx` (delete `ActivationRamp` :1170-1253 and `FirstRunInProgress` :1259-1358 and their branches at :175-192), `apps/web/src/app/(app)/dashboard/page.tsx` (drop the now-unused `isNew`/`isWorkingEmpty`/`plays` props), `apps/web/src/server/copilot/read-tools.ts` (new read tool)

**Interfaces:**
- Produces:
  ```ts
  // checklist.ts (pure)
  export type ChecklistFacts = { buyersConfirmedAt: string | null; prospectsReviewedAt: string | null; linkedinActive: boolean; firstApprovedAt: string | null; calendarOrCrmConnected: boolean; dismissedAt: string | null };
  export type ChecklistStep = { key: "buyers" | "prospects" | "linkedin" | "approve" | "connect"; label: string; done: boolean; href: string; optional: boolean };
  export type Checklist = { steps: ChecklistStep[]; done: number; total: 4; collapsed: boolean; dismissable: boolean } | null; // null when dismissedAt set
  export function checklistFor(f: ChecklistFacts): Checklist;
  // labels: "Confirm your buyers" (/playbook/scout/targeting), "Review first prospects" (/prospects), "Connect LinkedIn" (/settings/senders), "Approve your first message" (/approvals), optional "Connect calendar or CRM" (/settings/integrations); collapsed = done >= 2; dismissable = done === 4; total counts the four required steps
  export const GET_STARTED_ASK = "get_started"; // permanent dismissal key in user_profiles.dismissed_asks
  ```
  `TodayView.checklist: Checklist`; `TileKind` gains `"sender_missing"` (tone `attention`, priority 1, title "No LinkedIn connected yet", meta "Your agent is finding prospects. Connect to start sending.", href `/settings/senders`, not dismissible) emitted when `i.senders.length === 0`; copilot read tool `getActivationChecklist(db, accountId): Promise<{ steps: {label; done}[]; done: number }>` registered next to `getChannelStatusForAccount` (:228).

- [ ] **Step 1: Write `checklist.test.ts`**: `"endows the two onboarding steps"` (buyers+prospects set → done 2, collapsed true, dismissable false), `"four of four is dismissable"`, `"optional connect step never counts"`, `"dismissed returns null"`, `"a never-connected account has Connect LinkedIn open with the senders href"`. Extend `tiles.test.ts`: `"zero senders yields sender_missing at priority 1"` and `"one active sender yields no sender_missing"`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the pure module; in `data.ts` add reads for `accounts.buyers_confirmed_at, prospects_reviewed_at`, first approved send (`scheduled_sends` where status in ('approved','scheduled','sending','sent') order by created_at limit 1), `meeting_connections`/`crm_connections` status='active' counts, and `dismissed_asks[GET_STARTED_ASK]`; set `view.checklist`. `dismissAsk`: add `GET_STARTED_ASK` to `DISMISSIBLE` and to `tiles.ts:77`; `checklistFor` treats any timestamp as permanent (the 24 h rule stays only in `tilesFor`). `GetStarted` component: rail card when `!collapsed`, progress pill ("2 of 4 set up") when collapsed, "Dismiss" only when `dismissable`; `TodayClient` wraps content in `lg:grid-cols-[minmax(0,1fr)_320px]` when `view.checklist` is non-null, else the current single column. `sentence.ts` working_empty: `"Finding prospects · first batch in about ${eta} min — this page fills itself."` / `"Finding prospects · first batch is on its way — this page fills itself."`. Delete the two dashboard components. Register the copilot read tool.
- [ ] **Step 4: Run** `pnpm -C apps/web test && pnpm -C apps/web type-check` → PASS. Manual: `pnpm dev`, a fresh account on `/today` shows the rail with 2/4 endowed and the `sender_missing` tile.
- [ ] **Step 5: Commit** `feat(today): Get Started checklist, no-LinkedIn tile, first-view copy; retire the dashboard ramp`.

---

### Task 11: Activation events

**Files:**
- Create: `apps/web/src/components/analytics/onboarding-events.tsx` (client)
- Modify: `apps/web/src/app/onboarding/layout.tsx` (mount it), `prospects-step.tsx` (Task 7: fire `first_prospects_seen` once per run via `sessionStorage` key `vantera:onboarding:seen:<accountId>`, and `preview_lead_rejected` on reject), `buyers-step.tsx` (nothing — `icp_confirmed` rides on `?done=buyers`)
- Test: `apps/web/src/components/analytics/onboarding-events.test.ts` (pure mapper)

**Interfaces:**
- Consumes: `trackEvent(name, params?)` from `@/lib/analytics/clarity` (:57); `finishOnboarding` already redirects to `/today?onboarded=1` (Task 8) so the existing `RouteEvents` fires `onboarding_completed`.
- Produces:
  ```ts
  export function eventsForOnboardingParams(p: { done?: string | null; step?: string | null }): Array<{ name: string; params?: Record<string, string> }>;
  // done=details → [onboarding_step_completed {step:"details"}]; done=buyers → [onboarding_step_completed {step:"buyers"}, icp_confirmed]; done=prospects → [onboarding_step_completed {step:"prospects"}]; first mount with no done param → [onboarding_started] (once per browser via localStorage key "vantera:onboarding_started")
  export function OnboardingEvents(): null; // reads searchParams, fires via trackEvent, strips `done` with router.replace
  ```

- [ ] **Step 1: Write the mapper tests** for the four mappings above. **Step 2: Run** → FAIL. **Step 3: Implement** mapper + component; mount in the onboarding layout; add the two calls in `ProspectsStep`; `saveDetails` redirect becomes `/onboarding?done=details`. **Step 4: Run** `pnpm -C apps/web test` → PASS. **Step 5: Commit** `feat(analytics): onboarding step events, first_prospects_seen, preview_lead_rejected`.

---

### Task 12: Trial clock starts at checkout (reverse 0053's connect-time stamp)

**Files:**
- Modify: `packages/billing/src/webhook.ts` (`PersistedSnapshot` + `snapshotFromEvent`), `packages/billing/src/webhook.test.ts`, `apps/web/src/server/billing-webhook.ts` (pass through), the `applySnapshot` implementation (search `applySnapshot` in `apps/web/src/app/api/webhooks/stripe/route.ts` / `lib/billing`), `apps/web/src/lib/billing/confirm-checkout-server.ts` (:48 block), `apps/web/src/lib/linkedin/sync.ts:152-163` (delete the stamp), `packages/jobs/src/pipeline/pg-store.ts:2465-2476` (delete the stamp), `packages/jobs/src/pipeline/linkedin-webhook*.test.ts` if it pins the stamp

**Interfaces:**
- Produces: `PersistedSnapshot.trialEndsAt: string | null` (ISO from Stripe `subscription.trial_end`, else null); `applySnapshot` writes `trial_ends_at = snapshot.trialEndsAt` when non-null (never clears an existing value); `confirmCheckoutFromReturn` does the same from the session's subscription.

- [ ] **Step 1: Tests**: in `webhook.test.ts` `"carries trial_end as trialEndsAt ISO"` and `"null when the subscription has no trial"`; in `apps/web/src/server/billing-webhook.test.ts` `"applySnapshot receives trialEndsAt"`; in the linkedin sync/pg-store tests assert `trial_ends_at` is **not** written on connect.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**. **Step 4: Run** `pnpm -C packages/billing test && pnpm -C apps/web test && pnpm -C packages/jobs test` → PASS. **Step 5: Commit** `feat(billing): trial clock starts at checkout, not at LinkedIn connect`.

---

### Task 13: Help content, roadmap, audits

**Files:**
- Modify: `packages/help-content/content/getting-started.md` (rewrite: four steps, LinkedIn connect from Today, "progress starts at 20%", Common questions incl. "Why do I see prospects before connecting LinkedIn?"), `packages/help-content/content/today.md` (add `## Get started` section: the four steps, collapses after two, dismiss at four; and the "No LinkedIn connected yet" tile under Needs you), `docs/roadmap.md` (add a UX track: `- [x] **UX-1 — Activation**` with a one-line summary and the spec link; flip Phases 16/16b/16c as shipped per spec §7.8; re-scope the Phase 17 line to "pre-payment cost caps" with a note), `docs/production-readiness.md` (one line: apply `0073` before deploying UX-1)
- Run: `pnpm -C packages/help-content test` (vendor-name guardrail), the `whitelabel-auditor` subagent on `apps/web/src/app/onboarding`, `apps/web/src/components/today/get-started.tsx`, `apps/web/src/components/icp/icp-editor.tsx`; the `rls-auditor` subagent on `git diff -- packages/db`.

- [ ] **Step 1: Write the articles** (sentence case; no vendor names; "LinkedIn" is allowed). **Step 2: Run** `pnpm -C packages/help-content test` → PASS. **Step 3: Run both auditors**, fix findings. **Step 4: Full gate** `pnpm lint && pnpm type-check && pnpm test && pnpm build` → green. **Step 5: Commit** `docs(ux-1): help articles, roadmap flip, deploy note`.

---

## Ship checklist (after Task 13)

1. Rebase/merge `origin/main`; if `0070`–`0072` landed, keep `0073`; otherwise renumber to the next free number and re-run the db suite.
2. Apply the migration to prod (`supabase db query --linked -f packages/db/migrations/00NN_onboarding_milestones.sql` + history row) **before** merging.
3. Open the PR with the spec's gate statement: "a new user with a real website reaches the card step having seen ≥5 leads with signals; `onboarding_completed` fires".
4. After merge: confirm the Vercel production alias moved (`/api/version` sha) and that Trigger deployed; dispatch the drift check.

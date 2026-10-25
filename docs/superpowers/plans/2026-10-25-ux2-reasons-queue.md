# UX-2 — Reasons + One Queue + Run-State Chip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every prospect row and every approval card leads with the reason; `/approvals` and Today share one queue implementation with regenerate-with-steer; the engine's run state is visible on every page with a two-toggle popover.

**Architecture:** Pure, tested modules carry the new logic (why-now cell model, tier glyph, queue row builder, chip state, blockers); server loaders add batched reads inside existing `Promise.all`s (no new round trips in series); the existing `DraftPeek` gains a `pane` variant and becomes the single draft UI for Today and Approvals; the copy brain gains a prompt-only steer block so regenerated copy stays grounded. No migration. Onboarding files are frozen (owner rule).

**Tech Stack:** Next.js App Router (server actions, RSC + client shells), Supabase RLS reads, `@vantera/agent-brains` copy brain via `getModel()`, vitest. Rule 07 landing-parity tokens (`components/app/surface.tsx`, `components/chrome/tile.ts`), data-surface doctrine (sticky thead, row hover, density).

**Spec:** `docs/superpowers/specs/2026-10-21-activation-ux-gojiberry-gap-design.md` §3.3, §3.4, §3.6 (chrome chip + Actions stack only; activity feed and funnels are UX-3), §4, §5 "UX-2", §6.

## Global Constraints

- **Never modify** `apps/web/src/app/onboarding/**`, `lib/auth/onboarding-*`, `lib/reveal/*`, `packages/db/migrations/**` (no migration in this phase).
- Invite note cap is `CONNECTION_NOTE_MAX_CHARS = 200` (brain + send path); the spec's "≤300" is superseded — every preview, counter and lint uses `row.charLimit`.
- Steer text is **prompt-only, never grounding**: it is appended as its own block next to `exemplarBlock`, capped at 280 chars, newlines collapsed; `validateLinkedInDraft` still receives only `leadBlock(input)`.
- Regenerate is available for first-touch rows only (`scheduled_sends.origin = 'sequence'`, `linkedin_stage in ('invite','message')` produced by `draftLinkedIn`); reply-response rows show a disabled control with the reason.
- Every write keeps the `status = 'pending_review'` guard and checks affected rows (0 rows ⇒ "That draft was already handled.").
- One keyboard model: in the two-pane, the peek owns the keys (A approve · E edit · G regenerate · R reject · ←/→ prev/next · Esc leaves a mode); Fix is a button only; keys ignore INPUT/TEXTAREA/contentEditable and meta/ctrl/alt.
- `accountId` only from the session (rule 02); all new reads are RLS-scoped, batched by `.in(...)` over the visible page.
- Tenant-pinned copilot/Help: every user-visible change ships in `review-queue.md` (rewritten), `leads.md`, `today.md`, `send-modes.md` where affected; no vendor names (`packages/help-content/src/articles.test.ts`).
- "Pause everything" must be real: it pauses all agents (`agents.status='paused'`) and sets `accounts.outreach_paused = true` and `paused_at`; Resume reverses all three. Jobs gate on `agents.status` and `outreach_paused` today, not on `paused_at`.
- Layout data is a first-load snapshot: anything that changes chip state revalidates the layout (`revalidatePath("/", "layout")`) or calls `router.refresh()`.
- Rule 07: Tailwind scale only, sentence case, tokens from `surface.tsx`/`tile.ts`; no hardcoded send caps (read `safety-limits.ts` via `metrics.ts` on the server only — `@vantera/jobs` is not in `transpilePackages`, so never import it from a client component).
- Copy voice: plain words, sentence case, trust line above the queue: "Nothing is sent without your approval." (hidden in Autopilot).

## Review Focus

1. **Regenerate result lands on the wrong draft** (user presses → while a regenerate is in flight): the action result must be applied only if its `sendId` equals the open draft. Pinned in Task 7 ("stale result is dropped").
2. **Approve while a regenerate is pending**: the regenerate write must not overwrite an `approved` row (status guard + 0-row check). Pinned in Task 5.
3. **Prospect page with zero signals / no draft / no intent observations**: why-now cell shows the insight fallback, `+N` hidden, Message section says "No draft yet". Pinned in Tasks 1 and 3.
4. **Chip with zero senders and a live scout**: shows "! LinkedIn not connected · Connect", not "Finding prospects". Pinned in Task 9 (precedence tests).
5. **Pause everything then resume**: all agents come back `live`, `outreach_paused=false`, `paused_at=null`; a user with no agents gets no error. Pinned in Task 9 (action tests with a recording fake).

---

### Task 1: Pure helpers — why-now cell, tier glyph, `fmtUntil`

**Files:**
- Create: `apps/web/src/lib/prospects/why-now-cell.ts`, `why-now-cell.test.ts`
- Modify: `apps/web/src/app/(app)/prospects/lead-value.ts` (+ `lead-value.test.ts`), `apps/web/src/lib/today/metrics.ts` (+ `metrics.test.ts`)

**Interfaces (Produces):**
```ts
// lib/prospects/why-now-cell.ts (pure)
export type SignalIn = { kind: string; label: string | null; detail?: string | null; level?: string | null; observed_at?: string | null };
export type IntentPostIn = { post_ref: string; headline: string | null; detail: string | null; observed_at: string };
export type WhyNowCell = { label: string; when: string | null; href: string | null; kind: string | null; level: string | null; more: number } | null;
export function whyNowCell(signals: SignalIn[], posts: IntentPostIn[], insights: { triggers?: string[]; pain_points?: string[] } | null, now: Date): WhyNowCell;
// newest signal by observed_at (fallback created order); when = relativeDays-style "today | 3d ago | 2w ago | 3mo ago"; href = the newest intent post's post_ref only if /^https?:\/\//.test(post_ref) (the literal "follow" and URNs yield null); more = signals.length - 1 (≥0); null when no signal and no insight fallback
export type SignalGroup = { kind: string; label: string; count: number };
export function signalGroups(rows: { kind: string }[]): SignalGroup[]; // sorted by count desc, label via featureLabel(`signal:${kind}`) with fallback to the kind
// lead-value.ts
export type TierGlyph = 0 | 1 | 2 | 3;              // bars lit: hot 3, strong 2, look 1, unscored 0
export function tierGlyph(score: number | null): TierGlyph;
// lib/today/metrics.ts
export function fmtUntil(then: string | Date | null, now: Date): string; // null → "within ~15 min"; past/≤60s → "any moment now"; <60m → "in ~N min"; <24h → "in ~Nh"; else "in ~Nd"
```

- [ ] **Step 1: Tests** — `why-now-cell.test.ts`: newest signal wins; `when` buckets (today / 3d ago / 2w ago / 3mo ago at fixed `now`); href only for http(s) post_ref ("follow" → null); `more` = count−1; insight fallback when no signals (`label = triggers[0]`, `when = null`, `more = 0`); null when nothing. `signalGroups`: counts + ordering + label fallback. `lead-value.test.ts`: `tierGlyph(90)=3, (72)=2, (40)=1, (null)=0`. `metrics.test.ts`: the five `fmtUntil` buckets.
- [ ] **Step 2: Run** `pnpm -C apps/web exec vitest run src/lib/prospects src/app/\(app\)/prospects/lead-value.test.ts src/lib/today/metrics.test.ts` → FAIL.
- [ ] **Step 3: Implement** (reuse `lead-value.ts`'s private `relativeDays` by exporting it; `featureLabel` from `@vantera/agent-brains` is pure).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(prospects): why-now cell model, tier glyph, fmtUntil`.

---

### Task 2: Prospects loader — tab counts, Scheduled tab, signal filter, batched reasons

**Files:**
- Modify: `apps/web/src/app/(app)/prospects/page.tsx`, `leads-params.ts` (+ new `leads-params.test.ts`), `leads-table.tsx` (types only: `LeadRow` gains fields), `apps/web/src/components/lead-profile-fields.ts` (`lead_signals(kind,label,detail,level,source,observed_at)`)

**Interfaces (Produces):**
```ts
// leads-params.ts
export type LeadsTab = "all" | "intent" | "qualified" | "scheduled" | "in_campaign" | "replied" | "rejected"; // Scheduled sits between qualified and in_campaign in TABS
export type LeadsFilters = { industry: string; min: string; days: string; intent: boolean; signal: string }; // signal = lead_signals.kind or ""
export type TabCounts = Record<LeadsTab, number>;
// page.tsx (server) — inside the existing Promise.all:
//   7 head counts (`select("id", {count:"exact", head:true})`) — one per tab, applying the same filters/search as the main query; Scheduled = `sequence_runs!inner(status)` with `.eq("sequence_runs.status","active")`
//   `lead_signals.select("kind")` for the account (limit 2000) → signalGroups
// after the main query (batched by page ids, soft reads — failures degrade to empty):
//   intent_observations.select("lead_id, post_ref, headline, detail, observed_at").in("lead_id", ids).order("observed_at", {ascending:false})
//   scheduled_sends.select("id, lead_id, body, status, linkedin_stage, origin, style_flags").in("lead_id", ids).in("status", ["pending_review","approved","scheduled"]).order("created_at", {ascending:false})
//   lead_feedback.select("lead_id, verdict, reason") (replaces the verdict-only read)
// LeadRow gains: intent_posts?: IntentPostIn[]; queued_draft?: { id; body; status; linkedin_stage; origin; style_flags } | null; fit_reason?: string | null; why_now?: WhyNowCell (computed server-side with a module-scope `now`)
// main query signal filter: when filters.signal, `.select(LEAD_SELECT + ", lead_signals!inner(kind)")`-style inner embed with `.eq("lead_signals.kind", filters.signal)`
```

- [ ] **Step 1: Tests** — `leads-params.test.ts`: `leadsHref` omits defaults, carries `signal`, carries `tab=scheduled`; a pure `tabPredicate(tab)` table (statuses/source/scheduled flag) round-trips for all seven tabs.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the loader changes; every new filter param also goes into the jump-to-page hidden inputs, the table's search-form hidden inputs, `activeFilterCount`, and the Clear link (see leads-table.tsx ≈L392-481 and page.tsx ≈L331-340). Pass `tabCounts`, `signalGroups` to `LeadsTable` as new optional props.
- [ ] **Step 4: Run** `pnpm -C apps/web exec vitest run "src/app/(app)/prospects"` → PASS; type-check clean. **Step 5: Commit** `feat(prospects): tab counts, Scheduled tab, signal filter, batched reasons`.

---

### Task 3: Prospects table + side peek — lead with the reason

**Files:**
- Modify: `apps/web/src/app/(app)/prospects/leads-table.tsx`, `apps/web/src/components/lead-why-now.tsx` (`ScoreBadge` tier glyph, `WhyNowCell` renderer), `apps/web/src/components/lead-profile.tsx`, `apps/web/src/components/lead-fit-controls.tsx`, `apps/web/src/app/(app)/prospects/fit-actions.ts` (+ `fit-actions.test.ts` new), `apps/web/src/lib/learning/fit.ts`
- Create: `apps/web/src/components/lead-profile/sections.tsx` (collapsible `Section` primitive + `SignalsTimeline`, `MessageSection`), `apps/web/src/components/lead-profile/use-peek-nav.ts` (+ test)

**Interfaces:**
- Consumes: `whyNowCell`, `tierGlyph` (Task 1); `LeadRow` fields (Task 2); `saveDraftEdit`, `regenerateDraft` (Task 5 — the Message section calls them; until Task 5 lands, `regenerateDraft` is imported but the control is hidden when the prop `canRegenerate` is false).
- Produces:
  ```ts
  // lead-profile.tsx
  export function LeadProfileSheet(props: { lead: LeadProfile; onClose: () => void; avgDealValueCents?; goalCents?; fullProfileHref?; nav?: { index: number; total: number; onPrev: () => void; onNext: () => void }; initialSection?: "signals" | "message" }): JSX.Element;
  // LeadProfile gains the Task-2 optional fields; sections render in order: Signals · Why this rank · Why this prospect · Company · Message · Fit · CRM · Notes (Notes lazy via existing LeadNotes pattern or omitted when no `id`); footer: "Not a fit" (opens the Fit reason input) + "Open full brief"
  // use-peek-nav.ts (pure hook helpers)
  export function peekNav(ids: string[], openId: string | null): { index: number; total: number; prevId: string | null; nextId: string | null };
  // fit-actions.ts
  export async function setLeadFit(_prev: FitState, formData: FormData): Promise<FitState>; // formData gains optional `reason` (1..200 chars, trimmed; written to lead_feedback.reason; omitted when empty); `clear` unchanged
  ```
- Table: Why-now cell = `label · when` + linked post title when `href` + `+N` chip (opens peek with `initialSection:"signals"`); Score cell = tier glyph (3 bars) + number; Prospect cell gets a LinkedIn glyph link (`linkedin_url`, `target=_blank rel=noreferrer`, `aria-label="Open LinkedIn profile"`); tabs show `label · count` from `tabCounts`; filters popover adds a "Signal" group listing `signalGroups` with counts; the peek receives `nav` built from the current page's `leads` order (`peekNav`); hot-strip opens have `nav` undefined.

- [ ] **Step 1: Tests** — `use-peek-nav.test.ts` (first/last/middle/unknown id); `fit-actions.test.ts` with a recording supabase fake: reason written when present, omitted when blank, rejected >200; `lead-why-now` tier glyph renders 3/2/1/0 lit bars (static-markup test via `createElement`, pattern of `whats-working.test.ts`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Collapsible sections persist open/closed per section in `localStorage` key `vantera:peek:sections` via `useSyncExternalStore` (hydration-safe, as the density toggle does). Keep all new `LeadProfileSheet` props optional (other callers: approvals, dashboard, meetings, processed).
- [ ] **Step 4: Run** `pnpm -C apps/web exec vitest run` → PASS; type-check clean. **Step 5: Commit** `feat(prospects): reason-first rows, tier glyph, tab counts, signal filters; peek with prev/next and sections`.

---

### Task 4: Copy brain — steer block + single-stage regenerate

**Files:**
- Modify: `packages/agent-brains/src/copy/shared.ts`, `copy/linkedin.ts`, `copy/shared.test.ts`, `copy/linkedin.test.ts`, `packages/agent-brains/src/index.ts`

**Interfaces (Produces):**
```ts
export const STEER_MAX_CHARS = 280;
export function steerBlock(steer: string | null | undefined): string; // "" when blank; else "Owner direction (style and angle only — adds no facts, never a claim about the prospect):\n<collapsed, trimmed, capped>" 
export type LinkedInStage = "invite" | "message";
export async function regenerateLinkedInStage(input: DraftInput, stage: LinkedInStage, steer: string | null, model = getModel()): Promise<{ text: string; violations: Violation[] }>;
// builds basePrompt = [leadBlock, strategyDirectives, avoidBlock, exemplarBlock, steerBlock].filter(Boolean).join("\n\n"), runs the same generateHumanized flow as draftLinkedIn, validates with validateLinkedInDraft(draft, leadBlock(input) /* grounding excludes steer */, …), returns connectionNote for "invite" else followupMessage with that stage's violations
```

- [ ] **Step 1: Tests** — `shared.test.ts`: `steerBlock` blank → ""; collapses newlines; caps at 280; `linkedin.test.ts` (mock model): the steer appears in the prompt but NOT in the grounding string passed to the validator (spy/assert via a model mock that records the prompt and a draft containing a steer-only number → `ungrounded` violation fires); stage selection returns the right field.
- [ ] **Step 2: Run** `pnpm -C packages/agent-brains test` → FAIL. **Step 3: Implement** (refactor `draftLinkedIn`'s prompt assembly into a shared private `assemblePrompt(input, steer)` so both paths stay identical). **Step 4: Run** → PASS; `purity.test.ts` still green. **Step 5: Commit** `feat(copy): prompt-only steer block + regenerateLinkedInStage`.

---

### Task 5: Web — `regenerateDraft` action + first-touch draft input + write guards

**Files:**
- Create: `apps/web/src/lib/copy/first-touch-input.ts` (server-only), `first-touch-input.test.ts`
- Modify: `apps/web/src/app/(app)/approvals/actions.ts` (+ new `actions.test.ts`), `apps/web/src/app/(app)/playbook/actions.ts` (`updateSendMode` revalidates `/approvals` too)

**Interfaces (Produces):**
```ts
// lib/copy/first-touch-input.ts
export async function buildFirstTouchDraftInput(supabase: SupabaseClient, leadId: string): Promise<DraftInput | null>; // mirrors packages/jobs copy-draft.ts toDraftInput: lead + ai_insights, live copy agent config {cta, websiteUrl} (NO bookingUrl on first touch), account (name, onboarding_industry, value_prop ?? website_scan.summary, brand_voice, guardrails), proof_points, lead_signals → pickWhyNow; null when no live copy agent or lead not visible
// approvals/actions.ts
export type RegenerateResult = { body?: string; styleFlags?: string | null; error?: string };
export async function regenerateDraft(sendId: string, steer: string): Promise<RegenerateResult>;
// loads scheduled_sends (id, lead_id, linkedin_stage, origin, status) with status='pending_review'; origin !== 'sequence' → { error: "Regenerate works on first-touch drafts only." }; calls regenerateLinkedInStage(input, stage, steer, getModel()); writes { body, style_flags: describeViolations(v) ?? null } where status='pending_review' with .select("id") → 0 rows ⇒ "That draft was already handled."; revalidatePath("/approvals") + ("/today"); returns the new body + flags
// approveDraft, saveDraftEdit, fixDraft: add `.select("id")` + 0-row error (same copy); fixDraft returns { body, styleFlags } in `notice`-compatible shape so the UI can replace in place: ReviewActionState gains optional `body?: string; styleFlags?: string | null`
```

- [ ] **Step 1: Tests** — `first-touch-input.test.ts` (recording fake): omits bookingUrl, valueProp fallback to scan summary, null without live copy agent. `actions.test.ts` (mock `@vantera/agent-brains` + supabase fake + `next/cache`): reply_response → error; 0 rows → handled error; success writes body + flags and returns them; `approveDraft` 0-row error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm -C apps/web exec vitest run "src/app/(app)/approvals" src/lib/copy` → PASS. **Step 5: Commit** `feat(approvals): regenerateDraft with steer; row-count guards on draft writes`.

---

### Task 6: Shared queue builder + paginated queue loader

**Files:**
- Create: `apps/web/src/lib/today/queue.ts`, `queue.test.ts`, `apps/web/src/lib/today/queue-page.ts` (server-only)
- Modify: `apps/web/src/lib/today/data.ts` (use `buildQueueRows`), `rows.ts` (`QueueRow.origin`)

**Interfaces (Produces):**
```ts
// rows.ts
QueueRow gains origin: "sequence" | "reply_response" | "manual";
// queue.ts (pure) — extracted verbatim from loadToday's inline logic
export type QueueSendIn = { id; lead_id; body; style_flags; linkedin_stage; origin; created_at; leads: {...} | null };
export function buildQueueRows(args: { sends: QueueSendIn[]; signals: SignalRowIn[]; downSenderIds: Set<string>; now: Date; limit: number | null }): QueueRow[]; // same ordering (replies → invites → follow-ups → score desc), step derivation, evidence, sends label; limit null = all
// queue-page.ts
export async function loadQueuePage(supabase, opts: { page: number; per: number; now?: Date }): Promise<{ rows: QueueRow[]; total: number; blockers: ActionTileSpec[]; sendMode: "automatic" | "review" | "manual" | null; campaignId: string | null }>;
// blockers = blockersFor(inputs) from Task 9's lib/engine/blockers.ts — until Task 9 lands, return [] (TODO marker removed in Task 9)
```

- [ ] **Step 1: Tests** — `queue.test.ts`: ordering, step labels (Invite / Follow-up 1..3 / Reply), charLimit by stage, held flag, `limit: 5` vs `null`. Existing `data.ts`-dependent tests (`state`, `sentence`, …) untouched.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; `loadToday` calls `buildQueueRows({..., limit: QUEUE_LIMIT})` and must produce identical rows (assert by running the full web suite). **Step 4: Run** `pnpm -C apps/web exec vitest run` → PASS. **Step 5: Commit** `refactor(today): extract buildQueueRows; add loadQueuePage`.

---

### Task 7: DraftPeek — pane variant, steer + regenerate, preview, in-place replace

**Files:**
- Modify: `apps/web/src/components/today/draft-peek.tsx`, `apps/web/src/components/today/work-card/reject-reasons.ts` (single source for `RejectReason`/labels; delete the duplicate in draft-peek), `apps/web/src/app/(app)/today/today-client.tsx` (no behavior change)
- Create: `apps/web/src/components/today/draft-preview.tsx`, `apps/web/src/components/today/peek-result.ts` (+ test)

**Interfaces (Produces):**
```ts
export function DraftPeek(props: { rows: QueueRow[]; openId: string | null; onClose: () => void; onNavigate: (id: string) => void; onRemoved: (id: string, outcome: "approved" | "rejected" | "suppressed") => void; variant?: "sheet" | "pane"; onSuppress?: (id: string) => Promise<{ error?: string }> }): JSX.Element | null;
// pane: no overlay, no fixed positioning, no focus trap; Escape only leaves edit/reject/steer mode; renders inside the caller's grid cell; keys unchanged (A E G R ← → Esc); G = regenerate with the current steer text (empty allowed); Fix = button shown only when styleFlags; "Decline & never contact" (ConfirmDialog) in the footer overflow when onSuppress is provided
// draft-preview.tsx
export function DraftPreview(props: { body: string; stage: "Invite" | "Follow-up 1" | "Follow-up 2" | "Follow-up 3" | "Reply"; charLimit: number }): JSX.Element; // Invite → LinkedIn "Add a note" card with counter `${len}/${charLimit}` (red when over); others → DM bubble
// peek-result.ts (pure)
export function applyIfCurrent<T extends { sendId: string }>(openId: string | null, result: T): T | null; // drops results for a draft that is no longer open
```
Also: Fix now replaces the body in place from `ReviewActionState.body` (Task 5); remove the `row.body = body` prop mutation (local state keyed by `row.id`); relative date + tier glyph next to the score chip in the header (`tierGlyph`, `fmtRelative`).

- [ ] **Step 1: Tests** — `peek-result.test.ts`: stale result dropped, current applied. `reject-reasons.test.ts` still green after the dedupe.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; skeleton (pulsing lines, `aria-busy`) while regenerate/fix is pending; steer `<textarea maxLength={280}>` under the draft with placeholder "Make it shorter, lead with the hiring signal…". **Step 4: Run** `pnpm -C apps/web exec vitest run` + type-check → PASS; `today-preview` route still renders (update its fixtures if props changed). **Step 5: Commit** `feat(queue): DraftPeek pane variant, steer + regenerate, LinkedIn preview, in-place replace`.

---

### Task 8: Approvals rebuilt on the shared queue (two-pane)

**Files:**
- Create: `apps/web/src/app/(app)/approvals/queue-client.tsx`, `apps/web/src/app/(app)/approvals/mode-switch.tsx`, `apps/web/src/app/(app)/approvals/blockers-stack.tsx`
- Modify: `apps/web/src/app/(app)/approvals/page.tsx` (queue view → `loadQueuePage`; Processed view unchanged), `bulk-approve.tsx` (unchanged API), `processed-conversation.tsx` (unchanged), `apps/web/src/server/copilot/navigate-tools.ts:25` (anchor stays `approve-draft` — put `data-copilot="approve-draft"` on the peek's Approve button)
- Delete: `approvals/draft-card.tsx`, `prospect-review-card.tsx`, `review-hotkeys.tsx`

**Interfaces:**
- Consumes: `loadQueuePage` (6), `DraftPeek variant="pane"` (7), `approveFromToday`/`rejectDraftWithReason`/undo actions (today), `declineAndSuppress` + `approveAllClean` (approvals), `updateSendMode` (5), `ActionTile` (today).
- Produces: `/approvals?view=queue&page=N&draft=<sendId>` — grid `lg:grid-cols-[380px_minmax(0,1fr)]`; left: trust line (Review mode only) + `BlockersStack` (compact `ActionTile`s for blocking kinds) + `ModeSwitch` + the queue list (reuse `QueueTable` rows from `work-card` extracted to `components/today/work-card/queue-list.tsx` with `interactive={false}` in pane mode) + pagination; right: `DraftPeek variant="pane"` auto-opening the first row when `draft` is absent; mobile stacks list then pane. `ModeSwitch({ sendMode, campaignId })`: segmented Autopilot | Review; switching to Autopilot uses the ConfirmDialog copy from `agent-card.tsx:186-205` verbatim; posts `updateSendMode`. Deleted keys j/k/o/d/e/? are gone; `?` shows the new key hint.
- `/campaigns` server redirect and `shell-route.ts` `oneScreen` for `/approvals` unchanged.

- [ ] **Step 1: Tests** — `approvals/queue-nav.test.ts` (pure): first-row auto-open, `?draft` precedence, after removal → next id. Existing `validation.test.ts` green.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; grep for `data-review-group`/`data-hotkey` usages (only the deleted files) and `DraftRow` imports. **Step 4: Run** `pnpm -C apps/web exec vitest run` + type-check + `pnpm -C apps/web lint` → green. Manual: `/approvals` renders two panes with keys working. **Step 5: Commit** `feat(approvals): two-pane queue on the shared work card + DraftPeek; Autopilot|Review switch; blockers stack`.

---

### Task 9: Engine state loader, chrome status chip + popover, real pause/resume

**Files:**
- Create: `apps/web/src/lib/engine/state.ts` (server-only, `cache()`d), `apps/web/src/lib/engine/chip.ts` (+ test), `apps/web/src/lib/engine/blockers.ts` (+ test), `apps/web/src/components/chrome/status-chip.tsx`, `apps/web/src/components/chrome/engine-popover.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx` (add the 3 reads to the existing `Promise.all`; pass `chip` to chrome), `components/chrome/top-chrome.tsx`, `mobile-chrome.tsx`, `index.ts`, `apps/web/src/app/(app)/engine-actions.ts` (+ new `engine-actions.test.ts`), `apps/web/src/lib/today/queue-page.ts` (use `blockersFor`), `apps/web/src/app/(app)/playbook/agent-card.tsx` + `agent-showcase.tsx` (use `fmtUntil`; delete `formatRun`/`timeUntil`)

**Interfaces (Produces):**
```ts
// lib/engine/state.ts
export type EngineState = { pausedAt: string | null; billing: TodayInputs["billing"]; senders: SenderFacts[]; agents: { kind: "scout"|"intent"|"copy"; status: "draft"|"live"|"paused"; nextRunAt: string|null; lastRunAt: string|null }[]; draftsHeld: number };
export const loadEngineState: (supabase: SupabaseClient, account: { paused_at; plan; subscription_status; … }) => Promise<EngineState>; // React cache(); reads linkedin_accounts, agents, today's outreach_sends (reuse loadToday's sender-facts builder, extracted to lib/today/sender-facts.ts)
// lib/engine/chip.ts (pure)
export type ChipState = { dot: "running" | "attention" | "stopped" | "paused"; label: string; detail: string | null; href: string | null; nextRunAt: string | null };
export function chipFor(s: EngineState, now: Date): ChipState;
// precedence: senders down → "! <name> disconnected · Reconnect" (/settings/senders); no senders → "! LinkedIn not connected · Connect"; billing past_due → "! Payment failed · Fix" (/settings/billing); pausedAt → "◌ Paused by you · Resume"; healthy sender with sends today → "● Sending · N of M invites today"; live scout/intent → "● Finding prospects · next run <fmtUntil>"; else "● Ready"
// lib/engine/blockers.ts
export function blockersFor(s: EngineState): ActionTileSpec[]; // tilesFor-equivalent subset: sender_disconnected, sender_restricted, payment_failed, sender_missing, engine_paused
// engine-actions.ts
export async function setAgentGroup(group: "sourcing" | "outreach", status: "live" | "paused"): Promise<{ error?: string }>; // sourcing = scout+intent, outreach = copy; revalidatePath("/", "layout") + "/playbook" + "/today"
export async function pauseEngine(): …; export async function resumeEngine(): …; // now also: agents.status for all live agents → paused (resume: paused → live), accounts.outreach_paused true/false, paused_at set/cleared
```
Chrome: `StatusChip` button (h-9, `CHROME_PILL`, dot by `dot` tone, label + muted detail; `title` = absolute next run) placed at the start of the right cluster, truncating below `xl`; click opens `EnginePopover` (`useDismiss`, `CHROME_MENU` widened to `w-80`): two `role="switch"` rows "Sourcing — Prospect + Intent agents" and "Outreach — Outreach agent" bound to `setAgentGroup`, then "Pause everything / Resume everything" bound to `pauseEngine`/`resumeEngine`; mobile top bar shows dot + short label. Client components receive `ChipState` only (serializable); a 60 s `useEffect` tick re-renders `fmtUntil` from `nextRunAt` after mount (no `Date.now()` during render).

- [ ] **Step 1: Tests** — `chip.test.ts`: all seven precedence cases incl. Review Focus 4; `blockers.test.ts`: kinds + ordering; `engine-actions.test.ts` (recording fake): pause sets three things, resume reverses, no agents → no error, non-admin (0 rows) → error. `metrics.test.ts` `fmtUntil` already green.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm -C apps/web exec vitest run` + type-check + lint → green; manual: chip visible on every app page, popover toggles work. **Step 5: Commit** `feat(chrome): run-state chip with Sourcing/Outreach popover; pause everything is real`.

---

### Task 10: `agentAttention` returns a CTA; Playbook + Approvals render the Actions stack

**Files:**
- Modify: `apps/web/src/app/(app)/playbook/agent-health.ts` (+ `agent-health.test.ts`), `agent-card.tsx`, `agent-showcase.tsx`, `agent-showcase-data.ts`, `page.tsx`

**Interfaces (Produces):**
```ts
export type Attention = { reason: string; cta: { label: string; href: string } } | null;
export function agentAttention(input: AttentionInput): Attention; // same triggers; CTAs: no LinkedIn → {"Connect LinkedIn", "/settings/senders"}; empty watchlist → {"Edit watchlist", "/playbook/intent"}; reads failed → {"Reconnect", "/settings/senders"}; failed run / 0 prospects / scoring failed → {"Run now", "/playbook/<kind>"}; low_credits → {"Check sourcing capacity", "/settings/billing"}; trial_cap → {"Pick a plan", "/settings/billing"}; preview_full → {"Connect LinkedIn", "/settings/senders"}; criteriaPending → {"Edit ICPs", "/playbook/scout/edit"}
```
`AgentCard.attention`, `ShowcaseAgent.attention`, `toShowcaseAgent` adopt the type; the amber sentence becomes reason + a CTA button. Approvals' stack (Task 8) already uses `blockersFor`; Playbook cards render `attention` the same visual way.

- [ ] **Step 1: Tests** — update the ~12 `agent-health.test.ts` assertions to `.reason` matches + assert each CTA href; `.toBeNull()` cases unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; type-check. **Step 5: Commit** `feat(playbook): agentAttention returns a CTA; cards render the Actions stack`.

---

### Task 11: Help, roadmap, audits, gate

**Files:**
- Modify: `packages/help-content/content/review-queue.md` (rewrite: two panes, keys A/E/G/R/←/→/Esc/?, Regenerate with steer, Fix for style flags, Preview, Autopilot | Review switch, blockers above the list, Processed tab), `leads.md` (why-now with date and post link, `+N`, tier bars, tab counts incl. Scheduled, signal filters, peek sections, Not a fit with a reason), `today.md` (status chip sentence), `send-modes.md` ("Where to switch" adds Approvals), `docs/roadmap.md` (UX track: `- [x] **UX-2 — Reasons + one queue + run-state chip**` one-liner with spec/plan links)
- Run: `pnpm -C packages/help-content test`; `whitelabel-auditor` on `apps/web/src/app/(app)/approvals`, `components/chrome/status-chip.tsx`, `engine-popover.tsx`, `components/today/draft-peek.tsx`, `draft-preview.tsx`, `components/lead-profile*`; full gate `pnpm lint && pnpm type-check && pnpm test && pnpm build`.

- [ ] **Step 1: Write articles** (sentence case, no vendor names). **Step 2:** help test → PASS. **Step 3:** auditor + fixes. **Step 4:** full gate green. **Step 5: Commit** `docs(ux-2): approvals, prospects, today and send-mode help; roadmap`.

---

## Ship checklist
1. Merge `origin/main`; full gate; no migration to apply.
2. PR with the spec's gate statement: "approvals keyboard model identical on Today and Approvals (shared component); regenerate-with-steer passes the humanizer lint test; whitelabel-auditor pass."
3. After merge: confirm `/api/version`, Trigger deploy (no jobs change expected), chip visible in production.

# Warmup-aware prospecting — capacity-coupled Scout (2026-06-15)

## Goal

Stop the Scout (Prospect) Agent from pulling, enriching, and drafting leads faster
than they can actually be reached during the email-warmup window (rule 03: warmup is
time-gated 2–4 weeks). Today the Scout discovers a flat `prospectsPerRun: 25` every
run, spends Explorium enrichment on every rules-gate survivor, and drafts — with **zero
awareness of outreach capacity**. When email sending is live (Phase 5), that produces
an aging backlog of leads that were scored on now-stale signals, enriched at a cost
that partly goes to waste, and a new user who sees no outreach for weeks.

Couple discovery to capacity so the system protects three things at once (owner: all
three, balanced):

1. **Lead freshness / value** — leads get contacted on current signals, not 3-week-
   stale triggers.
2. **Wasted enrichment spend** — don't enrich (or re-enrich) faster than leads can be
   acted on.
3. **Activation UX** — a new user sees real outreach within days (LinkedIn leads the
   sequence while email warms), never a multi-week dead zone.

Chosen approach: **capacity gate inside the Scout run** (Approach A) — reuse the
existing `safety-limits` capacity primitive, add a per-run pull target, a refresh-on-
release step for aged leads, and a light warmup status surface. No new cron, no
control-flow inversion.

## What already exists (reused, not rebuilt)

- **LinkedIn is already first in the sequence.** `SEQUENCE_DEFAULTS.order =
  ["linkedin", "email", "imessage", "call"]`
  (`packages/jobs/src/pipeline/sequence-config.ts`). "LinkedIn-first during warmup" is
  largely already the behavior; email sits behind a stage gate.
- **Email sends are already warmup-gated at the send boundary** (Phase 5 send-dispatch
  — roadmap line 33: "warmup status gating sends"). A draft reaching the email stage
  while a mailbox is `warming` is not sent into a cold inbox.
- **`dailyAllowance(channel, accountAgeDays, opts)`**
  (`packages/jobs/src/pipeline/safety-limits.ts`) — the per-channel ceiling primitive:
  LinkedIn ramp 5→10→15→20/day (`LINKEDIN_RAMP`, weekly ceiling 100), email
  `EMAIL_STEADY_DAILY_PER_MAILBOX = 30`. Non-configurable below safety thresholds
  (rule 04). Reused as the capacity source of truth; capacity can only ever *reduce*
  the pull below the configured max, never raise it.
- **Warmup state model.** `WarmupStatus { mailboxId, phase: "warming" | "ready",
  dailyCap }` (`packages/email-infra/src/types.ts`) + the inbound `warmup_update`
  handler (`packages/jobs/src/pipeline/inbound.ts`) persisting mailbox phase + daily
  cap (migration 0009).
- **The Scout run core** (`packages/jobs/src/pipeline/scout.ts`): discover → rules gate
  → enrich survivors (Explorium "Tier 1") → batched AI rank → persist → chain Copy /
  Caller. Only the discovery-volume decision changes.
- **The dashboard activation hub** (merged from `phase-activation-hub`) — the home for
  the warmup expectation-setting surface.

## 1. Capacity model — the throttle

A pure function plus a store read; pure logic stays out of Trigger.dev/drizzle (rule 13).

**Store method** `getOutreachCapacity(accountId): OutreachCapacity` (impl in
`pg-store.ts`, fake in `in-memory.ts`):

```ts
interface OutreachCapacity {
  linkedinConnected: boolean;
  linkedinAccountAgeDays: number | null; // null when not connected
  mailboxes: { phase: "warming" | "ready"; dailyCap: number }[]; // warming carries provider cap
  emailEnabled: boolean;    // an Outreach agent has the email channel on
  linkedinEnabled: boolean; // ... LinkedIn channel on
}
```

**Pure function** `computeRunTarget(capacity, opts)` (in
`packages/jobs/src/pipeline/` core, colocated test):

- `linkedinDaily = linkedinConnected && linkedinEnabled
    ? dailyAllowance("linkedin", linkedinAccountAgeDays)  // 5/10/15/20
    : 0`
- `emailDaily = emailEnabled
    ? Σ mailbox (phase === "ready" ? EMAIL_STEADY_DAILY_PER_MAILBOX : dailyCap)
    : 0`
- `dailyCapacity = linkedinDaily + emailDaily`
- `runTarget = clamp( round(dailyCapacity × cadenceDays × bufferFactor) − currentBacklog,
    floor, ceiling )`
  - `cadenceDays`: 1 (daily) or 7 (weekly), from the agent schedule.
  - `bufferFactor`: ~1.3 — small headroom so the sequence never starves.
  - `currentBacklog`: count of in-flight leads not yet contacted (qualified / drafted /
    enrolled but no send recorded) for this account.
  - `floor`: a small positive minimum batch applied **only when `dailyCapacity > 0`**
    (so a channel with tiny capacity still pulls a sensible small batch, not 1–2);
    when `dailyCapacity === 0` the target is `0`.
  - `ceiling`: `config.prospectsPerRun` (25) — the throttle only reduces below the
    configured max.

**Behavior:** during warmup, `emailDaily` is small (provider `dailyCap`) so `runTarget`
is dominated by LinkedIn's ramp — a small fresh trickle matched to what can actually be
sent. As mailboxes warm then flip to `ready`, `runTarget` climbs to the full ceiling.

**Dead-zone guard:** if neither channel can act (no LinkedIn connected/enabled **and**
every mailbox `warming` with `dailyCap` 0 → `dailyCapacity === 0`), `runTarget` is **0**:
discovery is skipped (§2) and the UX (§5) nudges the user to connect LinkedIn to start
reaching out today. There is no point enriching leads no channel can reach.

## 2. Scout integration

In `runScout` (`scout.ts`), before discovery:

```ts
const capacity = await deps.store.getOutreachCapacity(accountId);
const runTarget = computeRunTarget(capacity, {
  cadenceDays: cadenceDaysFor(ctx.agent.schedule),
  currentBacklog: await deps.store.countUncontactedLeads(accountId),
  bufferFactor, floor, ceiling: config.prospectsPerRun,
});
```

Then `perIcp = Math.max(0, Math.floor(runTarget / ctx.icps.length))` replaces the
current flat `prospectsPerRun` math at `scout.ts:37`. If `runTarget === 0`, discovery is
skipped for the run (a no-op run, not an error). Everything downstream — rules gate,
survivor enrichment, AI rank, Copy/Caller chaining — is unchanged. Because fewer leads
are pulled, **less Tier 1 enrichment is spent: wasted spend is bounded as a side-effect
of the throttle**, with no enrichment-tier surgery.

## 3. Enrichment / spend placement

- **Tier 1** (Explorium signals/technographics, `enrichProspects` at `scout.ts:59`)
  stays at pull — the AI rank requires it — but is now throttle-bounded.
- **Tier 2** waterfall (email verification, phone validation, premium — rule 05) is
  **not built yet.** The spec records the placement rule so it lands correctly: spend
  Tier 2 at the **send-readiness boundary** (just before a touch fires), never at pull.
  This is forward-correct and builds nothing now.

## 4. Refresh-on-release

Even with a small backlog, a lead can sit between "LinkedIn stage done" and "email
mailbox ready." When the sequence is about to fire an **email** touch:

- Pure check `needsRefresh(scoredAt, now, freshnessWindowDays ≈ 12)`.
- If stale: re-pull signals for that single lead → re-run the AI rank for it → update
  `ai_score` / `ai_insights` / `scored_at` → regenerate the email draft from the fresh
  insights before sending.
- If the refreshed score drops below `min_score`, the lead **exits the sequence**
  (sequence-level archive/stop — **not** the suppression list, which is reserved for
  rule 11 events).
- Fires only for actually-aged leads, so refresh cost is bounded.

Placement: the freshness decision is pure (`needsRefresh`); the refresh action hooks the
email branch of the sequence-touch / send path (`sequence-touch.ts` /
`send-dispatch.ts`). **The suppression check stays exactly where it is at the send
boundary — the refresh path routes through it, never around it (rule 11).**

## 5. Activation UX (light surface)

- White-labeled DTO `WarmupStatus` (no vendor names): `{ emailPhase: "warming" |
  "ready", estReadyInDays: number | null, mailboxesReady: number, mailboxesTotal:
  number, linkedinConnected: boolean, channelsLiveNow: ("linkedin" | "email")[] }`.
  `estReadyInDays` is an approximate estimate from warmup start + a standard warmup
  target, always rendered with a "~".
- Dashboard / activation hub card: **"Inboxes warming — email outreach begins in ~N
  days,"** with a progress indicator, framing LinkedIn activity + the building pipeline
  as momentum. When LinkedIn is the only dead-zone blocker, show a "Connect LinkedIn to
  start reaching out today" CTA.
- Ships a **help-content article** + a **read-tier copilot tool** exposing warmup status
  (knowledge-sync, rule 09).

## 6. Data model & framework fit

- Reuses existing Phase 5 mailbox/warmup state (migration 0009) and the
  `linkedin_accounts` connection/age; adds the `getOutreachCapacity` and
  `countUncontactedLeads` read queries (RLS-scoped, account from session — rule 02).
- The freshness check reads the existing **`leads.scored_at`** timestamp (set by
  `saveScore` on every rank) — **no schema change needed**. This feature adds read
  queries only, no migration.
- Tunables (`bufferFactor`, `floor`, `freshnessWindowDays`) live in `agents.config`
  jsonb — **no new one-off columns** (rule 13).
- Six-piece framework fit: pure brain/core fns (`computeRunTarget`, `needsRefresh`) +
  pipeline core/store methods + UX surface + help article.

## 7. Testing & compliance (rules 11 / 12 / 13)

- **Unit:** `computeRunTarget` across scenarios (all-warming, LinkedIn-only, all-ready,
  backlog over/under ceiling, dead-zone floor) and `needsRefresh` (inside/outside
  window).
- **Pipeline:** scout-run under warmup → reduced discovery count **and** bounded
  enrichment spend; refresh-on-release → re-rank then send; refresh-below-min →
  sequence exit (no send, not suppressed).
- **Suppression (rule 11):** a suppressed lead is never sent to, including via the
  refresh path — the refresh routes through the existing send-boundary suppression
  check.
- In-memory fakes for the new store methods; white-label scan of the `WarmupStatus` DTO
  + help article (no vendor names — Smartlead/Unipile/Explorium stay hidden).

## Build order (one spec, natural phasing)

1. Capacity throttle in the Scout (§1–§2) — pure fn + store reads + scout-run wiring.
2. Refresh-on-release (§4) — `needsRefresh` + email-touch hook.
3. Activation UX (§5) — DTO + dashboard card + help article + copilot tool.

## Out of scope

- Building the Tier 2 enrichment waterfall (only its placement rule is recorded, §3).
- iMessage / Caller capacity in the throttle (capacity v1 = the two ramping/gated
  channels, LinkedIn + email); later stages are lower-volume and downstream of these.
- Control-flow inversion / demand-pull (Approach C) and a standalone capacity-planner
  cron (Approach B).
- Deliverability alarm dashboards (Phase 8).

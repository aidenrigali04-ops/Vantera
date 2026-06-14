# Outreach Sequence Orchestrator — Design

**Date:** 2026-06-14
**Status:** Approved (pending spec review)
**Branch:** `phase-sequence-orchestrator`

## Problem

Today the outreach pipeline is **parallel and per-channel**: one Copy agent drafts
LinkedIn + Email at the same time (`agents.config.channels: {linkedin, email}`), and a
separate Caller agent runs on its own schedule. There is no per-lead progression where one
channel waits for the previous to fail, and no single place that decides "did this lead
convert? if not, escalate to the next channel."

We want every validated prospect to flow through a **strict, conversion-gated sequence**:

```
LinkedIn  →  Email  →  iMessage  →  Caller (×2)
```

- Each stage runs its touches, then waits a window for conversion before escalating.
- A **verified conversion** (CTA completed / meeting booked) at any stage closes the lead
  and skips all remaining stages.
- A **non-conversion reply** pauses the sequence for human handling.
- After the Caller's **2** attempts with no conversion, the lead is **archived** ("filtered
  out").

### Channel order rationale

Escalation runs least-intrusive / most-professional first to most-personal last. LinkedIn and
email are expected B2B touches. Texting a personal phone (iMessage) is a real intrusiveness
jump, so it sits immediately before the call and warms the eventual call ("tried reaching you,
mind if I give you a quick ring?"). We only reach for the personal phone — text, then call —
after the professional channels are exhausted.

## Goals

- A per-lead state machine that walks a lead through ordered stages with conversion gates.
- Reuse existing **executors** (`copy-draft`, `outreach-send`, `call-brief`, `call-dispatch`)
  rather than rewriting channel logic. The orchestrator is a new layer *above* them.
- Add **iMessage** as a new channel, stubbed behind an infra interface (no real provider yet).
- Verified-CTA conversion gate that cancels remaining touches.
- Non-conversion replies pause the sequence and notify the user on the lead.

## Non-Goals (deferred to later specs)

- Real iMessage provider (LoopMessage / Sendblue) — stubbed infra + in-memory fake only.
- Agent **auto-reply** engine — the "let agent handle the conversation" action is surfaced as
  a stubbed button; the conversation handler is a separate feature.
- Real booking-provider **verification** webhook (Calendly/Cal.com) — modeled behind a stubbed
  interface; the v1 concrete conversion trigger is a tracked CTA-link click.

The UI/UX surfaces ARE in scope this build — see the UI/UX section below.

## Architecture

Follows the established pattern in `packages/jobs`: a **pure core** (`advanceSequence`)
decides what to do, a thin **Trigger.dev wrapper** performs side effects through a `pg-store`.
Purity is enforced by the existing `purity.test.ts`.

```
sequence-orchestrator (Trigger.dev cron, */15)
        │  getDueSequenceRuns(now)
        ▼
advanceSequence(run, ctx) ─→ Decision[]   (pure)
        │
        ▼  wrapper applies effects via pg-store
   ├─ trigger executor task (copy-draft | imessage-send | call-brief)
   ├─ update sequence_runs (stage / touches / next_action_at / status)
   ├─ update leads.status, campaign_leads.status
   └─ cancel pending scheduled_sends (on conversion)
```

### Why a cron tick (not per-lead self-scheduling)

A `*/15` scheduled task that scans `sequence_runs WHERE status='active' AND next_action_at<=now`
mirrors the existing `agent-scheduler`. It is easy to reason about, easy to test (drive the
pure core with table-driven cases), and recovers naturally from missed/lost tasks. Per-lead
self-scheduling Trigger tasks were rejected as harder to observe and test.

## Data Model

### `sequence_runs` (new table, migration `0017_sequence_runs.sql`)

One active run per lead per campaign.

| column           | type        | notes |
|------------------|-------------|-------|
| `id`             | uuid pk     | |
| `account_id`     | uuid        | FK accounts, RLS denormalization |
| `campaign_id`    | uuid        | composite FK (campaign_id, account_id) |
| `lead_id`        | uuid        | composite FK (lead_id, account_id) |
| `status`         | text        | `active \| paused_reply \| converted \| exhausted \| stopped` |
| `current_stage`  | text        | `linkedin \| email \| imessage \| call \| done` |
| `touches_done`   | smallint    | touches completed in current stage, default 0 |
| `call_attempts`  | smallint    | caller attempts so far, default 0 |
| `next_action_at` | timestamptz | when the orchestrator should next act |
| `entered_stage_at` | timestamptz | |
| `last_touch_at`  | timestamptz | |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` trigger |

- `unique (campaign_id, lead_id)` — one run per lead per campaign.
- Index `sequence_runs_due_idx on (status, next_action_at)` — the orchestrator hot path.
- Composite FKs + standard `is_account_member` / `is_account_admin` RLS policies. Writes are
  service-role only (the orchestrator); members get `select`.

### Sequence config — `campaigns.sequence_config jsonb` (new column)

Ordered, per-stage config. Stages can be disabled (auto-skipped).

```jsonc
{
  "order": ["linkedin", "email", "imessage", "call"],
  "stages": {
    "linkedin": { "enabled": true, "touches": 2, "touch_gap_days": 2, "wait_days": 3 },
    "email":    { "enabled": true, "touches": 2, "touch_gap_days": 2, "wait_days": 3 },
    "imessage": { "enabled": true, "touches": 1, "touch_gap_days": 2, "wait_days": 2 },
    "call":     { "enabled": true, "max_attempts": 2, "touch_gap_days": 2, "wait_days": 2 }
  }
}
```

Two distinct intervals per stage: **`touch_gap_days`** spaces successive touches *within* a
stage; **`wait_days`** is the post-stage conversion window held open *after* the last touch
before escalating to the next stage.

Defaults provided in code (`SEQUENCE_DEFAULTS`) so existing campaigns work without a config.
A dedicated `sequences` table was considered but rejected as premature — the config is small,
campaign-scoped, and has one owner. (Revisit if sequences need to be reused across campaigns.)

### Existing tables touched

- `scheduled_sends.channel` check → add `'imessage'`.
- `suppression_entries` kind → add `'imessage'` (or reuse `'phone'`; decided in plan).
- `leads.status` already has `converted` and `archived` — no new values needed.
- `campaign_leads.status` already has `replied`, `completed`, `suppressed` — reused.

## The Pure Core: `advanceSequence(run, ctx) → Decision[]`

`ctx` carries: the campaign's resolved sequence config, the lead's available channel
identifiers (`linkedinUrl`, `email`, `phone` + statuses), suppression hits, account-paused /
kill-switch flags, and `now`. The function returns `Decision` effects; it performs no I/O.

Per due run:

1. **Stage not started** (`touches_done === 0`, just entered) → emit `DispatchTouch(stage)`
   via the stage's executor; `next_action_at = now + touch_gap_days`; `last_touch_at = now`.
2. **Touches remain** (`touches_done < stage.touches`) → emit next `DispatchTouch`;
   increment `touches_done`; `next_action_at = now + touch_gap_days`.
3. **Touches exhausted** (`touches_done >= stage.touches`) → set
   `next_action_at = now + wait_days` (the conversion window). When that window has elapsed and
   the run is still `active` → **advance** `current_stage` to the next *enabled* stage with an
   available identifier; reset `touches_done = 0`, `entered_stage_at = now`.
4. **Caller stage**: each touch is a call attempt; increment `call_attempts`. When
   `call_attempts >= max_attempts (2)` and not converted → `status = exhausted`,
   `lead → archived`, `campaign_lead → completed`.
5. **No next enabled stage** → `current_stage = done`, `status = exhausted`, archive.

**Skip rules** (emit `SkipStage`, advance without dispatch):
- Stage disabled in config.
- Missing channel identifier (no LinkedIn URL / no valid email / no phone).
- Suppression hit for that channel/value.

**Hold rules** (emit nothing, leave `next_action_at` unchanged): account paused or global kill
switch on.

**Idempotency:** the wrapper claims a run before dispatch via an optimistic status/`updated_at`
guard (mirrors `claimSending`) so two overlapping ticks can't double-dispatch.

## The Gates

### Conversion gate (CTA verified)

A `markConverted(leadId, source)` store path. **v1 concrete trigger:** a tracked CTA link
(the campaign's booking link) is click-tracked; a click that resolves to a booking marks the
lead converted. Booking-provider *verification* (Calendly/Cal.com webhook) is modeled behind a
stubbed `ConversionVerifier` interface, wired later.

On conversion:
- `lead.status → converted`, `sequence_runs.status → converted`.
- **Cancel all pending `scheduled_sends`** for the lead (reuse the inbound handler's
  `cancelPendingSends`).
- `campaign_leads.status → completed`. Remaining stages skipped.

### Non-conversion reply gate

Extend the existing `inbound` handler (which already classifies replies and cancels pending
sends). On any genuine reply:
- `sequence_runs.status → paused_reply`, `lead.status → replied`.
- Emit an **in-app notification on the lead** (the "Replied" surfacing).
- The sequence stops advancing. The user can reply themselves, or press **"let agent handle"**
  (stubbed action — see Non-Goals).
- A `not_interested` verdict additionally adds suppression and sets `status → stopped`
  (no resume).

Resume from `paused_reply` (user opts to continue the sequence) flips `status → active` and is
included; full agent-driven conversation handling is out of scope.

## iMessage Stage (stubbed)

New package `packages/imessage-infra`, mirroring `email-infra` / `voice-infra`:
- `ImessageInfra` interface: `sendMessage(...)`, `parseEventWebhook(...)`.
- **In-memory fake** for tests and local/dev; no real provider call.
- An iMessage executor (paralleling `copy-draft` → `outreach-send`) drafts the body via the
  existing `agent-brains` copy layer and records a `scheduled_sends` row with `channel='imessage'`.
- Requires `leads.phone` (already present, with `phone_status`). No phone → stage skipped.

## UI / UX

Four flow-shaped surfaces, each carrying a **Retention Brief** (the design-time psychology
contract). Visual implementation routes through `ultimate-ui-builder`, which consumes these
Briefs as its step-1 input. Value-proof copy uses real account data — `revenue_goal_cents`
(the onboarding MRR goal), `avg_deal_value_cents`, `convertedClients`, `pipelineLeads` — never
placeholder numbers. Together the four form one loop: **configure → watch it work → respond →
win**; omitting any one reopens a churn gap.

### 1. Sequence Builder — configure the flow
- **Brief:** new/activating · *social proof / defaults* · confirm-and-launch the default
  sequence (editing optional) · preview copy "2 LinkedIn touches → 2 emails → a text → up to 2
  calls, stops the instant they book" · defuses setup-paralysis / blank-editor abandonment.
- View/edit the ordered stages with per-stage `touches`, `touch_gap_days`, `wait_days`,
  enable/disable, the CTA/booking link, and caller `max_attempts`. **Pre-filled with
  `SEQUENCE_DEFAULTS`** — a blank editor is the wrong default. Edits write
  `campaigns.sequence_config`.

### 2. Pipeline Progress View — per-lead stage tracker
- **Brief:** habitual · *goal-gradient* · open and see the pipeline is alive · live stage
  distribution + pipeline value vs. the MRR goal · defuses the silent-waiting cliff.
- A view of leads grouped by `sequence_runs.current_stage`
  (LinkedIn / Email / iMessage / Caller / done), with a live count per stage ("18 in LinkedIn,
  7 in Email, 3 being called") and a goal-progress bar from real `avg_deal_value_cents ×
  converted` against `revenue_goal_cents`. Empty state points to "launch a campaign" — never a
  dead end.

### 3. Replied Pause + Handoff — the reply moment
- **Brief:** activated, at aha · *hook model + variable reward* · open the replied lead and
  choose respond-yourself vs. let-agent-handle · the real inbound message shown inline ·
  defuses a reply rendering as a silent status flip.
- When `sequence_runs.status = paused_reply` / `lead.status = replied`, an in-app notification
  fires and the lead detail shows the inbound message in context with two actions: **Respond
  yourself** (compose/send on the channel) and **Let agent handle** (stubbed button — the
  auto-reply engine is a Non-Goal). A `not_interested` reply shows as stopped/suppressed.

### 4. Conversion Moment — booked-meeting celebration
- **Brief:** proving value, deep aha · *peak-end rule* · register the win and look to the next
  · the converted lead against the goal "1 of N toward your $X/mo" · defuses value delivered
  but never displayed.
- On `markConverted`, a celebratory surface (not a silent table-row update) ties the win to
  `revenue_goal_cents` progress. Reuses the existing dashboard goal vocabulary
  (`goal/mo`, converted clients).

**Churn check (mandatory, passed):** no empty state without a next action; all progress is tied
to the MRR goal; the conversion success is an explicit moment, not a silent update; the reply
notification delivers a real reward (the message body); no placeholder numbers — all copy reads
from real account fields.

## Error Handling

- Lost/stale ticks: the due-scan recovers any run whose `next_action_at` has passed.
- Double-dispatch: optimistic claim guard on the run.
- Executor failure: the executor already owns its own retry/fail semantics
  (`scheduled_sends.status='failed'`); the orchestrator does not block the rest of the sequence
  on a single failed touch — it advances on the configured schedule.
- Missing identifiers / suppression / disabled stage: skip and advance (never stall).
- Account paused / kill switch: hold, do not advance.

## Testing

- **`advanceSequence` pure core** — table-driven tests (style of `schedule.test.ts` and the
  existing `pipeline/*.test.ts`): first-touch dispatch, mid-stage touch, exhaustion → window →
  advance, disabled-stage skip, missing-identifier skip, suppression skip, conversion interrupt
  (cancels pending), reply pause, caller 2-attempt → archive, no-next-stage → archive, account
  paused hold.
- **`imessage-infra` fake** — parity test with the interface contract (like other infra fakes).
- **Purity** — `advanceSequence` added to `purity.test.ts` coverage.
- **Store** — `pg-store` methods (`getDueSequenceRuns`, `claimRun`, stage/status transitions)
  covered by the existing store test harness.

## Rollout

1. Migration `0017_sequence_runs.sql` + `campaigns.sequence_config` + `scheduled_sends`
   channel/suppression enum additions.
2. `imessage-infra` package (interface + fake).
3. Pure core `advanceSequence` + types + tests.
4. `pg-store` methods + iMessage executor + conversion/reply gate wiring into `inbound`.
5. `sequence-orchestrator` Trigger.dev cron task.
6. UI/UX (via `ultimate-ui-builder`, Briefs above as input):
   a. Sequence Builder (config on `campaigns.sequence_config`, defaults pre-filled).
   b. Pipeline Progress View (stage distribution + goal progress).
   c. Replied Pause + Handoff (notification + lead detail, "let agent handle" stubbed).
   d. Conversion Moment (celebratory, goal-tied).

Each step is independently testable; the pipeline is buildable end-to-end with the iMessage and
conversion-verifier stubs in place. The UI steps depend on steps 1–5 (they render
`sequence_runs` state) but the Briefs and layouts can be designed in parallel.

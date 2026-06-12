# Phase 4 — Leads & review queue UI (design)

Date: 2026-06-11. Roadmap Phase 4. Depends on Phase 3 (shipped). Key rules: 04, 06, 08, 11 (+ always 02, 09).

**Goal:** users see what their agents produced and approve outreach. The pipeline still stops at the queue — nothing sends until Phase 5.

## 1. Leads table (`/leads`)

Replaces the ComingSoon stub. Server component, RLS-scoped selects (accountId only from session, rule 02).

- Table columns: prospect (name, title), company (name, industry), status badge, AI score, channels available (email/LinkedIn icons with verification state).
- Status filter tabs (`All / Qualified / In campaign / Replied / Rejected`) + offset pagination (25/page), both via `searchParams` — the page stays a server component.
- Row click opens a client slide-over detail panel (data already fetched with the row, no extra round trip): AI score + `ai_rationale`, structured `ai_insights` panel (pain points, triggers, motivations, value angle, aha moment, summary — rule 06 dashboard surface), rules-gate reasons when rejected, enrichment statuses (`email_status`, `phone_status`), LinkedIn link.
- Empty state sells the loop: deploy/check your Prospect Agent (links `/agents`).

## 2. Review queue (`/review`)

Campaigns are never the primary user surface (rule 08): the `Campaigns` nav item becomes **Review** (`/review`); `/campaigns` redirects there. The campaigns ComingSoon page is deleted.

- Lists `scheduled_sends` with `status = 'pending_review'`, joined to lead + campaign. One card per draft: lead name/title/company, channel badge, subject (email only) + body, **humanizer style flags as visible badges** (never hidden, rule 08).
- Per-draft actions (server actions, session-resolved account):
  - **Approve** → `status = 'approved'`, `approved_by`/`approved_at` set. Approved drafts wait for Phase 5 send adapters.
  - **Edit** → inline subject/body edit; on save re-run `validateHumanity()` from `@vantera/agent-brains` and refresh `style_flags` (clean edit clears the badges).
  - **Decline** → `status = 'canceled'`.
  - **Decline & suppress** → `canceled` + a `suppression_entries` row (`source: 'manual'`, lead-linked, value normalized) and all other queued drafts for that value flip to `suppressed`.
- Channel filter (all/email/linkedin); count in heading. No bulk approve in v1 (deliberate: review means review).

## 3. Migration 0008 — `scheduled_sends.style_flags`

Style flags currently ride the `error` column (`pg-store.ts` notes "until a metadata column exists"). 0008 adds `style_flags text` to `scheduled_sends`, backfills rows where `error LIKE 'style: %'` (strip prefix, null out `error`), and pg-store/types switch to the real column. No new table → existing RLS policies cover it; rls-auditor reviews the diff anyway (rule 12).

## 4. Suppression management (`/settings/suppression`)

Linked from a card on `/settings`. Rule 11 surface.

- Table: kind, value, source badge, note, created date.
- Manual add form: kind (email / LinkedIn URL), value, optional note. Values normalized (`lower(value)`; LinkedIn URLs trimmed of trailing slashes) to match the pipeline check and the DB check constraint. `created_by` from session.
- **Adding an entry immediately flips matching `pending_review`/`approved` drafts (same channel) to `suppressed`** — shipped with a test proving a suppressed value never stays queued (rule 11 definition of done).
- **Add and view only — no delete or edit.** The 0003 migration has no update/delete RLS policy on `suppression_entries` by design (entries never expire, rule 11); the UI honors that rather than adding policies.

## 5. Retention purge job

Rule 13 shape: core `packages/jobs/src/pipeline/retention-purge.ts` (pure, store injected) + thin `packages/jobs/src/trigger/retention-purge.ts` daily cron.

- Purges leads with `created_at < now() - 90 days` AND (`rules_gate_passed = false` OR never scored: `rules_gate_passed IS NULL AND scored_at IS NULL`) AND `status IN ('sourced','rejected')` — exactly the 0002 retention note; qualified/in-campaign leads are never touched.
- `enrichment_results` cascade with the lead (FK); suppression entries survive (`lead_id` set-null by design).
- Tests: criteria (never purges qualified / recent), summary counts, cron wrapper stays thin (structure guardrail already enforces).

## 6. Channel safety-limit scaffolding

`packages/jobs/src/pipeline/safety-limits.ts`, pure module + tests (rule 04 ceilings live in Vantera's scheduler, not the provider):

- Constants: LinkedIn ~100 invites/week ceiling; new-account ramp schedule; email daily per-mailbox cap placeholder.
- `dailyAllowance(channel, accountAgeDays)` and `paceWithJitter(seed)` helpers; clamping logic that **cannot be configured below the safety floors** — guardrail test asserts the clamp.
- Wired for real at the Phase 5 send boundary; Phase 4 ships the module + tests + an exported entry the send path must call.

## Testing

TDD throughout. Key proofs: suppression-add cancels queued drafts (case-insensitive, both kinds); approve stamps `approved_by` from session; edit re-lints and updates `style_flags`; only manual suppression entries deletable; purge criteria spare qualified leads; safety floors unclampable; validation pure functions colocated (`apps/web/.../review/validation.ts`, `settings/suppression/validation.ts`). Existing guardrails (RLS, brain purity, thin triggers, vendor names) keep covering the new files.

## Knowledge-sync (rule 09)

Three articles in `packages/help-content/content/`: `leads.md` (`surface: leads`), `review-queue.md` (`surface: review`), `suppression.md` (`surface: settings`). Copilot tool registration stays Phase 6 (per Phase 3 precedent).

## Descoped (explicit)

Bulk approve, send modes + preview, user-drafted copy path, live sending, reply handling → Phase 5. Copilot tools → Phase 6. Lead manual add/import UI → unscheduled.

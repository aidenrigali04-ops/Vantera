# SDR Agents: Scout (Prospect) + Copy — design (approved 2026-06-11)

Vantera moves to an **agent-centric model**: users deploy named SDR agents instead of creating campaigns. This phase ships the first two agents — Scout (prospecting) and Copy (outreach copywriting) — each with a setup wizard and a backend brain. Campaigns remain an internal execution grouping only; rule 08 is rewritten accordingly.

## Decisions (owner-approved)

- **Agents are the front door.** Deploying a Scout + Copy pair drives outreach. The agent card, not the campaign, is the user surface.
- **Auth/onboarding (Phase 2) is in flight in a parallel session.** Agent features integrate through one thin helper (`requireAccountId()`); swap when the owner says connect.
- **Prospect data is swappable**: `packages/prospect-data` interface + in-memory fake + Explorium adapter (`EXPLORIUM_API_KEY`), same pattern as email/linkedin infra. Vendor name never user-facing.
- **Pipeline stops at the drafted queue** (`scheduled_sends.status = 'pending_review'`). No live sends until Phase 5. Suppression is enforced before drafting (rule 11) and again at the Phase 5 send boundary.

## Scout (Prospect) Agent

Wizard: Name → ICPs (type-ahead, max 3, onboarding default offered) → Schedule (run time, daily/weekly) → Finish → **Deploy <name>** (status Live).

Brain (per run, Trigger.dev):
1. Context: account industry, ICP criteria, website scan (if `accounts.website_url` set — scanned/cached to `accounts.website_scan`, refreshed when stale >30d).
2. Discovery via `prospect-data` per ICP (`icpCriteriaToFilters`), deduped/upserted into `leads`.
3. **Rules gate** (deterministic code, rule 06 stage 1) → `rules_gate_passed/reasons`.
4. **Enrich survivors only** (email, phone, LinkedIn, firmographics, technographics, signals) → lead contact fields + `enrichment_results`.
5. **AI rank** (rule 06 stage 2): batched `generateObject` (12 leads/call, compact pipe-delimited lead lines, cache-friendly prompt order, brief per-lead `reasoning` field instead of extended thinking) → `ai_score`, `ai_rationale` (dashboard one-liner), `ai_insights` jsonb (pain_points, triggers, motivations, value_angle, aha_moment, summary).
6. Qualified (score ≥ min_score, default 70) → chains the Copy agent if one is live.

Scheduling: one cron scan (15 min) over `agents.next_run_at` — schedule state lives in our DB, pause = status flip.

## Copy Agent

Wizard: Name → ICP (read-only, from Scout; gated if no Scout deployed) → CTA → Add Content (file/image uploads to private `agent-assets` bucket, paste links) → channel toggles (LinkedIn / Email, ≥1) → Finish → Deploy (auto-creates internal campaign, `send_mode='review'`).

Brain: **two separate copy systems** — email and LinkedIn — each its own researched system prompt; personalization from `ai_insights` (pain points, triggers, motivations, value, aha moment) + user CTA + content context.
- Email: ≤90 words, single soft CTA, short lowercase pattern-interrupt subject, never deceptive (rule 11).
- LinkedIn: connection note ≤280 chars, no pitch in first touch, follow-up ≤500 chars.
- **Humanizer**: style constraints in-prompt + deterministic `validateHumanity()` linter + one bounded regenerate; persistent violations flagged for the review queue.
- Suppression check before any draft; suppressed leads produce zero `scheduled_sends` rows.

## Schema (migration 0007)

- `agents` (kind scout|copy, status draft|live|paused, config jsonb, scout scheduling cols, campaign_id composite FK, unique (account_id, kind) in v1).
- `agent_icps` join table (composite same-tenant FKs; max 3 in server action).
- `agent_assets` + private Storage bucket `agent-assets` (path-scoped to account). Retention: assets live while the agent lives; cascade on delete.
- `accounts` + `website_url` (client-updatable), `website_scan`, `website_scanned_at` (service-role).
- `leads` + `ai_insights` jsonb.

## Testing

TDD throughout; guardrail tests auto-cover new tables (RLS-in-migration, tenancy). Key proofs: gate-before-AI ordering, enrich-survivors-only, suppressed-lead-never-drafted (case-insensitive), pipeline never passes `pending_review`, max-3 ICPs, accountId only from session.

## Descoped (explicit)

Preview step, automatic send mode, user-drafted copy path, live sending, reply handling → Phase 5. Copilot tool registration → Phase 6.

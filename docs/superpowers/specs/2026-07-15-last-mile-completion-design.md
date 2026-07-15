# Last-Mile Completion — Design Spec (P0 from the 2026-07-15 platform comparison)

**Why this exists.** The 2026-07-15 comparison simulation (YC-exec lens, fully code- and prod-grounded) found the platform's front half (source → qualify → draft → send → learn) excellent and its back half broken: prod produced 10 interested replies and **0 meetings ever**, because everything after "I'm interested" is inferred, stubbed, manual, or invisible. This spec closes the last mile. The differentiation (self-optimizing engine) only compounds on a complete core loop.

**Prod evidence (2026-07-15):** 207 sends → 28 replies → 10 interested → 0 meetings, 0 closes, 0 CRM pushes. 0/3 copy agents have a bookingUrl. 0 proof points configured. 0 manual takeovers/messages ever. Auto-conversion tokens are never minted (dead path). "Let agent handle" is a stub. Lead timeline omits outbound messages. CRM connect writes a fake "Connected" row without OAuth creds. Pipedrive advertised, nonexistent.

---

## Phases (sequenced; each ships independently, gate-green, prod-verified)

### L1 — The meeting layer (the aha moment becomes producible and visible)
Owner decisions locked into this spec:
1. **Booking link becomes a first-class, onboarding-collected fact.** Confirm step gains a required "Where should interested buyers book you?" field (URL, validated) with an honest escape hatch ("I don't have one yet") that creates a persistent dashboard task card until set. Value flows to the auto-created copy agent's `config.bookingUrl` (the mechanism that already exists and was never armed).
2. **Manual "Mark meeting booked"** on the lead page (datetime optional, defaults now) — writes `meeting_booked_at`, distinct from closed-won. The AI-inferred booking stays as a *detector*, not the only writer.
3. **Booking becomes an EVENT**: stamps the lead, **stops the sequence + cancels queued sends** (new: today a booked prospect keeps getting nudged), fires a `meeting_booked` notification + celebration, and (L3) an email.
4. **A Meetings surface** (`/meetings`): list of booked meetings (lead, company, when detected/scheduled, source: agent-detected vs manual), linked from the Won KPI and the dashboard. This is the in-app destination the hero calendar has been promising. Calendar-provider OAuth (Calendly/cal.com webhooks) = deferred to P1; v1 is link-first + manual/inferred confirmation.
5. **Backfill nudge:** existing accounts without a bookingUrl get the dashboard task card.

Acceptance: a fresh account cannot finish onboarding without deciding on a booking link; an interested conversation can produce a recorded meeting (manually or detected); a booked lead never receives another proactive touch; meetings are visible in one place.

### L2 — The conversation cockpit (interest stops dying in no-man's-land)
1. **Unified inbox** (`/inbox`): every lead with any conversation (sent messages ∪ replies), newest activity first, unanswered-interested pinned. Thread view = full two-way history (outbound bodies from `scheduled_sends` status=sent + inbound `replies`, merged chronologically — the data already exists; the lead timeline currently hides the outbound half).
2. **Pre-drafted suggested reply**: the composer opens with the agent's draft when one is queued for that lead; otherwise a "Draft with Vera" action runs the existing responder brain on demand (same grounding/humanizer; review-mode semantics). This makes the shipped "one click to send" claim true.
3. **Un-stub "Let agent handle"**: wires to the existing automation-resume + responder path instead of returning "coming soon."
4. **Compose to any lead** (not reply-gated): manual first-touch/nudge from the lead page and inbox, `origin: 'manual'`, suppression-checked, normal audit trail.
5. Lead timeline gains outbound messages (with Stage-1 play attribution label per message — closes the "which play wrote this" visibility gap).

Acceptance: a user can read any conversation end-to-end in one place, answer with one click from a real draft, hand a thread to the agent, and message any lead deliberately.

### L3 — Moment-of-value emails (the trial's retention channel)
Via the existing `transactional-email` package (Resend) + per-user prefs (extend the weekly-summary toggle pattern):
1. **Interested reply** email (lead name, snippet, deep link to the thread) — the single most important pull-back moment.
2. **Meeting booked** email.
3. **Needs-you** email (turn-cap handoff / needs_human) — today it's an in-app bell only, and prod shows zero takeovers ever.
Batched/deduped per lead-event, quiet-hours aware, honest copy. Owner action: verify RESEND env in prod.

### L4 — Trust integrity (kill the hollow promises)
1. **CRM connect honesty**: without provider OAuth creds, the connect button shows an honest "finishing certification — get notified" state instead of writing a fake "Connected/healthy" stub row. With creds present, real OAuth (pipeline already complete). Remove `testConnection`'s fake success.
2. **Remove Pipedrive claims** (features grid, FAQ, llms.txt) until an adapter exists.
3. **Conversion-token path**: delete the dead route + store methods (tokens are never minted) OR mint tokens on booking-link sends — decision: DELETE for now (YAGNI; manual close + CRM push is the real path), keep the migration table dormant.
4. **Intent gate**: enforce `features.intent` at deploy + onboarding provisioning (Starter/trial keep Scout signals; Intent agent becomes the real Growth differentiator it's priced as). Existing prod intent agents are grandfathered (no retroactive pausing).

## P1 backlog (next after L1–L4; not in scope here)
Revenue actuals (sum real `deal_value_cents`), safety/pacing visibility panel, invite withdrawal hygiene, bulk approve, trial-starts-on-activation, calendar-provider webhooks, role management, password change, CSV export.

## P2 backlog
Mobile app shell, attachments, real status page, demo scheduler, delete unused fabricated Stats/Testimonials components, email-verification dead-branch cleanup.

## Cross-cutting rules
Every phase: full gate + knowledge-sync articles + suppression tests where a send path is touched + RLS on any new table in the same migration + honest empty states + voice rules ("gets smarter", no she/her for Vera) + prod verification with real evidence before "done".

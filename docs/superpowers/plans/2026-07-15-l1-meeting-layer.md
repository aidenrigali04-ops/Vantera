# L1 — The Meeting Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Spec: `docs/superpowers/specs/2026-07-15-last-mile-completion-design.md` (L1). Steps use checkboxes.

**Goal:** Make the aha moment producible and visible: booking link collected at onboarding, meetings recordable (manual + inferred), booking treated as a real event (stops outreach, notifies), and a Meetings surface the hero calendar finally points to.

**Architecture:** No new table. `leads.meeting_booked_at` already exists; add `meeting_at` (scheduled time, nullable) + `meeting_source` ('agent'|'manual') columns (migration 0050 with the column-lockdown UPDATE grant — the 0038→0039 gotcha). Booking becomes an event in BOTH writers (inbound inference + new manual action): stamp → stop sequence → cancel queued sends → `meeting_booked` notification (new kind in the check constraint) → celebration. Draft/touch paths gate on `meeting_booked_at`. `/meetings` renders from leads.

**Gate:** full monorepo gate; suppression untouched; RLS unchanged (columns on an RLS'd table); knowledge-sync articles; prod verify per the verification mandate.

## Global constraints
- Voice: "gets smarter", no she/her for Vera. Honest empty states (a new account sees "your first booked meeting lands here", never fake data).
- The AI `booked` inference stays a detector; manual mark is authoritative (manual never overwritten by inference; first booking wins as today).
- Migration applied to prod BEFORE the Trigger worker deploys (stamp writers need the columns).

---

### Task 1: Migration 0050 + schema
**Files:** create `packages/db/migrations/0050_meeting_layer.sql`; modify `packages/db/src/schema.ts` (leads + leadNotifications kind enum).
- [ ] SQL: `alter table leads add column if not exists meeting_at timestamptz; alter table leads add column if not exists meeting_source text check (meeting_source in ('agent','manual'));` + comments; **`grant update (meeting_booked_at, meeting_at, meeting_source) on leads to authenticated;`** (manual mark runs through the RLS client — the column-lockdown gotcha); extend `lead_notifications.kind` check constraint to include `'meeting_booked'` (drop + re-add constraint).
- [ ] schema.ts: add the two columns; add `"meeting_booked"` to the leadNotifications kind enum.
- [ ] Run `pnpm --filter @vantera/db test` (RLS guardrails) → PASS. Commit.

### Task 2: Booking-as-event in the pipeline (inferred path)
**Files:** `packages/jobs/src/pipeline/inbound.ts` (applyGenuineReply), `pg-store.ts` (markMeetingBooked gains source + event effects OR a new `applyMeetingBooked` store method), `types.ts`, tests `inbound.test.ts`.
- [ ] Failing tests: a `booked` verdict (a) stamps `meeting_booked_at` + `meeting_source='agent'`, (b) cancels pending sends, (c) stops/converts the sequence run to a terminal non-touch state (reuse `stopSequenceForReply` semantics — decision: status `converted` is wrong; use `stopSequenceRun`), (d) inserts a `meeting_booked` notification. Existing behavior test (booked ≠ sequence stop) gets updated deliberately.
- [ ] Failing tests: `getDraftableLead`/sequence-touch path skips a lead with `meeting_booked_at` (no proactive touch after booking — the "keeps selling after yes" fix). Add the gate in `pg-store.getDraftableLead` (return null) and assert `runSequenceTouch` → "skipped".
- [ ] Implement; full jobs suite green. Commit.

### Task 3: Manual "Mark meeting booked" (web)
**Files:** `apps/web/src/components/lead-crm-controls.tsx` (or sibling `lead-meeting-controls.tsx`), `apps/web/src/app/(app)/leads/crm-actions.ts` (new server action `markMeetingBooked(leadId, meetingAtIso?)`).
- [ ] Action (RLS client): update leads set meeting_booked_at=coalesce(existing, now), meeting_at, meeting_source='manual'; cancel pending sends + stop run (reuse existing action helpers); insert `meeting_booked` notification; revalidate. Never downgrades closed-won.
- [ ] UI: "Mark meeting booked" button + optional datetime, shown when replied/interested and not yet booked; booked state shows the meeting line with source label ("detected from the reply" vs "marked by you").
- [ ] Layout bell: verb + icon + href for `meeting_booked` kind (`(app)/layout.tsx` noteVerb/noteHref, `notifications-bell.tsx` KIND_ICON/KIND_BADGE — CalendarCheck icon, positive badge).

### Task 4: Onboarding collects the booking link + backfill task card
**Files:** `apps/web/src/app/onboarding/wizard.tsx` (Confirm step), `onboarding/validation.ts`, `onboarding/actions.ts` (persist into the auto-created copy agent's `config.bookingUrl` in `findFirstLeads`), `dashboard/dashboard-view.tsx` + `dashboard/page.tsx` (task card when live copy agent has no bookingUrl).
- [ ] Confirm step: required URL field "Where should interested buyers book you?" (https validation, matches agents/validation.ts:76 rules) + escape hatch checkbox "I don't have one yet" → allowed to proceed, flag persists.
- [ ] `findFirstLeads`: pass bookingUrl into the copy agent config it already creates.
- [ ] Dashboard task card (WorkingDashboard, above LearningLog): "Interested buyers have nowhere to book you — add your booking link" → deep link to `/agents/copy/edit`. Shown only when a live copy agent has empty bookingUrl (server-computed prop). This is also the backfill for ALL existing accounts (incl. the owner's — prod has 0/3 set).
- [ ] Onboarding validation tests updated; wizard renders both paths.

### Task 5: /meetings surface
**Files:** create `apps/web/src/app/(app)/meetings/page.tsx`; modify `components/dock-nav.tsx` (nav entry), `pipeline-board.tsx` Won KPI href.
- [ ] Server page (RLS): leads where meeting_booked_at not null, order by coalesce(meeting_at, meeting_booked_at) desc; columns: lead (LeadProfileLink), company, when, source badge, status (booked / closed-won). Honest empty state with the booking-link nudge when relevant. Data-surface doctrine: one hairline container, fluid width.
- [ ] Nav + KPI link. Optional (cheap): dashboard Won tile href → /meetings.

### Task 6: Knowledge-sync + gate + ship + prod verify
- [ ] Help articles: new `meetings.md` + update `dashboard-overview.md`, `replies-unsubscribes.md`, `agents-copy.md` (booking link). Vendor-name guard tests green.
- [ ] Full gate → apply 0050 to prod (before push) → push branch→main → Trigger auto-deploy + Vercel promote + domain proof.
- [ ] Prod verification (no hallucinating): columns + constraint live; task card visible for the Vantera account (0 bookingUrls today — real state); manually mark one REAL already-interested lead's meeting ONLY if the owner confirms one actually happened — otherwise verify the action path in review env by code + tests and state that honestly; confirm a booked lead is excluded from `getDraftableLead` via SQL probe.
- [ ] Memory update + report. Owner follow-ups: set the real booking link on the Vantera copy agent; L2 (conversation cockpit) is next.

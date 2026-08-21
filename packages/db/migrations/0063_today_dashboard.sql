-- 0063: the Today dashboard (Dashboard blueprint v1.0, 2026-08-21) — build step 3.
--
-- Three small per-user columns, one engine-pause stamp, and one read-only activity view.
-- No new tables: everything Today shows already lives in scheduled_sends / replies /
-- linkedin_accounts / outreach_sends / leads / lead_signals / agents / agent_runs /
-- lead_notifications. The view is a RECONSTRUCTION over those tables (v1); the jobs
-- package should start writing a proper activity_events table later so the feed stops
-- being derived (blueprint §12.10).

-- ── user_profiles: per-user Today state ──────────────────────────────────────
-- user_profiles is the user-scoped exception to the account_id rule (0001): one row per
-- auth user, owned and editable only by that user. The existing insert/update policies
-- already cover every column, so these need no new grant — the user may only ever touch
-- their own row.
alter table public.user_profiles
  -- the previous Today visit; drives the "since {time}" status sentence and falls back to
  -- "Overnight" when more than ~10h old
  add column last_today_viewed_at timestamptz,
  -- one-time "asks" the user dismissed (CRM handoff, calendar link, playbook suggestion…):
  -- {kind: iso-timestamp}. A dismissed ask returns only on a new trigger.
  add column dismissed_asks jsonb not null default '{}'::jsonb,
  -- set when the user's first approval session ends; until then /today forwards to the
  -- queue (blueprint §8 "First session")
  add column first_session_done_at timestamptz;

-- ── accounts: the engine pause ───────────────────────────────────────────────
-- No engine-pause state existed in the schema (v2 §16.4 needs one). Set = sourcing and
-- sending stop; approvals stay open. A workspace pause is the user's own call, so it is
-- client-updatable (column-level grant, like the other owner-controlled account fields).
alter table public.accounts
  add column paused_at timestamptz;

grant update (paused_at) on public.accounts to authenticated;

-- ── today_activity: what the engine did, as one feed ─────────────────────────
-- A union over the event-bearing tables, newest first, one row per event. The shape is
-- deliberately STRUCTURED (kind + payload), not prose: the UI composes the sentence so copy
-- can change without a migration.
--
-- Tenancy: `security_invoker = true` makes the view run with the CALLER's privileges, so
-- every underlying table's RLS applies per request (a plain view would execute as the
-- migration owner and bypass RLS — the 0058 footgun). The grant is therefore safe: an
-- authenticated user sees exactly the rows their memberships already let them see.
--
-- retention(today_activity): a view — holds nothing; it reads tables that each state their
-- own window.
create view public.today_activity
with (security_invoker = true)
as
-- 1. sends, grouped per sender per hour (invites vs messages counted separately)
select
  os.account_id,
  date_trunc('hour', max(os.sent_at)) + interval '59 minutes' as at,
  'sends'::text as kind,
  os.linkedin_account_id as sender_id,
  null::uuid as lead_id,
  jsonb_build_object(
    'invites', count(*) filter (where ss.linkedin_stage = 'invite'),
    'messages', count(*) filter (where ss.linkedin_stage is distinct from 'invite')
  ) as payload
from public.outreach_sends os
left join public.scheduled_sends ss on ss.id = os.scheduled_send_id
group by os.account_id, os.linkedin_account_id, date_trunc('hour', os.sent_at)

union all
-- 2. replies, one per reply, with the classifier's verdict
select
  r.account_id,
  r.received_at as at,
  'reply'::text as kind,
  null::uuid as sender_id,
  r.lead_id,
  jsonb_build_object('classification', r.classification) as payload
from public.replies r

union all
-- 3. agent runs (Prospect / Intent), with the run's own summary counters
select
  ar.account_id,
  ar.started_at as at,
  'agent_run'::text as kind,
  null::uuid as sender_id,
  null::uuid as lead_id,
  jsonb_build_object('agent', ar.kind, 'status', ar.status, 'summary', ar.summary) as payload
from public.agent_runs ar

union all
-- 4. lead events the product already notifies about (meeting booked, converted, needs you…)
select
  ln.account_id,
  ln.created_at as at,
  'lead_event'::text as kind,
  null::uuid as sender_id,
  ln.lead_id,
  jsonb_build_object('event', ln.kind) as payload
from public.lead_notifications ln

union all
-- 5. drafts landing in the queue, grouped per hour
select
  ss.account_id,
  date_trunc('hour', max(ss.created_at)) + interval '59 minutes' as at,
  'drafted'::text as kind,
  null::uuid as sender_id,
  null::uuid as lead_id,
  jsonb_build_object('count', count(*)) as payload
from public.scheduled_sends ss
where ss.origin = 'sequence'
group by ss.account_id, date_trunc('hour', ss.created_at)

union all
-- 6. the user's own approvals, grouped per hour
select
  ss.account_id,
  date_trunc('hour', max(ss.approved_at)) + interval '59 minutes' as at,
  'approved'::text as kind,
  null::uuid as sender_id,
  null::uuid as lead_id,
  jsonb_build_object('count', count(*), 'by', ss.approved_by) as payload
from public.scheduled_sends ss
where ss.approved_at is not null
group by ss.account_id, ss.approved_by, date_trunc('hour', ss.approved_at);

grant select on public.today_activity to authenticated;

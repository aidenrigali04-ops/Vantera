-- 0058: stage-scoped recipe attribution + alpha-investing wealth (enterprise-grade-brain 2A).
--
-- retention: this is a VIEW over existing tables (scheduled_sends, outreach_sends, replies,
-- leads) — it stores no new prospect data of its own; each underlying table's own retention
-- window already applies (rule 11).
--
-- alpha_wealth / alpha_spent are optimizer state (alpha-investing sequential-testing budget),
-- not prospect data — no retention window needed. Both columns ride the SAME admin-manage RLS
-- policy the rest of optimization_playbook/optimization_experiments already use (0040) — neither
-- table has ever had a column-scoped grant lockdown (unlike scheduled_sends/leads/mailboxes), so
-- no new grant statement is needed for them to be readable/writable exactly like their siblings.
alter table public.optimization_playbook
  add column alpha_wealth numeric not null default 0.05;
comment on column public.optimization_playbook.alpha_wealth is
  'Alpha-investing wealth (enterprise-grade-brain 2A): the significance budget available to spend on the account''s next sequential test. Starts at 0.05 (the classical single-test alpha) and is drawn down/replenished by the e-process decide pipeline.';

alter table public.optimization_experiments
  add column alpha_spent numeric;
comment on column public.optimization_experiments.alpha_spent is
  'Alpha drawn from the account''s alpha-investing wealth to run THIS experiment. Null = pre-2A experiment (honest unknown, never backfilled) or not yet decided.';

-- Stage-scoped outcome attribution: each SENT recipe-stamped message is judged on ITS OWN stage,
-- not the account's whole funnel — kills the first-touch-gets-everything leakage (audit
-- 2026-07-16) where a reply several touches later got credited back to touch 1.
--
--   * first_touch INVITE rows  -> success = the lead connected (leads.linkedin_connected_at).
--     The paired first-touch MESSAGE row (linkedin_stage = 'message') is excluded entirely: it
--     rides the SAME recipe stamp as its invite (copy-draft.ts's insertLinkedInSendPair stamps
--     both halves of the pair with one `common.recipe`), so counting it too would create a
--     second acceptance denominator for one real invite event.
--   * conversation_reply / sequence_followup rows -> success = an 'interested' reply, negative =
--     a 'not_interested' / 'unsubscribe' reply, landing in the window [this send's sent time,
--     the NEXT agent send to the same lead). A reply after the next touch belongs to that touch.
--
-- scheduled_sends itself carries no sent-at timestamp (only a status enum) — the real per-send
-- clock is outreach_sends.sent_at, written in the same transaction as scheduled_sends.status =
-- 'sent' (recordOutreachSend runs immediately before markSent in outreach-send.ts, rule 11's
-- "audit row before the sent flip"). The lateral join below picks the EARLIEST outreach_sends
-- row per scheduled_send so a hypothetical duplicate audit row can never fan this view out to
-- two outcome rows for one message.
--
-- Service-role read only: see the revoke below. A Postgres view executes against its underlying
-- tables with the VIEW OWNER's privileges, not the caller's — since migrations run as a
-- superuser-class role that bypasses RLS, an ungated grant here would leak every account's
-- attribution data to every other account's authenticated users despite scheduled_sends /
-- replies / leads all having their own RLS. The explicit revoke is therefore load-bearing, not
-- defense-in-depth.
create view public.recipe_stage_outcomes as
with agent_msgs as (
  select
    s.id,
    s.account_id,
    s.lead_id,
    s.linkedin_stage,
    s.recipe,
    s.recipe ->> 'brain' as brain,
    o.sent_at,
    lead(o.sent_at) over (partition by s.lead_id order by o.sent_at, s.id) as next_agent_at
  from public.scheduled_sends s
  join lateral (
    select os.sent_at
    from public.outreach_sends os
    where os.scheduled_send_id = s.id
    order by os.sent_at asc
    limit 1
  ) o on true
  where s.status = 'sent'
    and s.recipe is not null
)
select
  m.id as send_id,
  m.account_id,
  m.lead_id,
  m.brain,
  m.recipe -> 'strategy' as strategy,
  m.recipe ->> 'variant' as variant,
  (m.recipe ->> 'experimentId')::uuid as experiment_id,
  case
    when m.brain = 'first_touch' then (l.linkedin_connected_at is not null)
    else exists (
      select 1
      from public.replies r
      where r.lead_id = m.lead_id
        and r.classification = 'interested'
        and r.received_at >= m.sent_at
        and r.received_at < coalesce(m.next_agent_at, 'infinity'::timestamptz)
    )
  end as success,
  case
    when m.brain = 'first_touch' then false
    else exists (
      select 1
      from public.replies r
      where r.lead_id = m.lead_id
        and r.classification in ('not_interested', 'unsubscribe')
        and r.received_at >= m.sent_at
        and r.received_at < coalesce(m.next_agent_at, 'infinity'::timestamptz)
    )
  end as negative
from agent_msgs m
join public.leads l on l.id = m.lead_id
where m.brain <> 'first_touch' or m.linkedin_stage = 'invite';

revoke all on public.recipe_stage_outcomes from authenticated, anon;

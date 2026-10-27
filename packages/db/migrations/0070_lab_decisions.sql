-- 0070: learning-lab decision log (phase 0).
--
-- Every scheduled send gets one row: the action taken, propensity (1 until more
-- than one action is live), a seed, and the lead features used. New rows are
-- point_in_time. The backfill below is action_only — current lead columns are
-- not the features that existed when an old send was drafted, so they are not
-- copied.
--
-- Append-only for updates. Account deletion still cascades (rule 11): the log
-- is the customer's own outreach history and leaves with the account. Members
-- may read; only the service role writes.
-- retention(lab_decisions): life of the account. A shorter window would make a 30-day replay lie.
-- The send and the lead are bound to the same account. A decision cannot point at another workspace.

alter table public.scheduled_sends
  add constraint scheduled_sends_id_account_unique unique (id, account_id);

create table public.lab_decisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  scheduled_send_id uuid not null,
  lead_id uuid not null,
  decided_at timestamptz not null,
  propensity numeric(8, 6) not null,
  seed text not null,
  action text not null,
  context jsonb not null,
  features jsonb,
  feature_trust text not null check (feature_trust in ('point_in_time', 'action_only')),
  created_at timestamptz not null default now(),
  constraint lab_decisions_send_unique unique (scheduled_send_id),
  constraint lab_decisions_send_fk foreign key (scheduled_send_id, account_id)
    references public.scheduled_sends (id, account_id) on delete cascade,
  constraint lab_decisions_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

create index lab_decisions_account_decided_idx on public.lab_decisions (account_id, decided_at desc);

alter table public.lab_decisions enable row level security;

create policy lab_decisions_select on public.lab_decisions
  for select to authenticated using (public.is_account_member(account_id));

revoke all on public.lab_decisions from anon, public;
revoke insert, update, delete on public.lab_decisions from authenticated;
grant select on public.lab_decisions to authenticated;
grant select, insert, delete on public.lab_decisions to service_role;
revoke update on public.lab_decisions from service_role;

create function public.lab_decisions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'lab_decisions is append-only';
end;
$$;

revoke execute on function public.lab_decisions_append_only() from public, anon, authenticated;

create trigger lab_decisions_no_update
  before update on public.lab_decisions
  for each row execute function public.lab_decisions_append_only();

-- Honest backfill: the action is on the send row. Features are left null.
insert into public.lab_decisions (
  account_id, scheduled_send_id, lead_id, decided_at, propensity, seed, action, context, features, feature_trust
)
select
  s.account_id,
  s.id,
  s.lead_id,
  s.created_at,
  1,
  s.id::text,
  coalesce(s.linkedin_stage, 'none') || ':' || s.origin || ':' || s.status,
  jsonb_build_object(
    'channel', s.channel,
    'origin', s.origin,
    'campaignId', s.campaign_id,
    'linkedinStage', s.linkedin_stage
  ),
  null,
  'action_only'
from public.scheduled_sends s;

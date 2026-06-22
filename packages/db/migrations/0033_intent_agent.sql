-- Migration #34: Intent Agent (kind 'intent'). The fifth SDR agent on the six-piece
-- skeleton (rule 13) and the headline capability of the LinkedIn-only rescope — the edge
-- over Waalaxy (spray) and Goji Berry (surfaces engagement, never actions it). The agent
-- watches LinkedIn for in-market behavior around the customer's niche and feeds the people
-- showing it into the SAME qualify → draft → outreach engine as the Scout. Intent is a
-- SECOND filter, never a bypass: every observed person is scored against the account ICP
-- (rule 06) before enrollment, so "showing interest" never means "skip the quality bar".
--
-- agents.config (intent): {watch:{creators:[],competitors:[],keywords:[],hashtags:[]},
--   signals:{engagement:bool, content:bool}}. Run schedule (run_at_time/cadence/timezone)
--   uses the shared agents columns, like the Scout.

-- 'intent' joins the agent kinds. Dormant 'caller'/'responder' kept (no destructive migration
-- in the LinkedIn-only rescope) so historical rows stay valid.
alter table public.agents drop constraint if exists agents_kind_check;
alter table public.agents add constraint agents_kind_check
  check (kind in ('scout', 'copy', 'caller', 'responder', 'intent'));

-- 'intent' joins the leads source set: an intent-sourced person is a normal lead row, so it
-- flows through the existing qualify → draft → scheduled_sends → review machinery; the source
-- marker keeps it distinguishable for attribution.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check
  check (source in ('discovery', 'manual', 'import', 'inbound', 'ad', 'intent'));

-- retention(intent_observations): observation log — one row per (person, post) the Intent
-- Agent saw engage or publish. A dedupe ledger (skip re-processing the same observation) and
-- an audit trail. Links to the leads row it enrolled (set null if the lead is purged). Cascades
-- with agent/account deletion. Non-enrolled observations are prospect data that never passed the
-- gate, so they are swept on a 90-day window by the retention purge (rule 11), same posture as
-- cold leads. Writes arrive via the service-role intent-scan pipeline only (no client write policy).
create table public.intent_observations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  agent_id uuid not null,
  lead_id uuid,
  profile_url text not null,
  signal_kind text not null check (signal_kind in ('engagement', 'content')),
  watch_target text,
  post_ref text not null,
  headline text,
  detail text,
  outcome text not null check (outcome in
    ('observed', 'qualified', 'rejected', 'suppressed', 'enrolled')) default 'observed',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint intent_observations_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade,
  constraint intent_observations_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete set null (lead_id)
);

-- dedupe: the same person seen on the same post is processed once. Cross-post dedup of the
-- enrolled LEAD still happens at upsertLeads (by profile_url), so a person engaging with several
-- watched posts yields one lead, but each (person, post) observation is recorded once.
create unique index intent_observations_dedupe_idx
  on public.intent_observations (account_id, profile_url, post_ref);
create index intent_observations_account_outcome_idx
  on public.intent_observations (account_id, outcome);
create index intent_observations_agent_idx on public.intent_observations (agent_id);
create index intent_observations_lead_idx on public.intent_observations (lead_id);

alter table public.intent_observations enable row level security;

create policy intent_observations_select on public.intent_observations
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role intent-scan pipeline only (no client write policy)

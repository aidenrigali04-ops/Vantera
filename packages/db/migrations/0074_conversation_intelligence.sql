-- Migration #74: conversation intelligence — per-lead conversation state, the decision log, learned
-- move priors (per-tenant + a cross-tenant counts-only table), and the structured reply readout.
-- Spec: docs/superpowers/specs/2026-10-27-conversation-intelligence-design.md (§5, §7.4, §7.6).

-- retention(conversation_states): derived from the lead's thread; cascades with the lead (rule 11).
create table public.conversation_states (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  state jsonb not null,
  last_message_ref text,
  updated_at timestamptz not null default now(),
  constraint conversation_states_lead_same_account
    foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade,
  constraint conversation_states_lead_unique unique (lead_id)
);

create index conversation_states_account_idx
  on public.conversation_states (account_id, updated_at desc);

alter table public.conversation_states enable row level security;

-- written only by the conversation pipeline via service role — no client write policies
create policy conversation_states_select on public.conversation_states
  for select to authenticated using (public.is_account_member(account_id));

-- retention(conversation_decisions): per-message decision log (what the brain chose and why);
-- cascades with the lead (rule 11). The send link is nulled if the send row goes away.
create table public.conversation_decisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  scheduled_send_id uuid,
  decided_at timestamptz not null default now(),
  mode text not null check (mode in ('shadow', 'live')),
  trigger text not null check (trigger in ('reply', 'first_message', 'followup')),
  phase text not null,
  archetype text not null,
  -- no check: the move list may grow without a migration (the global table does check it)
  move text not null,
  style_key text not null,
  propensity double precision not null,
  seed integer not null,
  legal_moves jsonb not null,
  vetoes jsonb not null,
  state_snapshot jsonb not null,
  composed_body text,
  policy_version integer not null,
  prompt_hash text,
  outcome jsonb,
  reward double precision,
  scored_at timestamptz,
  constraint conversation_decisions_lead_same_account
    foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade,
  constraint conversation_decisions_send
    foreign key (scheduled_send_id, account_id) references public.scheduled_sends(id, account_id)
    on delete set null (scheduled_send_id)
);

create index conversation_decisions_account_decided_idx
  on public.conversation_decisions (account_id, decided_at desc);
create index conversation_decisions_lead_idx on public.conversation_decisions (lead_id);
create index conversation_decisions_send_idx
  on public.conversation_decisions (scheduled_send_id) where scheduled_send_id is not null;
create index conversation_decisions_unscored_idx
  on public.conversation_decisions (scored_at) where scored_at is null;

alter table public.conversation_decisions enable row level security;

-- written only by the conversation pipeline via service role — no client write policies
create policy conversation_decisions_select on public.conversation_decisions
  for select to authenticated using (public.is_account_member(account_id));

-- retention(conversation_priors): aggregate counts per account (no prospect data); cascades with
-- the account.
create table public.conversation_priors (
  account_id uuid not null references public.accounts(id) on delete cascade,
  level text not null check (level in ('move', 'move_phase', 'move_phase_archetype')),
  phase text not null default '',
  archetype text not null default '',
  move text not null,
  count integer not null default 0,
  n integer not null default 0,
  positives integer not null default 0,
  reward_sum double precision not null default 0,
  reward_sq double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, level, phase, archetype, move)
);

alter table public.conversation_priors enable row level security;

-- written only by the learning job via service role — no client write policies
create policy conversation_priors_select on public.conversation_priors
  for select to authenticated using (public.is_account_member(account_id));

-- retention(conversation_priors_global): cross-tenant aggregate counts only; no prospect or tenant
-- data, so no window — rows are never tied to an account and survive account deletion.
-- GLOBAL counts only: no tenant column, no ids, no free text (every text column is a checked
-- enum). Service-role only: RLS on, NO policies.
create table public.conversation_priors_global (
  level text not null check (level in ('move', 'move_phase', 'move_phase_archetype')),
  phase text not null default '' check (phase in ('', 'pre_reply', 'engaged', 'exploring', 'asked', 'after_no')),
  archetype text not null default '' check (archetype ~ '^$|^(ic_mgr|dir_vp|cxo_founder):(low|high|unknown):(low|high|unknown)$'),
  move text not null check (move in ('answer', 'acknowledge', 'observe', 'ask_discovery', 'poke', 'reframe', 'narrow', 'offer_value', 'soft_ask', 'propose_times', 'confirm', 'graceful_exit', 'breakup', 'wait', 'hand_to_human')),
  source text not null check (source in ('research', 'sim', 'real')),
  count integer not null default 0,
  n integer not null default 0,
  positives integer not null default 0,
  reward_sum double precision not null default 0,
  reward_sq double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (level, phase, archetype, move, source)
);

alter table public.conversation_priors_global enable row level security;
-- intentionally NO policies, client grants revoked: service-role only
revoke all on public.conversation_priors_global from authenticated, anon;

-- Structured readout of an inbound reply (intent, objection, signals) written by the classifier.
alter table public.replies add column readout jsonb;

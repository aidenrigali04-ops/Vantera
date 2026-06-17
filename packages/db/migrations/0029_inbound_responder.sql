-- Migration #30: Inbound Responder agent (kind 'responder'). Fourth SDR agent on the
-- six-piece skeleton (rule 13). The report's most defensible "what works" use case is
-- fast inbound response (sub-5-min): when a lead arrives from the customer's own form /
-- site / signal source, the agent qualifies it through the SAME gate (rule 06) and drafts
-- a reply with the SAME copy brain, then auto-sends a clean draft within the SLA or routes
-- it to the review queue. Speed is the product; the quality gate keeps fast from meaning spray.
--
-- agents.config (responder): {sources:{form_fill,website_visitor,signal}, sla_minutes,
--   send_mode:'auto'|'review', intake_id:uuid}. intake_id is the public webhook identifier
--   (safe to expose — it's pasted into the customer's form provider); the signing SECRET lives
--   in inbound_intake_secrets (service-role only), never client-readable.

alter table public.agents drop constraint if exists agents_kind_check;
alter table public.agents add constraint agents_kind_check
  check (kind in ('scout', 'copy', 'caller', 'responder'));

-- 'inbound' joins email/linkedin/stripe/voice/imessage as a webhook source: an inbound
-- LEAD event (not a vendor reply) gets idempotency parity via webhook_events (0009/0024).
alter table public.webhook_events drop constraint if exists webhook_events_source_check;
alter table public.webhook_events add constraint webhook_events_source_check
  check (source in ('email', 'linkedin', 'stripe', 'voice', 'imessage', 'inbound'));

-- 'inbound' joins the leads source set (0009): an inbound lead is a normal lead row so it
-- flows through the existing qualify → draft → scheduled_sends → review machinery; the source
-- marker keeps it distinguishable for attribution (WS-A funnel).
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check check (source in ('discovery', 'manual', 'import', 'inbound'));

-- retention(inbound_leads): intake log + SLA tracker, one row per inbound event. Links to the
-- leads row it created (set null if the lead is purged). Cascades with agent/account deletion;
-- terminal rows are swept by the same 180-day retention companion as scheduled_sends (rule 11).
-- Writes arrive via the service-role intake pipeline only (no client write policy).
create table public.inbound_leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  agent_id uuid not null,
  lead_id uuid,
  source text not null check (source in ('form_fill', 'website_visitor', 'signal')),
  email text,
  first_name text,
  company_name text,
  payload jsonb not null default '{}',
  status text not null check (status in
    ('received', 'qualified', 'rejected', 'suppressed', 'responded', 'review', 'error')) default 'received',
  -- SLA measurement (speed is the product): received_at → responded_at
  received_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint inbound_leads_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade,
  constraint inbound_leads_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete set null (lead_id)
);

create index inbound_leads_account_status_idx on public.inbound_leads (account_id, status);
create index inbound_leads_agent_idx on public.inbound_leads (agent_id);
create index inbound_leads_lead_idx on public.inbound_leads (lead_id);

alter table public.inbound_leads enable row level security;

create policy inbound_leads_select on public.inbound_leads
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role intake pipeline only (no client write policy)

-- Signing secret for the inbound intake webhook. Service-role ONLY: RLS enabled with NO
-- policies (same posture as webhook_events / app_settings) so the secret is never client-
-- readable. Keyed by intake_id (the public URL identifier); the webhook resolves the tenant +
-- agent from this row and verifies the request signature against the decrypted secret.
create table public.inbound_intake_secrets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  agent_id uuid not null,
  intake_id uuid not null,
  secret_enc text not null,
  created_at timestamptz not null default now(),
  constraint inbound_intake_secrets_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade,
  constraint inbound_intake_secrets_agent_unique unique (agent_id)
);

create unique index inbound_intake_secrets_intake_idx
  on public.inbound_intake_secrets (intake_id);

alter table public.inbound_intake_secrets enable row level security;
-- NO policies: service-role only (secret store, never client-readable)

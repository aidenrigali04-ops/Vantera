-- Migration #31: lead_signals — real buying-signal capture (Phase 2 of the dashboard two-loop work).
-- Until now the only "why now" was AI-inferred (leads.ai_insights.triggers). This table persists REAL
-- signals fetched from the prospect-data provider's events + intent enrichment (the rule 05 waterfall,
-- spent on gate survivors only): funding rounds, exec hires, office openings, product launches,
-- partnerships, awards, hiring, leadership/operational change, and B2B intent. They feed the AI rank's
-- timing judgment (rule 06) and power the "Hot right now" / why-now feed (Surface A) and the
-- signal->revenue attribution on Results (Surface B).
--
-- kind is FREE TEXT by design: the provider's event/intent taxonomy evolves, and a check constraint
-- would brittle-break enrichment the day a new category appears. The adapter normalizes kinds to a
-- documented set (+ 'other'); the UI groups on it. label is the human one-line "why now".
--
-- Writes arrive via the service-role scout/enrichment pipeline only (no client write policy), same
-- posture as enrichment_results.
--
-- retention(lead_signals): a signal is prospect data — it cascades with its lead (purged when the
-- lead is purged, so non-qualifying prospect data is not retained indefinitely, rule 11). No
-- independent sweep is needed; the lead lifecycle owns it.

create table public.lead_signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  kind text not null,
  label text not null,
  detail text,
  level text,
  observed_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  constraint lead_signals_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade,
  -- a re-enriched lead re-observing the same signal is idempotent, not a duplicate row
  constraint lead_signals_unique unique (lead_id, kind, label)
);

create index lead_signals_lead_idx on public.lead_signals (lead_id, observed_at desc);
create index lead_signals_account_kind_idx on public.lead_signals (account_id, kind);

alter table public.lead_signals enable row level security;

create policy lead_signals_select on public.lead_signals
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role scout/enrichment pipeline only (no client write policy)

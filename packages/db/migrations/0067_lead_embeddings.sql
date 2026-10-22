-- 0067 (ML-7, 2026-10-21): lookalikes — one profile embedding per qualified/contacted lead.
--
-- The learner measures whether "looks like the people who replied / booked / closed" predicts a
-- positive reply, using cosine similarity (pgvector) to the account's OWN positive leads, leave-one-
-- out. Similarity is only ever computed within an account — never across tenants.
--
-- Service-role only: written by the scout pipeline, read by the pipeline's ordering queries. No
-- client policies and no client privileges — members never need raw vectors (the learner's
-- readout in agent_runs is what the UI shows). Composite FK pins each row to a lead in the same
-- account. source_hash records the profile text that was embedded, so a changed profile re-embeds.
-- No ANN index: similarity is scanned per account (small sets, exact, filtered by account_id).
-- Retention (rule 11): retention(lead_embeddings) = life of the lead (cascades with it).
create table public.lead_embeddings (
  lead_id uuid primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  embedding public.vector(1024) not null,
  model text not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_embeddings_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

create index lead_embeddings_account_idx on public.lead_embeddings (account_id);

create trigger lead_embeddings_set_updated_at
  before update on public.lead_embeddings
  for each row execute function public.set_updated_at();

alter table public.lead_embeddings enable row level security;
revoke all on public.lead_embeddings from authenticated, anon;

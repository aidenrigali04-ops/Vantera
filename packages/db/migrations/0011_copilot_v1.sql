-- Migration #12: Help Copilot v1 (rule 09) — conversations, messages, RAG chunks,
-- copilot_actions undo state. Extends the Phase 2 copilot schema (0005); not a clean slate.

create extension if not exists vector;

-- per-account chat sessions (continuity + audit). Service-role writes from the route.
create table public.copilot_conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_surface text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index copilot_conversations_account_idx on public.copilot_conversations (account_id, updated_at desc);
alter table public.copilot_conversations enable row level security;
create policy copilot_conversations_select on public.copilot_conversations
  for select to authenticated using (public.is_account_member(account_id));

-- one row per turn. feedback + unhelpful power the experience layer (spec §6, §escalation).
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.copilot_conversations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_calls jsonb,
  feedback text check (feedback in ('up', 'down')),
  unhelpful boolean not null default false,
  created_at timestamptz not null default now()
);
create index copilot_messages_conversation_idx on public.copilot_messages (conversation_id, created_at);
alter table public.copilot_messages enable row level security;
create policy copilot_messages_select on public.copilot_messages
  for select to authenticated using (public.is_account_member(account_id));

-- RAG index — GLOBAL reference data, identical for every tenant: NO account_id.
-- Service-role only (RLS on, no policies); read via the SECURITY DEFINER match fn below.
-- voyage-3 → 1024 dims. retention: rebuilt at deploy, not purged.
create table public.copilot_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  heading text,
  content text not null,
  content_hash text not null unique,
  embedding public.vector(1024) not null,
  updated_at timestamptz not null default now()
);
create index copilot_knowledge_chunks_slug_idx on public.copilot_knowledge_chunks (slug);
create index copilot_knowledge_chunks_embedding_idx on public.copilot_knowledge_chunks
  using hnsw (embedding public.vector_cosine_ops);
alter table public.copilot_knowledge_chunks enable row level security;

-- 0005 copilot_actions: link to the turn + reversible-action undo state (spec §Action layer).
alter table public.copilot_actions add column conversation_id uuid
  references public.copilot_conversations(id) on delete set null;
alter table public.copilot_actions add column undoable boolean not null default false;
alter table public.copilot_actions add column undo_expires_at timestamptz;
alter table public.copilot_actions add column undo_payload jsonb;

-- cosine top-K over the global chunk table; SECURITY DEFINER so authenticated callers
-- read it without a tenant policy (the table holds no user data). 1 - distance = similarity.
-- set search_path = '' pins the path (rule 02); all identifiers are fully schema-qualified.
create or replace function public.match_copilot_chunks(query_embedding public.vector(1024), match_count int default 5)
returns table (slug text, heading text, content text, similarity float)
language sql stable security definer set search_path = '' as $$
  select slug, heading, content, 1 - (embedding operator(public.<=>) query_embedding) as similarity
  from public.copilot_knowledge_chunks
  order by embedding operator(public.<=>) query_embedding
  limit match_count;
$$;
grant execute on function public.match_copilot_chunks(public.vector, int) to authenticated, service_role;

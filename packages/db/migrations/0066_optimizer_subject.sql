-- 0066: a subject is an optimizer agent. Learning stays off until one exists.
--
-- Created only from the Machine Learning page, one per account (agents_account_kind_unique).
-- No new column. agents.config holds:
--   enabled boolean
--   active_strategy_id uuid or null
--   guardrails { max_concurrent_experiments, harm_tolerance, auto_adopt }
--   auto_adopt boolean
--   max_concurrent_experiments integer
--   bootstrap_completed_at timestamptz or null
-- bootstrap_completed_at stays null until the later bootstrap phase. RLS is unchanged:
-- agents already enable row level security and member policies in 0007.

alter table public.agents drop constraint if exists agents_kind_check;
alter table public.agents add constraint agents_kind_check
  check (kind in ('scout', 'copy', 'caller', 'responder', 'intent', 'optimizer'));

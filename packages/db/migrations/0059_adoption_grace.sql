-- 0059: autonomous-adoption grace clock (enterprise-grade-brain GATE 1, WS-3.2).
--
-- `readied_at` records the moment an experiment was marked ready_to_adopt (markReadyToAdopt now
-- stamps it alongside status/decision_reason) — it drives the 24h grace window the auto-adopt
-- pass waits out before applying a suggested win, so a fresh regression has a chance to surface
-- before the loop acts autonomously. Nullable: pre-0059 ready_to_adopt rows (if any) have no
-- readied_at and are simply never picked up by getMatureReadyToAdopt (treated as not-yet-mature,
-- never as instantly-mature) until they're re-marked or concluded by the owner.
--
-- retention: optimizer state (same family as alpha_wealth/alpha_spent, 0058) — not prospect data,
-- no retention window. Rides the SAME admin-manage RLS policy optimization_experiments already
-- has (0040) — no new grant needed, this table has never had a column-scoped grant lockdown.
alter table public.optimization_experiments
  add column readied_at timestamptz;
comment on column public.optimization_experiments.readied_at is
  'The moment this experiment was marked ready_to_adopt (enterprise-grade-brain GATE 1, WS-3.2). Drives the 24h auto-adopt grace clock — null on rows never marked ready, or marked before this column existed.';
